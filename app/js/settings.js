// Chess Tournament Manager 2.0
// Theme, font, language, UI size, toast/confirm UI, and Undo history.

const APP_FONT_KEY='chessManagerAveriaFontV1';
const APP_UI_SIZE_KEY='chessManagerAveriaUISizeV1';
const APP_LANGUAGE_KEY='chessManagerAveriaLanguageV1';

const UI_FONTS={
  system:'"Segoe UI Variable","Inter","Segoe UI",Arial,sans-serif',
  arial:'Arial,Helvetica,sans-serif',
  verdana:'Verdana,Geneva,sans-serif',
  trebuchet:'"Trebuchet MS",Arial,sans-serif',
  georgia:'Georgia,"Times New Roman",serif'
};

const UI_TEXT={
  en:{
    dashboard:'Dashboard',
    players:'Players',
    pairings:'Pairings & Results',
    standings:'Standings',
    tiebreaks:'Tie-break Order',
    notation:'Notation Sheet',
    reports:'Reports',
    settings:'Settings',
    newTournament:'NEW TOURNAMENT',
    playersRoster:'PLAYERS / ROSTER',
    settingsCaps:'SETTINGS',
    tournaments:'Tournaments',
    save:'Save',
    generateNext:'Generate Next Round',
    undoLast:'Undo Last Action',
    editResults:'Edit Round Results',
    regenerate:'Regenerate Current Round',
    saveResults:'Save Results',
    printPairings:'Print Pairings'
  },
  fil:{
    dashboard:'Dashboard',
    players:'Mga Manlalaro',
    pairings:'Pairings at Resulta',
    standings:'Talaan ng Ranggo',
    tiebreaks:'Ayos ng Tie-break',
    notation:'Notation Sheet',
    reports:'Mga Ulat',
    settings:'Mga Setting',
    newTournament:'BAGONG TOURNAMENT',
    playersRoster:'MGA MANLALARO / ROSTER',
    settingsCaps:'MGA SETTING',
    tournaments:'Mga Tournament',
    save:'I-save',
    generateNext:'Gumawa ng Susunod na Round',
    undoLast:'I-undo ang Huling Aksyon',
    editResults:'Ayusin ang Resulta',
    regenerate:'Ulitin ang Kasalukuyang Round',
    saveResults:'I-save ang Resulta',
    printPairings:'I-print ang Pairings'
  }
};

function setUIFont(fontKey,{save=true,notify=true}={}){
  const key=UI_FONTS[fontKey]?fontKey:'system';
  document.documentElement.style.setProperty('--app-font',UI_FONTS[key]);
  const el=document.getElementById('settingsFont');
  if(el)el.value=key;
  if(save)try{safeStorage.setItem(APP_FONT_KEY,key);}catch(e){}
  if(notify&&typeof showToast==='function')showToast('Font preference saved.','success','Settings');
}
function setUISize(size,{save=true,notify=true}={}){
  const value=['compact','normal','large'].includes(size)?size:'normal';
  document.documentElement.setAttribute('data-ui-size',value);
  const el=document.getElementById('settingsUISize');
  if(el)el.value=value;
  if(save)try{safeStorage.setItem(APP_UI_SIZE_KEY,value);}catch(e){}
  if(notify&&typeof showToast==='function')showToast('Interface size saved.','success','Settings');
}
function applyLanguage(lang){
  const value=lang==='fil'?'fil':'en';
  const dict=UI_TEXT[value];
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.getAttribute('data-i18n');
    if(dict[key])el.textContent=dict[key];
  });
  const select=document.getElementById('settingsLanguage');
  if(select)select.value=value;
}
function setAppLanguage(lang,{save=true,notify=true}={}){
  const value=lang==='fil'?'fil':'en';
  applyLanguage(value);
  if(save)try{safeStorage.setItem(APP_LANGUAGE_KEY,value);}catch(e){}
  if(notify&&typeof showToast==='function'){
    showToast(value==='fil'?'Filipino interface selected.':'English interface selected.','success','Language');
  }
}
function settingsSetTheme(theme){
  setAppTheme(theme);
  const el=document.getElementById('settingsTheme');
  if(el)el.value=theme==='dark'?'dark':'light';
}
function syncPreferencesUI(){
  let font='system',size='normal',lang='en';
  try{
    font=safeStorage.getItem(APP_FONT_KEY)||'system';
    size=safeStorage.getItem(APP_UI_SIZE_KEY)||'normal';
    lang=safeStorage.getItem(APP_LANGUAGE_KEY)||'en';
  }catch(e){}
  setUIFont(font,{save:false,notify:false});
  setUISize(size,{save:false,notify:false});
  setAppLanguage(lang,{save:false,notify:false});
  const theme=document.documentElement.getAttribute('data-theme')||'light';
  const themeSelect=document.getElementById('settingsTheme');
  if(themeSelect)themeSelect.value=theme;
}

const APP_THEME_KEY='chessManagerAveriaThemeV1';

function getSavedAppTheme(){
  try{
    const saved=safeStorage.getItem(APP_THEME_KEY);
    return saved==='dark'?'dark':'light';
  }catch(e){
    return 'light';
  }
}

