const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.ELECTRON_IS_DEV === '1' || process.env.NODE_ENV === 'development';
const store = require('./store.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }
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

// IPC: storage
ipcMain.handle('rr:getAll', async () => {
  return await store.readData();
});

ipcMain.handle('rr:savePartial', async (_event, partial) => {
  const current = await store.readData();
  const next = { ...current, ...partial };
  await store.writeData(next);
  return next;
});

ipcMain.handle('rr:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export RoadReady Data',
    defaultPath: 'roadready-data.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await store.exportTo(filePath);
  return { ok: true, filePath };
});

ipcMain.handle('rr:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import RoadReady Data',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false };
  await store.importFrom(filePaths[0]);
  const data = await store.readData();
  return { ok: true, data };
});
