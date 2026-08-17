'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Expose une API sécurisée au renderer (data.js)
contextBridge.exposeInMainWorld('electronAPI', {
  loadData: ()       => ipcRenderer.sendSync('store:load'),
  saveData: (data)   => ipcRenderer.sendSync('store:save', data),
});
