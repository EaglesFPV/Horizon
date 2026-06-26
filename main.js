const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

const DATA_FILE = path.join(app.getPath('userData'), 'horizon-data.json');

const DEFAULT_DATA = {
  settings: { currency: 'EUR', monthlySavingsOverride: null, payday: null, lightMode: false, budgets: {} },
  transactions: [], goals: [], recurring: []
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) { fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2)); return DEFAULT_DATA; }
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    return {
      settings:     { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals:        Array.isArray(parsed.goals)        ? parsed.goals        : [],
      recurring:    Array.isArray(parsed.recurring)    ? parsed.recurring    : []
    };
  } catch { return DEFAULT_DATA; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8'); }

// ── Single instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 760, minWidth: 880, minHeight: 600,
    frame: false,
    backgroundColor: '#0F1419',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Quand la fenêtre est détruite → libérer la référence
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available',  info => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('update-available', info.version);
  });
  autoUpdater.on('update-downloaded', info => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('update-downloaded', info.version);
  });
  autoUpdater.on('error', () => {}); // silencieux en prod
  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch {} }, 4000);
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

// Toujours quitter quand toutes les fenêtres sont fermées (Windows/Linux)
app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Window controls ───────────────────────────────────────────────────────────
// Utiliser mainWindow.close() et non app.quit() — permet à l'installateur
// et à l'OS (Alt+F4, WM_CLOSE) de fermer l'app proprement via la même chaîne
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  else app.quit();
});

// ── Data ──────────────────────────────────────────────────────────────────────
ipcMain.handle('data:load',  ()        => loadData());
ipcMain.handle('data:save',  (_, data) => { saveData(data); return true; });

// ── Dialogs ───────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:pickCSV', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un relevé (CSV)',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return { path: r.filePaths[0], content: fs.readFileSync(r.filePaths[0], 'utf-8') };
});

ipcMain.handle('dialog:exportBackup', async (_, data) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter une sauvegarde',
    defaultPath: `horizon-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('dialog:importBackup', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer une sauvegarde',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf-8')); }
  catch { return { error: 'invalid_json' }; }
});

// ── App info & updates ────────────────────────────────────────────────────────
ipcMain.handle('app:info', () => ({ version: app.getVersion() }));

ipcMain.on('check-updates', () => {
  try { autoUpdater.checkForUpdates(); } catch {}
});

ipcMain.on('update-install', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.hide();
  }
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
});


// ── Démarrage automatique ─────────────────────────────────────────────────────
ipcMain.handle('get-startup', () => {
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.on('set-startup', (_, val) => {
  app.setLoginItemSettings({ openAtLogin: val });
});


// ── Enable Banking ────────────────────────────────────────────────────────────
const crypto = require('crypto');
let callbackServer = null;

function generateJWT(appId, pemContent) {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ typ:'JWT', alg:'RS256', kid: appId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss:'enablebanking.com', aud:'api.enablebanking.com', iat: now, exp: now + 3600 })).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), { key: pemContent, padding: crypto.constants.RSA_PKCS1_PADDING }).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

function ebRequest(method, path, appId, pemContent, body) {
  return new Promise((resolve, reject) => {
    const jwt = generateJWT(appId, pemContent);
    const opts = {
      hostname: 'api.enablebanking.com',
      path: path,
      method: method,
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function startCallbackServer(port) {
  return new Promise((resolve, reject) => {
    if (callbackServer) { try { callbackServer.close(); } catch {} callbackServer = null; }
    callbackServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === '/horizon/callback') {
        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0F1419;color:#ECEFF2"><h2 style="color:#D4A24E">✓ Connexion réussie !</h2><p>Tu peux refermer cet onglet et revenir dans Horizon.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>`);
        if (callbackServer) { callbackServer.close(); callbackServer = null; }
        resolve(code || null);
      }
    });
    callbackServer.listen(port, '127.0.0.1', () => resolve);
    callbackServer.on('error', err => { callbackServer = null; reject(err); });
    // Resolve after 5 min timeout
    setTimeout(() => {
      if (callbackServer) { callbackServer.close(); callbackServer = null; }
      reject(new Error('timeout'));
    }, 300000);
  });
}

