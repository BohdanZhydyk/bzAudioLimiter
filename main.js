const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const apo = require('./apo');
const limits = require('./limits');

const store = new Store({ name: 'settings' });
const defaults = { language: 'PL', enabled: false, limit: -12, threshold: -24, response: 'fast', ratio: '2', startMinimized: false, startWithWindows: false };
const settings = () => {
  const saved = { ...defaults, ...store.get('settings', {}) };
  return { ...saved, ...limits.normalize(saved) };
};
let win, tray, quitting = false, pendingUpdate = null;
let meterProcess = null;
let meterOnline = false;
let meterLast = null;
let dspSequence = null;
let dspUpdatedAt = 0;


function configDir() { return apo.findConfig(store.get('apoPath','')); }
function engineStatus() {
  const dir = configDir();
  const configured = Boolean(dir && apo.configured(dir));
  return {
    connected: false, // no live audiodg/HDMI verification; never claim active processing
    configured,
    reason: configured ? 'Wtyczka skonfigurowana.' : 'Brak wtyczki Equalizer APO. Zainstaluj Equalizer APO i podłącz silnik.',
    inputDb: null, outputDb: null, reductionDb: null,
    device: 'Wybrane w Equalizer APO',
    configDir: dir || ''
  };
}
function publish() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('settings', settings());
    win.webContents.send('audio', engineStatus());
  }
  updateTray();
}
function applyDSP() {
  if (pendingUpdate) { clearTimeout(pendingUpdate); pendingUpdate = null; }
  const dir = configDir();
  if (!dir || !apo.configured(dir)) return;
  const source = apo.sourceDll(app.isPackaged ? process.resourcesPath : __dirname, apo.selectedArch());
  apo.install(dir, settings(), source, true);
}
function save(patch) {
  const previous=settings();
  const next={...previous};
  const allowed={ language:['PL','EN','UA'], response:['fast','normal','smooth'], ratio:['2','4','8','inf'] };
  for (const [key,value] of Object.entries(patch || {})) {
    if (key in allowed) {if (allowed[key].includes(value)) next[key]=value;}
    else if ((key === 'limit' || key === 'threshold') && Number.isInteger(value)) next[key]=value;
    else if (['enabled','startMinimized','startWithWindows'].includes(key) && typeof value==='boolean') next[key]=value;
  }
  Object.assign(next, limits.normalize(previous, patch));
  if (!engineStatus().configured) next.enabled = false;
  store.set('settings',next);
  if (app.isPackaged) {
    app.setLoginItemSettings({openAtLogin:Boolean(next.startWithWindows),openAsHidden:Boolean(next.startMinimized)});
  }
  const dspKeys = ['enabled', 'limit', 'threshold', 'response', 'ratio'];
  const hasDspChange = dspKeys.some(k => Object.prototype.hasOwnProperty.call(patch || {}, k) && patch[k] !== previous[k]);

  if (Object.prototype.hasOwnProperty.call(patch||{},'enabled')) {
    try { applyDSP(); }
    catch (e) {store.set('settings',previous);publish();throw e;}
  } else if (hasDspChange && engineStatus().configured) {
    if(pendingUpdate)clearTimeout(pendingUpdate);
    pendingUpdate=setTimeout(()=>{
      try {applyDSP();}
      catch(e) {win?.webContents.send('audio-error',e.message);}
    },250);
  }
  publish();
  return next;
}
// Read-only Windows endpoint level meter, independent from Equalizer APO / VST.
// A failed meter MUST NEVER disable or alter audio output.
function meterScript() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'meter.ps1')
    : path.join(__dirname, 'native', 'meter.ps1');
}
function emitMeter(payload) {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed?.()) {
    win.webContents.send('meter', payload);
  }
}
function startMeter() {
  if (process.platform !== 'win32' || meterProcess) return;
  const script = meterScript();
  if (!fs.existsSync(script)) { emitMeter({online:false,reason:'Brak native/meter.ps1'}); return; }
  let child;
  try {
    child = spawn('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],
      { windowsHide:true, stdio:['ignore','pipe','pipe'] });
  } catch (error) { emitMeter({online:false,reason:error.message}); return; }
  meterProcess = child;
  let buffer = '';
  let lastMeterError = '';
  const reset = (reason) => {
    if (meterProcess !== child) return;
    meterProcess = null;
    meterOnline = false;
    meterLast = null;
    dspSequence = null;
    dspUpdatedAt = 0;
    emitMeter({online:false,reason});
  };
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8');
    if (buffer.length > 16384) buffer = buffer.slice(-4096);
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0,end).trim();
      buffer = buffer.slice(end+1);
      try {
        const data = JSON.parse(line);
        let reductionDb = null;
        if (Number.isInteger(data.dspSequence) &&
            Number.isInteger(data.dspGainPpm) && data.dspGainPpm >= 0 && data.dspGainPpm <= 1000000 &&
            (data.dspEnabled === 0 || data.dspEnabled === 1)) {
          if (dspSequence !== data.dspSequence) dspUpdatedAt = Date.now();
          dspSequence = data.dspSequence;
          if (Date.now() - dspUpdatedAt < 2000) {
            reductionDb = data.dspEnabled ? -20 * Math.log10(Math.max(data.dspGainPpm, 1) / 1000000) : 0;
          }
        } else { dspSequence = null; dspUpdatedAt = 0; }
        if (data.offline) {
          meterOnline = false;
          meterLast = {online:false, reductionDb};
          emitMeter(meterLast);
          continue;
        }
        if (typeof data.db === 'number' && Number.isFinite(data.db) && data.db>=-60 && data.db<=0 &&
            typeof data.peak === 'number' && Number.isFinite(data.peak) && data.peak>=0 && data.peak<=1) {
          meterOnline = true;
          meterLast = {online:true,db:data.db,peak:data.peak,reductionDb};
          emitMeter(meterLast);
        }
      } catch { /* Ignore partial/non-JSON output; no fabricated readings. */ }
    }
  });
  child.stderr.on('data',chunk=>{ lastMeterError=(lastMeterError+chunk.toString('utf8')).slice(-480).trim(); });
  child.on('error',error=>reset(error.message));
  child.on('exit',(code)=>reset('Miernik Windows zakończył pracę ('+code+'). '+lastMeterError));
}
function stopMeter() {
  const child=meterProcess;
  meterProcess=null;
  meterOnline=false;
  meterLast=null;
  dspSequence=null;
  dspUpdatedAt=0;
  if(child && !child.killed)child.kill();
}

