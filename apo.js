'use strict';
const fs = require('fs');
const path = require('path');

const BLOCK_START = '# >>> bzAudioLimiter managed include >>>';
const BLOCK_END = '# <<< bzAudioLimiter managed include <<<';
const INCLUDE = 'Include: bzAudioLimiter.txt';
const PLUGIN_DLL = 'bzAudioLimiterVST-0.2.2.dll';

function defaultPaths(env=process.env) {
  const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)'];
  return [...new Set(roots.filter(Boolean).map(dir=>path.join(dir, 'EqualizerAPO', 'config')))];
}
function configDirectory(input) {
  if (!input || typeof input !== 'string') throw new Error('Wskaż katalog config z instalacji Equalizer APO.');
  const folder = path.resolve(input);
  if (fs.existsSync(path.join(folder,'config.txt'))) return folder;
  if (fs.existsSync(path.join(folder,'config','config.txt'))) return path.join(folder,'config');
  throw new Error('Brak config.txt — wybierz folder EqualizerAPO\\config.');
}
function findConfig(explicit, candidates=defaultPaths()) {
  if (explicit) {
    try { return configDirectory(explicit); } catch { /* Fall back to autodetection */ }
  }
  for (const item of candidates) {
    try {return configDirectory(item);} catch {}
  }
  return null;
}
function decodeConfig(file) {
  const raw=fs.readFileSync(file);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe)
    return { text: raw.subarray(2).toString('utf16le'), encoding: 'utf16le', bom: Buffer.from([0xff,0xfe])};
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff)
    throw new Error('config.txt: nieobsługiwane UTF-16 BE.');
  const bom = raw.length >=3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const data = bom ? raw.subarray(3) : raw;
  if (data.includes(0)) throw new Error('config.txt ma nieobsługiwane kodowanie binarne.');
  return {text:data.toString('utf8'),encoding:'utf8',bom:bom?Buffer.from([0xef,0xbb,0xbf]):Buffer.alloc(0)};
}
function serializeConfig(doc,text) {return Buffer.concat([doc.bom,Buffer.from(text,doc.encoding)]);}
function installBlock(text) {
  const start=text.indexOf(BLOCK_START), end=text.indexOf(BLOCK_END);
  if ((start<0)!==(end<0)) throw new Error('config.txt zawiera niepełny blok bzAudioLimiter.');
  const block=`${BLOCK_START}\r\n${INCLUDE}\r\n${BLOCK_END}`;
  if(start>=0) return text.slice(0,start)+block+text.slice(end+BLOCK_END.length);
  const suffix=text.endsWith('\n')?'':'\r\n';
  return text + suffix + block + '\r\n';
}
function removeBlock(text) {
  const start=text.indexOf(BLOCK_START),end=text.indexOf(BLOCK_END);
  if(start<0 || end<start) return text;
  let tail=end+BLOCK_END.length;
  if (text.slice(tail,tail+2)==='\r\n')tail+=2;
  else if(text[tail]==='\n')tail+=1;
  return text.slice(0,start)+text.slice(tail);
}
function normalizeSettings(settings) {
  const number=(v,lo,hi)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Math.round(Number(v)))):lo;
  const ratio={2:0,4:1/3,8:2/3,inf:1};
  const response={fast:0,normal:.5,smooth:1};
  return {
    Enabled:settings.enabled?1:0,
    Ceiling:(number(settings.limit,-49,0)+50)/50,
    Threshold:(number(settings.threshold,-50,0)+60)/60,
    Ratio:ratio[settings.ratio]??1,
    Response:response[settings.response]??0
  };
}
function vstConfigLine(dll,settings) {
  const params=normalizeSettings(settings);
  if (/['"\r\n]/.test(dll)) throw new Error('Ścieżka do DLL zawiera nieobsługiwane znaki.');
  return `# bzAudioLimiter native VST DSP — stereo PCM, x86/x64\r\nDevice: all\r\nChannel: L R\r\nVSTPlugin: Library "${dll}" ${Object.entries(params).map(([key,value])=>`"${key}" ${value}`).join(' ')}\r\n`;
}
function sourceDll(baseDir, architecture) {return path.join(baseDir,'native','bin',architecture,PLUGIN_DLL);}
function selectedArch(env=process.env, nodeArch=process.arch) {
  // Electron ia32 running under 64-bit Windows needs an x64 plugin for 64-bit audiodg.exe.
  const cpu = String(env.PROCESSOR_ARCHITEW6432 || env.PROCESSOR_ARCHITECTURE || '').toUpperCase();
  return cpu.includes('64') || nodeArch === 'x64' || nodeArch === 'arm64' ? 'x64' : 'x86';
}
function pluginPath(dir){return path.join(dir,'bzAudioLimiter',PLUGIN_DLL);}
function configured(dir){
  if(!dir)return false;
  try{
    const doc=decodeConfig(path.join(dir,'config.txt'));
    const data=fs.readFileSync(path.join(dir,'bzAudioLimiter.txt'),'utf8');
    return doc.text.includes(BLOCK_START) && doc.text.includes(INCLUDE) &&
      doc.text.includes(BLOCK_END) && fs.existsSync(pluginPath(dir)) &&
      data.includes('VSTPlugin: Library') && data.includes(PLUGIN_DLL);
  } catch {return false;}
}
function atomicWrite(file, data) {
  try {
    fs.writeFileSync(file, data);
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      for (let i = 0; i < 5; i++) {
        try {
          const start = Date.now();
          while (Date.now() - start < 30) {}
          fs.writeFileSync(file, data);
          return;
        } catch {}
      }
    }
    throw err;
  }
}
function install(configDir,settings,source,updateOnly=false){
  const dir=configDirectory(configDir);
  const main=path.join(dir,'config.txt');
  if(!fs.existsSync(source))throw new Error('Brak zbudowanego silnika VST dla tej architektury.');
  if(updateOnly&&!configured(dir))throw new Error('Wtyczka nie jest zainstalowana.');
  const doc=decodeConfig(main);
  const newText=installBlock(doc.text);
  const folder=path.join(dir,'bzAudioLimiter');
  fs.mkdirSync(folder,{recursive:true});
  const destination=pluginPath(dir);
  if(!updateOnly && !fs.existsSync(destination))fs.copyFileSync(source,destination);
  if(!updateOnly && newText !== doc.text) {
    const backup=path.join(dir,'config.txt.bzAudioLimiter.'+new Date().toISOString().replace(/[^0-9]/g,'')+'.bak');
    fs.copyFileSync(main,backup);
  }
  // Write VST config before updating master include; never leave an include to a nonexistent file.
  atomicWrite(path.join(dir,'bzAudioLimiter.txt'),vstConfigLine(destination,settings));
  if(newText !== doc.text)atomicWrite(main,serializeConfig(doc,newText));
  return dir;
}
function uninstall(configDir){
  const dir=configDirectory(configDir);
  const main=path.join(dir,'config.txt');
  const doc=decodeConfig(main);
  const modified=removeBlock(doc.text);
  if(modified!==doc.text)atomicWrite(main,serializeConfig(doc,modified));
  // Leave plugin DLL on disk: it may still be mapped by the Windows audio service.
  // Removing the include stops processing after APO configuration reload.
  return dir;
}
module.exports={BLOCK_START,BLOCK_END,INCLUDE,PLUGIN_DLL,defaultPaths,configDirectory,findConfig,selectedArch,sourceDll,pluginPath,configured,install,uninstall,normalizeSettings,vstConfigLine,installBlock,removeBlock,decodeConfig};