// List banks for a country
ipcMain.handle('bank:aspsps', async (_, { appId, pemPath, country }) => {
  try {
    const pem = fs.readFileSync(pemPath, 'utf-8');
    const r = await ebRequest('GET', `/aspsps?country=${country}&psu_types=personal`, appId, pem);
    return { ok: true, aspsps: (r.body.aspsps || []).map(a => ({ name: a.name, country: a.country, logo: a.logo })) };
  } catch (err) { return { ok: false, error: err.message }; }
});

// Start OAuth flow
ipcMain.handle('bank:start-auth', async (_, { appId, pemPath, bankName, bankCountry }) => {
  try {
    const pem = fs.readFileSync(pemPath, 'utf-8');
    const port = 27182;
    const redirectUrl = `http://localhost:${port}/horizon/callback`;
    const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const body = {
      access: { valid_until: validUntil },
      aspsp: { name: bankName, country: bankCountry },
      state: crypto.randomUUID(),
      redirect_url: redirectUrl,
      psu_type: 'personal'
    };
    const r = await ebRequest('POST', '/auth', appId, pem, body);
    if (!r.body.url || !r.body.session_id) return { ok: false, error: 'Réponse inattendue de Enable Banking.' };
    const authUrl = r.body.url;
    const sessionId = r.body.session_id;
    // Open browser and wait for callback
    const { shell: sh } = require('electron');
    sh.openExternal(authUrl);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bank:auth-pending');
    // Wait for callback (runs in parallel with the IPC response)
    startCallbackServer(port).then(async (code) => {
      if (!code) {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bank:auth-result', { ok: false, error: 'Aucun code reçu.' });
        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bank:auth-result', { ok: true, sessionId, bankName, bankCountry });
    }).catch(err => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bank:auth-result', { ok: false, error: err.message });
    });
    return { ok: true, pending: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

// Fetch accounts for a session
ipcMain.handle('bank:accounts', async (_, { appId, pemPath, sessionId }) => {
  try {
    const pem = fs.readFileSync(pemPath, 'utf-8');
    const jwt = generateJWT(appId, pem);
    const r = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.enablebanking.com', path: '/accounts', method: 'GET',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json', 'X-Session-Id': sessionId }
      };
      const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({ status:res.statusCode, body:JSON.parse(d) })); });
      req.on('error', reject); req.end();
    });
    return { ok: r.status < 300, accounts: r.body.accounts || [], raw: r.body };
  } catch (err) { return { ok: false, error: err.message }; }
});

// Fetch transactions for an account
ipcMain.handle('bank:transactions', async (_, { appId, pemPath, sessionId, accountId, dateFrom }) => {
  try {
    const pem = fs.readFileSync(pemPath, 'utf-8');
    const jwt = generateJWT(appId, pem);
    const query = dateFrom ? `?date_from=${dateFrom}` : '';
    const r = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.enablebanking.com', path: `/accounts/${accountId}/transactions${query}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json', 'X-Session-Id': sessionId }
      };
      const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve({status:res.statusCode,body:JSON.parse(d)})}catch{resolve({status:res.statusCode,body:d})} }); });
      req.on('error', reject); req.end();
    });
    return { ok: r.status < 300, transactions: r.body.transactions || [], raw: r.body };
  } catch (err) { return { ok: false, error: err.message }; }
});

// Pick .pem file
ipcMain.handle('bank:pick-pem', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Sélectionner la clé privée Enable Banking (.pem)',
    properties: ['openFile'],
    filters: [{ name: 'Clé privée', extensions: ['pem', 'key'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

// ── Contact form (EmailJS) ────────────────────────────────────────────────────
ipcMain.on('send-contact', (e, { name, email, message }) => {
  const body = JSON.stringify({
    service_id:      'service_xyj3ngm',
    template_id:     'template_dfohpm8',
    user_id:         '4Q0Bp9F4uPxecu8vf',
    accessToken:     'dZuO8XftuVqLiGDdg_dXy',
    template_params: { name, email, message, title: 'Horizon Budget' }
  });
  const req = https.request({
    hostname: 'api.emailjs.com',
    path: '/api/v1.0/email/send',
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'origin':         'https://dashboard.emailjs.com'
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => e.reply('contact-result', { ok: res.statusCode === 200 }));
  });
  req.on('error', () => e.reply('contact-result', { ok: false }));
  req.write(body);
  req.end();
});
