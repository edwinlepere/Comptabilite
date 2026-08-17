'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

function getDataPath() {
  return path.join(app.getPath('userData'), 'compta.json');
}

// Lecture synchrone du fichier de données
ipcMain.on('store:load', (event) => {
  try {
    const raw = fs.readFileSync(getDataPath(), 'utf8');
    event.returnValue = raw;
  } catch {
    event.returnValue = null;
  }
});

// Écriture synchrone du fichier de données
ipcMain.on('store:save', (event, data) => {
  try {
    fs.writeFileSync(getDataPath(), data, 'utf8');
    event.returnValue = true;
  } catch (e) {
    console.error('Erreur sauvegarde:', e);
    event.returnValue = false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width:  1280,
    height: 860,
    minWidth:  900,
    minHeight: 600,
    title: 'Comptabilité Maison',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