function icon(active=false) {
  const file = active ? 'tray-green.png' : 'tray-orange.png';
  const p = path.join(__dirname, 'public', file);
  if (typeof nativeImage?.createFromPath === 'function' && fs.existsSync(p)) {
    return nativeImage.createFromPath(p);
  }
  const size=16,pixels=Buffer.alloc(size*size*4);
  for(let x=2;x<14;x+=3) {
    const h=[6,12,8,5][Math.floor((x-2)/3)];
    for(let y=Math.floor((16-h)/2);y<Math.ceil((16+h)/2);y++) {
      const i=(y*size+x)*4;
      pixels[i]=active?56:255; pixels[i+1]=active?239:102; pixels[i+2]=active?125:0; pixels[i+3]=255;
    }
  }
  return typeof nativeImage?.createFromBitmap === 'function'
    ? nativeImage.createFromBitmap(pixels,{width:size,height:size})
    : null;
}
function appIcon() {
  const p = path.join(__dirname, 'public', 'icon.png');
  if (typeof nativeImage?.createFromPath === 'function' && fs.existsSync(p)) {
    return nativeImage.createFromPath(p);
  }
  return icon(false);
}
function updateTray() {
  if(!tray)return;
  const state=engineStatus(),active=state.configured&&settings().enabled;
  if (typeof tray.setImage === 'function') tray.setImage(icon(active));

  tray.setToolTip(active ? 'bzAudioLimiter: WŁĄCZONY' : 'bzAudioLimiter: WYŁĄCZONY');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: active ? '🟢 Limiter: WŁĄCZONY' : '🟠 Limiter: WYŁĄCZONY', enabled: false },
    { type: 'separator' },
    { label: '🖥️ Pokaż okno', click: showWindow },
    { label: active ? '⏸️ Wyłącz limiter' : '⚡ Włącz limiter', enabled: state.configured, click: () => save({ enabled: !active }) },
    { type: 'separator' },
    { label: '🚪 Zakończ program', click: () => { quitting = true; app.quit(); } }
  ]));
}
function showWindow() { if(win){win.show();win.focus();} }
function createWindow() {
  win=new BrowserWindow({width:800,height:600,minWidth:800,minHeight:600,backgroundColor:'#111111',title:'bzAudioLimiter',icon:appIcon(),show:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  if(typeof win.show === 'function') win.show();
  if(typeof win.focus === 'function') win.focus();
  if(win.setMenu) win.setMenu(null);
  if(typeof win.webContents?.setWindowOpenHandler === 'function') {
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });
  }
  if(typeof win.webContents?.on === 'function') {
    win.webContents.on('will-navigate', (e, url) => {
      if ((url.startsWith('http:') || url.startsWith('https:')) && !url.startsWith('http://127.0.0.1:5173')) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });
  }
  if(app.isPackaged)win.loadFile(path.join(__dirname,'dist','index.html'));
  else win.loadURL('http://127.0.0.1:5173');
  win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});
}
app.whenReady().then(()=>{
  ipcMain.handle('get-state',()=>({settings:settings(),audio:engineStatus(),meter:meterLast||{online:false}}));
  ipcMain.handle('save-settings',(_,patch)=>save(patch));
  ipcMain.handle('engine-info',()=>engineStatus());
  ipcMain.handle('show-window',showWindow);
  ipcMain.handle('apo-select',async()=>{
    const result=await dialog.showOpenDialog(win,{title:'Katalog Equalizer APO (config)',properties:['openDirectory']});
    if(result.canceled)return engineStatus();
    const dir=apo.configDirectory(result.filePaths[0]);
    store.set('apoPath',dir);
    publish();return engineStatus();
  });
  ipcMain.handle('apo-install',async()=>{
    const dir=configDir();
    if(!dir)throw new Error('Najpierw zainstaluj Equalizer APO, następnie wskaż jego katalog config.');
    const src=apo.sourceDll(app.isPackaged?process.resourcesPath:__dirname,apo.selectedArch());
    if(!fs.existsSync(src))throw new Error('Brakuje natywnej DLL w pakiecie dla tej architektury.');
    const confirm=await dialog.showMessageBox(win,{type:'warning',buttons:['Anuluj','Podłącz DSP'],defaultId:0,cancelId:0,
      message:'Podłączyć limiter do Equalizer APO?',
      detail:'Program utworzy kopię config.txt, doda Include: bzAudioLimiter.txt i zapisze wtyczkę VST. W Equalizer APO Device Selector musi być zaznaczone wybrane wyjście audio. Dotyczy dźwięku stereo PCM w trybie współdzielonym.'});
    if(confirm.response!==1)return engineStatus();
    apo.install(dir,settings(),src);
    store.set('apoPath',dir);
    publish();return engineStatus();
  });
  ipcMain.handle('apo-remove',async()=>{
    const dir=configDir();
    if(dir){save({enabled:false});apo.uninstall(dir);}
    publish();return engineStatus();
  });
  ipcMain.handle('apo-refresh',()=>{publish();return engineStatus();});
  ipcMain.handle('open-external',async(_,url)=>{
    if(typeof url==='string'&&(url.startsWith('http:')||url.startsWith('https:'))){
      await shell.openExternal(url);return true;
    }
    return false;
  });
  ipcMain.handle('apo-download',()=>shell.openExternal('https://sourceforge.net/projects/equalizerapo/'));
  ipcMain.handle('apo-device-selector',async()=>{
    const dir=configDir();if(!dir)throw new Error('Nie wykryto Equalizer APO.');
    const root=path.dirname(dir);
    const executable=['DeviceSelector.exe','Configurator.exe'].map(name=>path.join(root,name)).find(f=>fs.existsSync(f));
    if(!executable)throw new Error('Nie znaleziono programu Device Selector w Equalizer APO.');
    const result=await shell.openPath(executable);if(result)throw new Error(result);
    return true;
  });
  createWindow();tray=new Tray(icon());tray.on('double-click',showWindow);tray.on('click',showWindow);tray.on('right-click',()=>updateTray());updateTray();
  // Run meter only on Windows; failure does not touch Equalizer APO settings.
  startMeter();
});
app.on('before-quit',()=>{
  quitting=true;
  stopMeter();
  try {
    if(pendingUpdate)clearTimeout(pendingUpdate);
    if(settings().enabled){const next={...settings(),enabled:false};store.set('settings',next);applyDSP();}
  } catch(e) { // Never prevent quitting or leave audio routed through a nonexistent endpoint.
    if(win&&!win.isDestroyed()) dialog.showErrorBox('bzAudioLimiter — wyłączenie DSP',e.message);
  }
});
app.on('window-all-closed',()=>{ /* Closing the window hides to tray. */ });
