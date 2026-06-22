const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'horizon-data.json');

const DEFAULT_DATA = {
  settings: {
    currency: 'EUR',
    monthlySavingsOverride: null
  },
  transactions: [],
  goals: []
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : []
    };
  } catch (err) {
    console.error('Failed to load data, falling back to defaults:', err);
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#0F1419',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC: data persistence ---

ipcMain.handle('data:load', () => loadData());

ipcMain.handle('data:save', (_event, data) => {
  saveData(data);
  return true;
});

// --- IPC: CSV import ---

ipcMain.handle('dialog:pickCSV', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un relevé (CSV)',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const content = fs.readFileSync(result.filePaths[0], 'utf-8');
  return { path: result.filePaths[0], content };
});

// --- IPC: backup export / import ---

ipcMain.handle('dialog:exportBackup', async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter une sauvegarde',
    defaultPath: `horizon-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('dialog:importBackup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer une sauvegarde',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    return { error: 'invalid_json' };
  }
});
