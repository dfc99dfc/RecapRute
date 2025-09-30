const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rr', {
  storage: {
    getAll: async () => ipcRenderer.invoke('rr:getAll'),
    savePartial: async (partial) => ipcRenderer.invoke('rr:savePartial', partial),
    export: async () => ipcRenderer.invoke('rr:export'),
    import: async () => ipcRenderer.invoke('rr:import'),
  },
  platform: process.platform,
});
