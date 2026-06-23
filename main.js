const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
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
    try { autoUpdater.checkForUpdatesAndNotify(); } catch {}
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available',  info => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-available',  info.version); });
  autoUpdater.on('update-downloaded', info => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-downloaded', info.version); });
  autoUpdater.on('error', () => {});
  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch {} }, 3000);
}

app.whenReady().then(() => { createWindow(); setupAutoUpdater(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close',   () => app.quit());

// ── Data ─────────────────────────────────────────────────────────────────────
ipcMain.handle('data:load',  ()         => loadData());
ipcMain.handle('data:save',  (_, data)  => { saveData(data); return true; });

// ── Dialogs ──────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:pickCSV', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Importer un relevé (CSV)', properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv','txt'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return { path: r.filePaths[0], content: fs.readFileSync(r.filePaths[0], 'utf-8') };
});
ipcMain.handle('dialog:exportBackup', async (_, data) => {
  const r = await dialog.showSaveDialog(mainWindow, { title: 'Exporter une sauvegarde', defaultPath: `horizon-sauvegarde-${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});
ipcMain.handle('dialog:importBackup', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Importer une sauvegarde', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf-8')); }
  catch { return { error: 'invalid_json' }; }
});

// ── App info ─────────────────────────────────────────────────────────────────
ipcMain.handle('app:info', () => ({ version: app.getVersion() }));
ipcMain.on('check-updates',  () => { try { autoUpdater.checkForUpdates(); } catch {} });
ipcMain.on('update-install', () => {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.removeAllListeners('close'); mainWindow.hide(); }
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
});

// ── Contact form (EmailJS) ────────────────────────────────────────────────────
ipcMain.on('send-contact', (e, { name, email, message }) => {
  const body = JSON.stringify({
    service_id:  'service_xyj3ngm',
    template_id: 'template_dfohpm8',
    user_id:     '4Q0Bp9F4uPxecu8vf',
    accessToken: 'dZuO8XftuVqLiGDdg_dXy',
    template_params: { name, email, message, title: 'Horizon Budget' }
  });
  const req = https.request({
    hostname: 'api.emailjs.com', path: '/api/v1.0/email/send', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'origin': 'https://dashboard.emailjs.com' }
  }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => e.reply('contact-result', { ok: res.statusCode === 200 }));
  });
  req.on('error', () => e.reply('contact-result', { ok: false }));
  req.write(body); req.end();
});