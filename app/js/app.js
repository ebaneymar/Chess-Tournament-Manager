// Chess Tournament Manager 2.0
// Common controller: save/navigation, tournament settings sync, tie-break UI.

function persist(){
  enforceStandardScoring(state);
  safeStorage.setItem('chessManagerAveria',JSON.stringify(state));
  if(state.settings?.tournamentStarted)saveActiveTournamentToLibrary();
  renderTournamentSwitcher();
  const x=document.getElementById('saveStatus');
  if(x){x.textContent='Saved';setTimeout(()=>x.textContent='Ready',900);}
}
function saveNow(){syncSettings();persist();showToast('Tournament saved. You can reopen it from Main Menu → Saved Tournaments.','success','Saved');}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function currentRound(){return state.rounds[state.rounds.length-1] || null;}
function getPlayer(id){return state.players.find(p=>p.id===id);}
function goTab(tab){
  const tournamentTabs=['dashboard','pairings','standings','tiebreaks','reports'];

  if(tournamentTabs.includes(tab) && !state.settings.tournamentStarted){
    beginNewTournament();
    return;
  }

  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===tab));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));

  const map={
    dashboard:['Tournament Dashboard','Tournament overview. Choose Pairings only when you are ready to manage a round.'],
    players:['Players / Roster','Manage the actual tournament participants.'],
    pairings:['Pairings & Results','Generate pairings, encode results, and view the live round standing.'],
    standings:['Standings','Current ranking after recorded results.'],
    tiebreaks:['Tie-break Order','Configure the ranking tie-break priority.'],
    notation:['Notation Sheet','Prepare printable chess notation sheets.'],
    reports:['Tournament Reports','Print and export tournament documents.']
  };
  const page=map[tab]||[tab,''];
  document.getElementById('pageTitle').textContent=page[0];
  const sub=document.getElementById('eventSubtitle');
  if(sub)sub.textContent=page[1];

  if(tab==='standings')renderStandings();
  if(tab==='pairings')renderPairings();
  if(tab==='reports')renderReports();
  if(tab==='tiebreaks')renderTieList();
  if(tab==='players')initRosterSchoolCascade();
}
document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)goTab(b.dataset.tab)});


function tieBreakOptionHTML(selected){
  return Object.entries(TB_LABELS).map(([key,label]) =>
    `<option value="${key}" ${key===selected?'selected':''}>${esc(label)}</option>`
  ).join('');
}

function allTieBreakKeys(){
  return Object.keys(TB_LABELS);
}
function orderedTieBreakSlots(mode){
  const active=state.tieBreaksByMode?.[mode]||[];
  const defaults=cloneDefaultTB(mode);
  const extras=allTieBreakKeys().filter(x=>!active.includes(x)&&!defaults.includes(x));
  return [...active,...defaults.filter(x=>!active.includes(x)),...extras].slice(0,8);
}
function setTieBreakCount(count){
  for(let i=1;i<=8;i++){
    const cb=document.getElementById(`tbEn${i}`);
    if(cb)cb.checked=i<=count;
  }
  applyModeTieBreaks();
}
function setWizardTieBreakCount(count){
  for(let i=1;i<=8;i++){
    const cb=document.getElementById(`wizTbEn${i}`);
    if(cb)cb.checked=i<=count;
    updateWizardTieSlot(i,false);
  }
}
function updateWizardTieSlot(i,save=false){
  const cb=document.getElementById(`wizTbEn${i}`);
  const sel=document.getElementById(`wizTb${i}`);
  if(sel)sel.disabled=cb?!cb.checked:false;
  if(save && wizardFormat)saveWizardTieBreaks(wizardFormat);
}

