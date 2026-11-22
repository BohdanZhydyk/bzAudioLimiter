const { contextBridge, ipcRenderer } = require('electron');
const subscribe=(event,cb)=>{const listener=(_e,v)=>cb(v);ipcRenderer.on(event,listener);return()=>ipcRenderer.removeListener(event,listener);};
contextBridge.exposeInMainWorld('bzAudio', {
  state:()=>ipcRenderer.invoke('get-state'),
  save:(patch)=>ipcRenderer.invoke('save-settings',patch),
  engineInfo:()=>ipcRenderer.invoke('engine-info'),
  chooseAPO:()=>ipcRenderer.invoke('apo-select'),
  installAPO:()=>ipcRenderer.invoke('apo-install'),
  removeAPO:()=>ipcRenderer.invoke('apo-remove'),
  refreshAPO:()=>ipcRenderer.invoke('apo-refresh'),
  downloadAPO:()=>ipcRenderer.invoke('apo-download'),
  deviceSelector:()=>ipcRenderer.invoke('apo-device-selector'),
  openExternal:(url)=>ipcRenderer.invoke('open-external', url),
  onSettings:(cb)=>subscribe('settings',cb),
  onAudio:(cb)=>subscribe('audio',cb),
  onMeter:(cb)=>subscribe('meter',cb),
  onAudioError:(cb)=>subscribe('audio-error',cb)
});
