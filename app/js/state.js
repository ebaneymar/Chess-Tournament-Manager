// Chess Tournament Manager 2.0
// State, persistence, saved-tournament workspace, and shared tournament state.

// Safe storage wrapper.
// Desktop edition: use the Electron main-process JSON store when available.
// Browser/local HTML fallback is retained for development and emergency portability.
const safeStorage=(()=>{
  if(window.desktopStore && typeof window.desktopStore.getItem==='function'){
    return {
      getItem:key=>window.desktopStore.getItem(String(key)),
      setItem:(key,value)=>window.desktopStore.setItem(String(key),String(value)),
      removeItem:key=>window.desktopStore.removeItem(String(key)),
      clear:()=>window.desktopStore.clear()
    };
  }

  const memory={};
  const fallback={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value)},
    removeItem:key=>{delete memory[key]},
    clear:()=>{Object.keys(memory).forEach(k=>delete memory[k])}
  };

  try{
    const store=window.localStorage;
    const probe='__chess_manager_storage_test__';
    store.setItem(probe,'1');
    store.removeItem(probe);
    return store;
  }catch(e){
    return fallback;
  }
})();

const TB_LABELS = {
  de:'DE – Direct Encounter',
  buchholzCut1:'Buchholz Cut 1 (BH-C1)',
  buchholzMedian1:'Buchholz Median-1 (BH-M1)',
  buchholzMedian2:'Buchholz Median-2 (BH-M2)',
  buchholz:'Buchholz (BH)',
  sb:'Sonneborn-Berger',
  wins:'Number of Wins',
  blackWins:'Black Wins',
  cumulative:'Cumulative Score',
  rating:'Starting Rating'
};

const DEFAULT_TB_BY_MODE = {
  swiss:['de','buchholzCut1','buchholz','wins','blackWins','sb','cumulative','rating'],
  roundrobin:['de','wins','sb','blackWins','cumulative','rating','buchholzCut1','buchholz'],
  knockout:[],
  team:[]
};
function cloneDefaultTB(mode){
  return [...(DEFAULT_TB_BY_MODE[mode] || DEFAULT_TB_BY_MODE.swiss)];
}
function modeName(mode){
  return mode==='swiss' ? 'Swiss System'
    : mode==='roundrobin' ? 'Round Robin'
    : mode==='knockout' ? 'Knockout'
    : mode==='team' ? 'Team Tournament'
    : 'Not Selected';
}
function ensureTieBreakState(){
  if(!state.tieBreaksByMode){
    state.tieBreaksByMode={
      swiss:cloneDefaultTB('swiss'),
      roundrobin:cloneDefaultTB('roundrobin'),
      knockout:[],
      team:[]
    };
  }
  ['swiss','roundrobin','knockout','team'].forEach(m=>{
    if(!Array.isArray(state.tieBreaksByMode[m])) state.tieBreaksByMode[m]=cloneDefaultTB(m);
  });
  const m=state.settings?.mode||'';
  state.tieBreaks=m?[...(state.tieBreaksByMode[m]||cloneDefaultTB(m))]:[];
}
function saveActiveTieBreaks(){
  if(!state.tieBreaksByMode)return;
  const m=state.settings?.mode||'';
  if(!['swiss','roundrobin','knockout','team'].includes(m))return;
  state.tieBreaksByMode[m]=[...(state.tieBreaks||[])];
}


function enforceStandardScoring(target){
  if(!target)return;
  if(!target.settings)target.settings={};
  // Stored numerically for calculation; displayed as ½ in the UI/reports.
  target.settings.scoring={win:1,draw:0.5,loss:0,bye:1};
}

const defaultState = () => ({
  settings:{
    name:'School Chess Championship', mode:'', tournamentStarted:false, rounds:5, date:new Date().toISOString().slice(0,10),
    school:'______________________________', schoolId:'', schoolTown:'', schoolDivision:'', schoolRegion:'', meetLevel:'municipal', venue:'School Activity Area', chiefArbiter:'', tournamentDirector:'John Vincent A. Averia', timeControl:'10+0', tournamentCategory:'Elementary Boys',
    scoring:{win:1,draw:.5,loss:0,bye:1}
  },
  players:[],
  rounds:[],
  tieBreaksByMode:{
    swiss:cloneDefaultTB('swiss'),
    roundrobin:cloneDefaultTB('roundrobin'),
    knockout:[],
    team:[]
  },
  tieBreaks:cloneDefaultTB('swiss')
});
let state = loadState();

