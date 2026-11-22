'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');

test('Electron controller -> install APO -> switch on -> persisted config -> quit disables', async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bzAL-main-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  fs.writeFileSync(path.join(tmp,'config.txt'),'Preamp: -3 dB\n');
  const storage=new Map([['apoPath',tmp]]);
  class Store {get(k,defaultValue){return storage.has(k)?storage.get(k):defaultValue;}set(k,v){storage.set(k,v);}}
  const handlers=new Map(), events=new Map();
  let trayMenu;
  const win={webContents:{send(){}},setMenu(){},loadURL(){},loadFile(){},on(){},show(){},focus(){},hide(){},isDestroyed(){return false;}};
  const mockElectron={
    app:{isPackaged:false,whenReady(){return Promise.resolve();},on(event,cb){events.set(event,cb);},setLoginItemSettings(){}},
    BrowserWindow:class{constructor(){return win;}},
    Tray:class{setToolTip(){}setContextMenu(m){trayMenu=m;}on(){}},
    Menu:{buildFromTemplate(t){return t;}},
    nativeImage:{createFromBitmap(){return 'fake icon';}},
    ipcMain:{handle(k,fn){handlers.set(k,fn);}},
    dialog:{showOpenDialog:async()=>({canceled:true}),showMessageBox:async()=>({response:1}),showErrorBox(){}},
    shell:{openExternal:async()=>true,openPath:async()=>''}
  };
  const source=fs.readFileSync(path.join(base,'main.js'),'utf8');
  const context={require:(spec)=>spec==='electron'?mockElectron:spec==='electron-store'?Store:spec==='./apo'?require('../apo'):spec==='./limits'?require('../limits'):require(spec),
    process,console,Buffer,__dirname:base,setTimeout,clearTimeout};
  vm.runInNewContext(source,context,{filename:'main.js'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(handlers.has('get-state'));
  assert.equal(handlers.get('get-state')().audio.configured,false);
  await handlers.get('apo-install')();
  assert.equal(handlers.get('get-state')().audio.configured,true);
  await handlers.get('save-settings')(null,{enabled:true,limit:-18,threshold:-30,ratio:'2'});
  const config=fs.readFileSync(path.join(tmp,'bzAudioLimiter.txt'),'utf8');
  assert.match(config,/"Enabled" 1/);
  assert.match(config,/"Ceiling" 0.64/);
  assert.match(config,/"Ratio" 0/);
  assert.ok(Array.isArray(trayMenu));
  events.get('before-quit')();
  assert.match(fs.readFileSync(path.join(tmp,'bzAudioLimiter.txt'),'utf8'),/"Enabled" 0/);
  assert.equal(storage.get('settings').enabled,false);
  await handlers.get('apo-remove')();
  assert.equal(handlers.get('get-state')().audio.configured,false);
  assert.equal(fs.readFileSync(path.join(tmp,'config.txt'),'utf8'),'Preamp: -3 dB\n');
});