function updateThemeButtons(theme){
  const light=document.getElementById('lightThemeBtn');
  const dark=document.getElementById('darkThemeBtn');
  if(light){
    light.classList.toggle('active',theme==='light');
    light.setAttribute('aria-pressed',theme==='light'?'true':'false');
  }
  if(dark){
    dark.classList.toggle('active',theme==='dark');
    dark.setAttribute('aria-pressed',theme==='dark'?'true':'false');
  }
}

function applyAppTheme(theme,{save=false,notify=false}={}){
  const value=theme==='dark'?'dark':'light';
  document.documentElement.setAttribute('data-theme',value);
  updateThemeButtons(value);
  if(save){
    try{safeStorage.setItem(APP_THEME_KEY,value);}catch(e){}
  }
  if(notify && typeof showToast==='function'){
    showToast(`${value==='light'?'Light':'Dark'} theme applied.`,'success','Theme');
  }
}

function setAppTheme(theme){
  applyAppTheme(theme,{save:true,notify:true});
  const el=document.getElementById('settingsTheme');
  if(el)el.value=theme==='dark'?'dark':'light';
}

const BUILD12_HISTORY_KEY='chessManagerAveriaUndoHistoryV1';
let stateHistory=[];
let confirmResolver=null;

function showToast(message,type='info',title='Chess Tournament Manager'){
  const host=document.getElementById('toastContainer');
  if(!host){console.log(`[${type}] ${message}`);return;}
  const item=document.createElement('div');
  item.className=`app-toast ${type}`;
  item.innerHTML=`<strong>${esc(title)}</strong><span>${esc(message)}</span>`;
  host.appendChild(item);
  setTimeout(()=>{item.style.opacity='0';item.style.transform='translateY(6px)'},3300);
  setTimeout(()=>item.remove(),3650);
}
window.alert=(message)=>showToast(String(message||''),'info');

function appConfirm(message,{title='Confirm Action',confirmText='Confirm',danger=true}={}){
  return new Promise(resolve=>{
    const modal=document.getElementById('appConfirmModal');
    const msg=document.getElementById('appConfirmMessage');
    const ttl=document.getElementById('appConfirmTitle');
    const ok=document.getElementById('appConfirmOK');
    const cancel=document.getElementById('appConfirmCancel');
    if(!modal||!msg||!ttl||!ok||!cancel){resolve(false);return;}
    if(confirmResolver)confirmResolver(false);
    confirmResolver=resolve;
    ttl.textContent=title;msg.textContent=String(message||'');ok.textContent=confirmText;
    ok.classList.toggle('danger',danger);ok.classList.toggle('primary',!danger);
    const finish=value=>{
      modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
      const r=confirmResolver;confirmResolver=null;if(r)r(value);
    };
    ok.onclick=()=>finish(true);cancel.onclick=()=>finish(false);
    modal.onclick=e=>{if(e.target===modal)finish(false)};
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
    setTimeout(()=>cancel.focus(),25);
  });
}

function loadUndoHistory(){
  try{
    const raw=safeStorage.getItem(BUILD12_HISTORY_KEY);
    const arr=raw?JSON.parse(raw):[];
    stateHistory=Array.isArray(arr)?arr.slice(-12):[];
  }catch(e){stateHistory=[]}
  updateUndoButtons();
}
function saveUndoHistory(){try{safeStorage.setItem(BUILD12_HISTORY_KEY,JSON.stringify(stateHistory.slice(-12)))}catch(e){}}
function pushHistory(label){
  try{
    const snapshot=JSON.stringify(state);
    const last=stateHistory[stateHistory.length-1];
    if(last?.snapshot===snapshot)return;
    stateHistory.push({label:String(label||'Previous state'),at:new Date().toISOString(),snapshot});
    if(stateHistory.length>12)stateHistory=stateHistory.slice(-12);
    saveUndoHistory();updateUndoButtons();
  }catch(e){}
}
function clearUndoHistory(){stateHistory=[];saveUndoHistory();updateUndoButtons()}
function updateUndoButtons(){
  const last=stateHistory[stateHistory.length-1];
  for(const id of ['undoActionButton','undoPairingButton']){
    const btn=document.getElementById(id);if(!btn)continue;
    btn.disabled=!last;btn.title=last?`Undo: ${last.label}`:'Nothing to undo';
    btn.classList.toggle('undo-ready',!!last);
  }
}
async function undoLastAction(){
  const item=stateHistory.pop();
  if(!item){showToast('There is nothing to undo.','warning');updateUndoButtons();return}
  try{
    state=normalizeTournamentState(JSON.parse(item.snapshot));
    enforceStandardScoring(state);
    safeStorage.setItem('chessManagerAveria',JSON.stringify(state));
    if(state.settings?.tournamentStarted)saveActiveTournamentToLibrary();
    hydrateInputs();renderAll();renderModeTieBreakSelectors();updateTieBreakVisibility();
    saveUndoHistory();updateUndoButtons();
    showToast(`Undid: ${item.label}`,'success','Undo complete');
  }catch(e){showToast('Undo snapshot could not be restored.','error')}
}