function loadState(){
  try{
    const s=JSON.parse(safeStorage.getItem('chessManagerAveria'));
    if(s && s.settings){
      (s.players||[]).forEach(p=>{
        if(typeof p.unrated==='undefined') p.unrated=false;
        if(typeof p.schoolId==='undefined') p.schoolId='';
        if(typeof p.school==='undefined') p.school=p.team||'';
        if(typeof p.town==='undefined') p.town='';
        if(typeof p.division==='undefined') p.division='';
        if(typeof p.region==='undefined') p.region='';
        if(typeof p.lastName==='undefined')p.lastName='';
        if(typeof p.firstName==='undefined')p.firstName='';
        if(typeof p.middleInitial==='undefined')p.middleInitial='';
      });

      // Migrate older tournament files that had only one global tie-break list.
      if(!s.tieBreaksByMode){
        const currentMode=s.settings.mode||'';
        s.tieBreaksByMode={
          swiss:cloneDefaultTB('swiss'),
          roundrobin:cloneDefaultTB('roundrobin'),
          knockout:[]
        };
        if(Array.isArray(s.tieBreaks) && ['swiss','roundrobin'].includes(currentMode)){
          s.tieBreaksByMode[currentMode]=[...s.tieBreaks];
        }
      }
      if(typeof s.settings.tournamentStarted==='undefined') s.settings.tournamentStarted=Array.isArray(s.rounds)&&s.rounds.length>0;
      if(typeof s.settings.chiefArbiter==='undefined') s.settings.chiefArbiter=s.settings.arbiter||'';
      if(typeof s.settings.tournamentDirector==='undefined') s.settings.tournamentDirector='John Vincent A. Averia';
      if(typeof s.settings.tournamentCategory==='undefined') s.settings.tournamentCategory='Elementary Boys';
      if(typeof s.settings.entryType==='undefined') s.settings.entryType='open';
      if(typeof s.settings.finalTieResolution==='undefined') s.settings.finalTieResolution='ranking';
      if(typeof s.settings.swissVariant==='undefined') s.settings.swissVariant='flexible';
      if(typeof s.settings.teamFormat==='undefined') s.settings.teamFormat='swiss';
      if(typeof s.settings.teamBoards==='undefined') s.settings.teamBoards=4;
      if(typeof s.settings.teamMatchWin==='undefined') s.settings.teamMatchWin=2;
      if(typeof s.settings.teamMatchDraw==='undefined') s.settings.teamMatchDraw=1;
      ['swiss','roundrobin','knockout','team'].forEach(m=>{
        if(!Array.isArray(s.tieBreaksByMode[m]))s.tieBreaksByMode[m]=cloneDefaultTB(m);
      });
      {
        const restoredMode=s.settings.mode||'';
        s.tieBreaks=['swiss','roundrobin','knockout','team'].includes(restoredMode)
          ? [...(s.tieBreaksByMode[restoredMode]||cloneDefaultTB(restoredMode))]
          : [];
      }
      enforceStandardScoring(s);
      return s;
    }
    return defaultState();
  }catch(e){return defaultState();}
}


const LEGACY_TOURNAMENT_LIBRARY_KEY='chessManagerAveriaTournamentLibrary';
const MEET_WORKSPACE_KEY='chessManagerAveriaMeetWorkspaceV3';

function deepCloneState(s){
  return JSON.parse(JSON.stringify(s));
}
function newTournamentId(){
  return 't_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
}
function normalizeTournamentState(st){
  if(!st || !st.settings)return defaultState();
  if(!st.settings.tournamentId)st.settings.tournamentId=newTournamentId();
  if(typeof st.settings.tournamentCategory==='undefined')st.settings.tournamentCategory='Open';
  if(typeof st.settings.tournamentStarted==='undefined')st.settings.tournamentStarted=Array.isArray(st.rounds)&&st.rounds.length>0;
  if(!Array.isArray(st.players))st.players=[];
  if(!Array.isArray(st.rounds))st.rounds=[];
  if(!st.tieBreaksByMode){
    st.tieBreaksByMode={
      swiss:cloneDefaultTB('swiss'),
      roundrobin:cloneDefaultTB('roundrobin'),
      knockout:[],
      team:[]
    };
  }
  ['swiss','roundrobin','knockout','team'].forEach(m=>{
    if(!Array.isArray(st.tieBreaksByMode[m]))st.tieBreaksByMode[m]=cloneDefaultTB(m);
  });
  st.tieBreaks=st.settings.mode
    ? [...(st.tieBreaksByMode[st.settings.mode]||cloneDefaultTB(st.settings.mode))]
    : [];
  enforceStandardScoring(st);
  return st;
}

