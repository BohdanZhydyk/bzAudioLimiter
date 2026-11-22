'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const root = path.resolve(__dirname, '..');

test('Windows endpoint meter: starts in GUI, reads actual numeric values, rejects fabricated/invalid input, stops safely', async () => {
  const handlers = new Map(), appEvents = new Map(), messages = [];
  let child;
  class MockStore {get(_,fallback){return fallback;} set() {}}
  const electron = {
    app: {isPackaged:false,whenReady(){return Promise.resolve();},on(name,callback){appEvents.set(name,callback);},setLoginItemSettings(){}},
    BrowserWindow: class {constructor(){return {setMenu(){},loadURL(){},on(){},webContents:{send(...a){messages.push(a);},isDestroyed(){return false;}},isDestroyed(){return false;}};}},
    Tray:class{setToolTip(){}setContextMenu(){}on(){}},
    Menu:{buildFromTemplate(menu){return menu;}},
    nativeImage:{createFromBitmap(){return {}; }},
    ipcMain:{handle(name,callback){handlers.set(name,callback);}},
    dialog:{},shell:{}
  };
  const spawned=[];
  function spawn(exe,args,options){
    child = new EventEmitter(); child.stdout=new EventEmitter();child.stderr=new EventEmitter();
    child.killed=false; child.kill=()=>{child.killed=true;return true;};
    spawned.push({exe,args,options}); return child;
  }
  const mockProcess={platform:'win32',env:process.env,arch:'x64',pid:process.pid,resourcesPath:root};
  const context={require:(spec)=>spec==='electron'?electron:spec==='electron-store'?MockStore:spec==='child_process'?{spawn}:spec==='./apo'?require('../apo'):spec==='./limits'?require('../limits'):require(spec),
    process:mockProcess,console,Buffer,__dirname:root,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),context,{filename:'main.js'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(spawned.length,1);
  assert.equal(spawned[0].exe,'powershell.exe');
  assert.equal(spawned[0].options.windowsHide,true);
  assert.match(spawned[0].args.join(' '),/native[\\/]meter.ps1/);
  child.stdout.emit('data', Buffer.from('{"peak":0.5,"db":-6.02}\n'));
  assert.equal(handlers.get('get-state')().meter.db,-6.02);
  assert.equal(handlers.get('get-state')().meter.online,true);
  assert.equal(messages.at(-1)[0],'meter');
  child.stdout.emit('data',Buffer.from('{"peak":0.5,"db":-6.02,"dspSequence":12,"dspGainPpm":500000,"dspEnabled":1}\n'));
  assert.ok(Math.abs(handlers.get('get-state')().meter.reductionDb-6.0206)<0.01);
  child.stdout.emit('data',Buffer.from('{"peak":9,"db":5}\nnot json\n'));
  assert.equal(handlers.get('get-state')().meter.db,-6.02);
  child.stdout.emit('data',Buffer.from('{"offline":true}\n'));
  assert.equal(handlers.get('get-state')().meter.online,false);
  appEvents.get('before-quit')();
  assert.equal(child.killed,true);
  assert.equal(handlers.get('get-state')().meter.online,false);
});