function renderModeTieBreakSelectors(){
  if(!state.tieBreaksByMode)ensureTieBreakState();
  const m=state.settings.mode||'';
  const active=m?(state.tieBreaksByMode[m]||[]):[];
  const slots=m?orderedTieBreakSlots(m):[];

  state.tieBreaks=[...active];

  for(let i=1;i<=8;i++){
    const el=document.getElementById(`tb${i}`);
    const cb=document.getElementById(`tbEn${i}`);
    if(el){
      el.innerHTML=m
        ? tieBreakOptionHTML(slots[i-1]||allTieBreakKeys()[i-1]||'de')
        : '<option value="">Select tournament format first</option>';
      el.disabled=!m || !cb?.checked;
    }
    if(cb){
      cb.checked=!!m && i<=active.length;
      cb.disabled=!m || m==='knockout' || m==='team';
      if(el)el.disabled=cb.disabled || !cb.checked;
    }
  }

  const title=document.getElementById('modeTieBreakTitle');
  const help=document.getElementById('modeTieBreakHelp');
  if(title)title.textContent=`${modeName(m)} Tie-break Order`;
  if(help)help.textContent=(m==='knockout')
    ? 'Knockout advances players by game result; ranking tie-break order is not used.'
    : (m==='team')
      ? 'Team ranking uses its own Match Points / Board Points rules.'
      : `Check only the tie-breaks used by this event. ${active.length} tie-break${active.length===1?' is':'s are'} currently enabled.`;

  const advTitle=document.getElementById('advancedTieTitle');
  if(advTitle)advTitle.textContent=`Tie-break Priority — ${modeName(m)}`;

  renderFormatTieBreakSummary();
  updateTieBreakVisibility();
}
function renderFormatTieBreakSummary(){
  const el=document.getElementById('formatTieBreakSummary');
  if(!el || !state.tieBreaksByMode)return;
  const short=x=>TB_LABELS[x]?.replace(' – Direct Encounter','').replace('Number of ','')||x;
  const line=(m)=>{
    const a=state.tieBreaksByMode[m]||[];
    return `<b>${modeName(m)} (${a.length} active):</b> ${a.length?a.map(short).join(' → '):'Points only / no ranking tie-break'}`;
  };
  el.innerHTML=`Saved separately: &nbsp; ${line('swiss')}<br>${line('roundrobin')}<br>${line('knockout')}`;
}
function applyModeTieBreaks(){
  const m=state.settings.mode||'';
  if(!m || m==='knockout'||m==='team')return;

  const selected=[];
  for(let i=1;i<=8;i++){
    const cb=document.getElementById(`tbEn${i}`);
    const sel=document.getElementById(`tb${i}`);
    if(sel)sel.disabled=!cb?.checked;
    if(cb?.checked && sel?.value && !selected.includes(sel.value))selected.push(sel.value);
  }

  state.tieBreaksByMode[m]=selected;
  state.tieBreaks=[...selected];

  persist();
  renderTieList();
  renderStandings();
  renderPairingsRanking();
  renderDashboard();
  renderReports();
  renderModeTieBreakSelectors();
}
function updateTieBreakVisibility(){
  const box=document.getElementById('modeTieBreakBox');
  if(!box)return;
  const m=document.getElementById('mode')?.value||state.settings.mode||'';
  const selects=box.querySelectorAll('select');
  const advancedBtn=box.querySelector('button');
  if(m==='knockout'||m==='team'){
    selects.forEach(x=>x.disabled=true);
    if(advancedBtn)advancedBtn.disabled=true;
    box.style.opacity='.68';
  }else{
    selects.forEach(x=>x.disabled=false);
    if(advancedBtn)advancedBtn.disabled=false;
    box.style.opacity='1';
  }
}

function syncSettings(){
  state.settings.name=document.getElementById('eventName').value||'Untitled Tournament';

  const modeEl=document.getElementById('mode');
  const newMode=modeEl?.value||'';
  const oldMode=state.settings.mode||'';

  if(!state.tieBreaksByMode)ensureTieBreakState();

  // Mode is selected only by the New Tournament format gate.
  // A blank selector must remain blank; never default to Swiss.
  if(newMode){
    if(oldMode && newMode!==oldMode && state.tieBreaksByMode[oldMode]){
      state.tieBreaksByMode[oldMode]=[...(state.tieBreaks||[])];
    }
    state.settings.mode=newMode;
    state.tieBreaks=[...(state.tieBreaksByMode[newMode]||cloneDefaultTB(newMode))];
  }else if(!state.settings.tournamentStarted){
    state.settings.mode='';
    state.tieBreaks=[];
  }

  state.settings.meetLevel=document.getElementById('meetLevel').value;
  state.settings.rounds=Math.max(1,+document.getElementById('rounds').value||1);
  state.settings.date=document.getElementById('eventDate').value;
  state.settings.school=document.getElementById('school').value;
  state.settings.venue=document.getElementById('venue').value;
  state.settings.chiefArbiter=document.getElementById('chiefArbiter').value;
  state.settings.tournamentDirector=document.getElementById('tournamentDirector').value;
  state.settings.timeControl=document.getElementById('timeControl').value;
  enforceStandardScoring(state);

  persist();
  renderAll();
  renderModeTieBreakSelectors();
}
function hydrateInputs(){
  const s=state.settings;
  eventName.value=s.name; mode.value=s.tournamentStarted?(s.mode||''):''; meetLevel.value=s.meetLevel||'municipal'; rounds.value=s.rounds; eventDate.value=s.date||''; school.value=s.school||''; venue.value=s.venue||''; chiefArbiter.value=s.chiefArbiter||s.arbiter||''; tournamentDirector.value=s.tournamentDirector||'John Vincent A. Averia'; timeControl.value=s.timeControl||'';
  enforceStandardScoring(state);
}

// Nationwide DepEd school baseline embedded for offline lookup.
// Source dataset: SY 2020-2021 DepEd Schools Masterlist (60,924 rows).
// Fields kept in this app: School ID, School Name, Municipality/City, Division, Region.