function emptyWorkspace(){
  return {version:3,activeTournamentId:null,tournaments:{}};
}
function readWorkspaceRaw(){
  try{
    const ws=JSON.parse(safeStorage.getItem(MEET_WORKSPACE_KEY));
    if(ws && ws.version===3 && ws.tournaments && typeof ws.tournaments==='object')return ws;
  }catch(e){}
  return null;
}
function writeWorkspace(ws){
  safeStorage.setItem(MEET_WORKSPACE_KEY,JSON.stringify(ws));
}
function migrateLegacyWorkspace(){
  const ws=emptyWorkspace();

  // Import every tournament from the older library, if present.
  try{
    const oldLib=JSON.parse(safeStorage.getItem(LEGACY_TOURNAMENT_LIBRARY_KEY));
    if(Array.isArray(oldLib)){
      for(const entry of oldLib){
        if(!entry?.state?.settings)continue;
        const st=normalizeTournamentState(deepCloneState(entry.state));
        const id=st.settings.tournamentId||entry.id||newTournamentId();
        st.settings.tournamentId=id;
        ws.tournaments[id]=st;
      }
    }
  }catch(e){}

  // Also import the legacy active tournament.
  try{
    const active=JSON.parse(safeStorage.getItem('chessManagerAveria'));
    if(active?.settings?.tournamentStarted){
      const st=normalizeTournamentState(deepCloneState(active));
      const id=st.settings.tournamentId||newTournamentId();
      st.settings.tournamentId=id;
      ws.tournaments[id]=st;
      ws.activeTournamentId=id;
    }
  }catch(e){}

  writeWorkspace(ws);
  return ws;
}
function getMeetWorkspace(){
  return readWorkspaceRaw() || migrateLegacyWorkspace();
}
function saveMeetWorkspace(ws){
  writeWorkspace(ws);
}
function ensureTournamentId(){
  if(!state.settings.tournamentId)state.settings.tournamentId=newTournamentId();
  return state.settings.tournamentId;
}
function tournamentLibraryTitle(st){
  const cat=st?.settings?.tournamentCategory||'Open';
  const name=st?.settings?.name||'Chess Tournament';
  return `${cat} — ${name}`;
}
function workspaceTournamentArray(){
  const ws=getMeetWorkspace();
  return Object.entries(ws.tournaments)
    .map(([id,st])=>({id,state:st}))
    .sort((a,b)=>{
      const ad=a.state?.settings?.updatedAt||'';
      const bd=b.state?.settings?.updatedAt||'';
      return String(bd).localeCompare(String(ad));
    });
}
function getTournamentLibrary(){
  return workspaceTournamentArray().map(({id,state:st})=>({
    id,
    savedAt:st.settings.updatedAt||'',
    category:st.settings.tournamentCategory||'Open',
    name:st.settings.name||'Chess Tournament',
    mode:st.settings.mode||'',
    rounds:st.rounds?.length||0,
    totalRounds:st.settings.rounds||0,
    players:st.players?.length||0,
    state:deepCloneState(st)
  }));
}
function setTournamentLibrary(lib){
  const ws=getMeetWorkspace();
  ws.tournaments={};
  for(const item of lib||[]){
    if(!item?.state?.settings)continue;
    const st=normalizeTournamentState(deepCloneState(item.state));
    const id=item.id||st.settings.tournamentId||newTournamentId();
    st.settings.tournamentId=id;
    ws.tournaments[id]=st;
  }
  if(ws.activeTournamentId && !ws.tournaments[ws.activeTournamentId])ws.activeTournamentId=null;
  saveMeetWorkspace(ws);
}
function saveActiveTournamentToLibrary(){
  if(!state.settings?.tournamentStarted)return;
  const id=ensureTournamentId();
  state.settings.updatedAt=new Date().toISOString();

  const ws=getMeetWorkspace();
  ws.tournaments[id]=deepCloneState(state);
  ws.activeTournamentId=id;
  saveMeetWorkspace(ws);

  // Keep legacy active-state storage only for backward compatibility.
  safeStorage.setItem('chessManagerAveria',JSON.stringify(state));

  renderSavedTournaments();
  renderTournamentSwitcher();
}
function renderSavedTournaments(){
  const box=document.getElementById('savedTournamentList');
  const count=document.getElementById('savedTournamentCount');
  if(!box)return;

  const ws=getMeetWorkspace();
  const lib=workspaceTournamentArray();
  if(count)count.textContent=lib.length;

  if(!lib.length){
    box.innerHTML='<div class="saved-tournament-empty">No tournaments yet. You can create Elementary Boys, Elementary Girls, Secondary Boys, Secondary Girls, University, Open, and more in the same meet.</div>';
    return;
  }

  box.innerHTML=lib.map(({id,state:st})=>{
    const s=st.settings||{};
    const active=ws.activeTournamentId===id;
    const mode=modeName(s.mode);
    const round=(st.rounds||[]).length;
    const total=s.rounds||0;
    const playerCount=(st.players||[]).length;
    const time=s.timeControl||'—';

    return `<div class="saved-tournament-item ${active?'active-tournament-card':''}">
      <div>
        <div class="title">${active?'<span class="active-dot"></span>':''}${esc(s.tournamentCategory||'Open')}</div>
        <div class="meta">${esc(s.name||'Chess Tournament')} • ${esc(mode)} • Round ${round}/${total} • ${playerCount} player(s) • ${esc(time)}</div>
      </div>
      <div class="saved-tournament-actions">
        <button class="btn small primary" onclick="openSavedTournament('${esc(id)}')">${active?'Open Dashboard':'Open Dashboard'}</button>
        <button class="btn small" onclick="duplicateSavedTournament('${esc(id)}')">Duplicate</button>
        <button class="btn small danger" onclick="deleteSavedTournament('${esc(id)}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function renderTournamentSwitcher(){
  const sel=document.getElementById('activeTournamentSwitcher');
  if(!sel)return;

  const ws=getMeetWorkspace();
  const lib=workspaceTournamentArray();
  if(!lib.length){
    sel.innerHTML='<option value="">No tournaments created</option>';
    sel.value='';
    return;
  }

  sel.innerHTML='<option value="">Switch tournament → Dashboard</option>'+lib.map(({id,state:st})=>{
    const s=st.settings||{};
    const round=(st.rounds||[]).length;
    const total=s.rounds||0;
    return `<option value="${esc(id)}">${esc(s.tournamentCategory||'Open')} — R${round}/${total}</option>`;
  }).join('');

  if(ws.activeTournamentId && ws.tournaments[ws.activeTournamentId]){
    sel.value=ws.activeTournamentId;
  }
}
function switchTournamentFromSelect(id){
  if(!id)return;
  openSavedTournament(id);
}
function openSavedTournament(id){
  // Save whatever tournament is currently active before switching.
  if(state.settings?.tournamentStarted)saveActiveTournamentToLibrary();

  const ws=getMeetWorkspace();
  const saved=ws.tournaments[id];
  if(!saved){alert('Saved tournament could not be opened.');return;}

  state=normalizeTournamentState(deepCloneState(saved));
  clearUndoHistory();
  ws.activeTournamentId=id;
  saveMeetWorkspace(ws);
  safeStorage.setItem('chessManagerAveria',JSON.stringify(state));

  hydrateInputs();
  renderAll();
  renderModeTieBreakSelectors();
  updateTieBreakVisibility();
  renderTournamentSwitcher();
  hideHomeScreen();
  // Opening or switching a tournament always lands on its Dashboard.
  // Pairings opens only when the organizer explicitly chooses Pairings & Results.
  goTab('dashboard');
  showToast('Tournament opened on Dashboard. Pairings will open only when you choose Pairings & Results.','success','Tournament opened');
}
async function deleteSavedTournament(id){
  const ws=getMeetWorkspace();
  const st=ws.tournaments[id];
  if(!st)return;

  const label=st.settings?.tournamentCategory||'this tournament';
  if(!await appConfirm(`Delete saved tournament "${label}"? This deletes only this category/event.`,{title:'Delete Tournament',confirmText:'Delete'}))return;

  delete ws.tournaments[id];
  if(ws.activeTournamentId===id)ws.activeTournamentId=null;
  saveMeetWorkspace(ws);

  if(state.settings?.tournamentId===id){
    state=defaultState();
    safeStorage.setItem('chessManagerAveria',JSON.stringify(state));
    hydrateInputs();
    renderAll();
    renderModeTieBreakSelectors();
  }

  renderSavedTournaments();
  renderTournamentSwitcher();
}
function duplicateSavedTournament(id){
  const ws=getMeetWorkspace();
  const original=ws.tournaments[id];
  if(!original)return;

  const copyState=normalizeTournamentState(deepCloneState(original));
  const newId=newTournamentId();
  copyState.settings.tournamentId=newId;
  copyState.settings.name=(copyState.settings.name||'Chess Tournament')+' Copy';
  copyState.settings.updatedAt=new Date().toISOString();

  ws.tournaments[newId]=copyState;
  saveMeetWorkspace(ws);
  renderSavedTournaments();
  renderTournamentSwitcher();
}
function migrateCurrentTournamentToLibrary(){
  const ws=getMeetWorkspace();

  if(state.settings?.tournamentStarted){
    const id=ensureTournamentId();
    state.settings.updatedAt=state.settings.updatedAt||new Date().toISOString();
    ws.tournaments[id]=deepCloneState(state);
    ws.activeTournamentId=id;
    saveMeetWorkspace(ws);
  } else if(ws.activeTournamentId && ws.tournaments[ws.activeTournamentId]){
    // If an active tournament exists in the workspace, reopen it as the active state.
    state=normalizeTournamentState(deepCloneState(ws.tournaments[ws.activeTournamentId]));
    safeStorage.setItem('chessManagerAveria',JSON.stringify(state));
  }

  renderSavedTournaments();
  renderTournamentSwitcher();
}
