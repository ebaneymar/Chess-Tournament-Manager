// Chess Tournament Manager 2.0
// Main Menu, Settings modal, New Tournament wizard, tournament creation.

function hideHomeScreen(){
  const h=document.getElementById('homeScreen');
  if(h)h.classList.add('hidden');
}
function showHomeScreen(){
  closeTournamentWizard?.();
  renderSavedTournaments();
  const h=document.getElementById('homeScreen');
  if(h)h.classList.remove('hidden');
}


function createFreshTournamentDraftFromCurrent(){
  const previous=state?.settings||{};
  const fresh=defaultState();

  // Carry only meet-wide convenience information.
  fresh.settings.name=previous.name||'School Chess Championship';
  fresh.settings.date=previous.date||new Date().toISOString().slice(0,10);
  fresh.settings.venue=previous.venue||'School Activity Area';
  fresh.settings.chiefArbiter=previous.chiefArbiter||'';
  fresh.settings.tournamentDirector=previous.tournamentDirector||'John Vincent A. Averia';
  fresh.settings.meetLevel=previous.meetLevel||'municipal';
  fresh.settings.school=previous.school||'';
  fresh.settings.schoolId=previous.schoolId||'';
  fresh.settings.schoolTown=previous.schoolTown||'';
  fresh.settings.schoolDivision=previous.schoolDivision||'';
  fresh.settings.schoolRegion=previous.schoolRegion||'';
  fresh.settings.timeControl=previous.timeControl||'10+0';

  // Tournament-specific information is ALWAYS blank.
  fresh.settings.tournamentId='';
  fresh.settings.tournamentStarted=false;
  fresh.settings.mode='';
  fresh.players=[];
  fresh.rounds=[];
  fresh.tieBreaks=[];
  enforceStandardScoring(fresh);
  return fresh;
}

function beginNewTournament(){
  // Save the event currently being managed.
  if(state.settings?.tournamentStarted)saveActiveTournamentToLibrary();

  // Keep it only so Cancel can restore it.
  wizardPreviousState=JSON.stringify(state);

  // Fresh draft means persisted format/roster can never auto-skip Step 1.
  state=createFreshTournamentDraftFromCurrent();
  clearUndoHistory();

  wizardFormat=null;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;

  hydrateInputs();
  resetWizardFormatSelection();

  const wizard=document.getElementById('tournamentWizard');
  if(!wizard){
    alert('New Tournament window could not be opened.');
    return;
  }

  hideHomeScreen();
  wizard.classList.add('show');
  wizardGo(1);
}

function returnToFormatSelection(){
  wizardFormat=null;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;
  state.settings.mode='';
  state.tieBreaks=[];
  resetWizardFormatSelection();
  wizardGo(1);
}

function homeStartTournament(){
  beginNewTournament();
}

let settingsOpenedFromHome=false;

function openSettingsPanel(event,fromHome=false){
  if(event){
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
  }

  const home=document.getElementById('homeScreen');
  settingsOpenedFromHome=!!fromHome || !!(home && !home.classList.contains('hidden'));

  // Settings does not hide Home and does not call goTab().
  const modal=document.getElementById('settingsModal');
  if(!modal)return;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('settings-modal-open');

  syncPreferencesUI();

  setTimeout(()=>{
    const first=document.getElementById('settingsTheme');
    if(first)first.focus();
  },30);
}

function closeSettingsPanel(){
  const modal=document.getElementById('settingsModal');
  if(modal){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }
  document.body.classList.remove('settings-modal-open');
  settingsOpenedFromHome=false;
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && document.getElementById('settingsModal')?.classList.contains('show')){
    e.preventDefault();
    closeSettingsPanel();
  }
});

function homeOpenPlayers(){
  hideHomeScreen();
  goTab('players');
}
function homeOpenSettings(){
  openSettingsPanel(null,true);
}
function exitProgram(){
  // Browsers usually only allow window.close() for windows opened by script.
  try{ window.close(); }catch(e){}
  setTimeout(()=>{
    const h=document.getElementById('homeScreen');
    if(h){
      h.innerHTML=`<div class="home-panel">
        <div class="home-mark">♞</div>
        <h1>You may close this tab now.</h1>
        <div class="subtitle">Your tournament data is saved on this device.</div>
        <button class="btn primary" onclick="location.reload()">Return to Program</button>
      </div>`;
    }
  },150);
}

let wizardFormat = null;
let wizardPreviousState = null;
let wizardFormatConfirmed = false;
let wizardFormatConfigured = false;

function openTournamentWizard(){
  beginNewTournament();
}
function closeTournamentWizard(){
  document.getElementById('tournamentWizard').classList.remove('show');
}
function cancelTournamentWizard(){
  closeTournamentWizard();

  if(wizardPreviousState){
    try{
      state=normalizeTournamentState(JSON.parse(wizardPreviousState));
      hydrateInputs();
      renderAll();
      renderModeTieBreakSelectors();
      updateTieBreakVisibility();
    }catch(e){}
  }

  wizardPreviousState=null;
  wizardFormat=null;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;
  showHomeScreen();
}
function wizardGo(step){
  step=Math.max(1,Math.min(4,Number(step)||1));

  // Step 2 needs a confirmed format.
  if(step>=2 && (!wizardFormat || !wizardFormatConfirmed)){
    step=1;
  }

  // Roster/Review cannot be reached until Step 2 was saved.
  if(step>=3 && !wizardFormatConfigured){
    step=2;
  }

  const wizard=document.getElementById('tournamentWizard');
  if(!wizard)return;
  wizard.setAttribute('data-step',String(step));

  [1,2,3,4].forEach(n=>{
    const panel=document.getElementById(`wizardStep${n}`);
    if(panel)panel.style.display=n===step?'block':'none';
  });

  const labels={
    1:'Step 1 of 4 — SELECT TOURNAMENT FORMAT',
    2:'Step 2 of 4 — FORMAT SETUP + PARTICIPANTS',
    3:'Step 3 of 4 — ROSTER & ROUND CHECK',
    4:'Step 4 of 4 — REVIEW & CREATE TOURNAMENT'
  };
  const stepText=document.getElementById('wizardStepText');
  if(stepText)stepText.textContent=labels[step];

  if(step===1){
    document.querySelectorAll('.wizard-format-card').forEach(card=>{
      card.classList.toggle('selected',!!wizardFormat && card.dataset.wizardFormat===wizardFormat);
    });
    const label=document.getElementById('wizardSelectedFormatText');
    if(label)label.textContent=wizardFormat?modeName(wizardFormat):'None — select a format above';
    const btn=document.getElementById('wizardFormatContinue');
    if(btn)btn.disabled=!wizardFormat;
  }

  if(step===2 && wizardFormat){
    const badge=document.getElementById('wizardFormatBadge');
    if(badge)badge.textContent=modeName(wizardFormat).toUpperCase();
    toggleWizardPlayerRating();
    initWizardSchoolCascade();
    renderWizardParticipantCountPanel();
  }

  if(step===3){
    renderWizardRoster();
    renderWizardParticipantCountPanel();
  }

  if(step===4)renderWizardReview();

  const content=wizard.querySelector('.modal-content');
  if(content)content.scrollTop=0;
}
function resetWizardFormatSelection(){
  wizardFormat=null;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;

  document.querySelectorAll('.wizard-format-card').forEach(c=>c.classList.remove('selected'));

  const label=document.getElementById('wizardSelectedFormatText');
  if(label)label.textContent='None — select a format above';

  const btn=document.getElementById('wizardFormatContinue');
  if(btn)btn.disabled=true;

  const badge=document.getElementById('wizardFormatBadge');
  if(badge)badge.textContent='FORMAT NOT SELECTED';
}
function chooseWizardFormat(format){
  if(!['swiss','roundrobin','knockout','team'].includes(format))return;

  wizardFormat=format;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;

  document.querySelectorAll('.wizard-format-card').forEach(card=>{
    card.classList.toggle('selected',card.dataset.wizardFormat===format);
  });

  const label=document.getElementById('wizardSelectedFormatText');
  if(label)label.textContent=modeName(format);

  const btn=document.getElementById('wizardFormatContinue');
  if(btn)btn.disabled=false;
}
function confirmWizardFormatSelection(){
  if(!wizardFormat){
    alert('Select Swiss, Round Robin, Knockout, or Team Tournament first.');
    wizardGo(1);
    return;
  }

  wizardFormatConfirmed=true;
  wizardFormatConfigured=false;

  const badge=document.getElementById('wizardFormatBadge');
  if(badge)badge.textContent=modeName(wizardFormat).toUpperCase();

  renderWizardFormatOptions(wizardFormat);
  wizardGo(2);
}
function wizardTieSelect(id, selected){
  return `<select id="${id}">${Object.entries(TB_LABELS).map(([k,v])=>`<option value="${k}" ${k===selected?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
}


function commonEventOptionsHTML(){
  const category=state.settings.tournamentCategory||'Elementary Boys';
  const tc=state.settings.timeControl||'10+0';
  const entry=state.settings.entryType||'open';
  const finalTie=state.settings.finalTieResolution||'ranking';
  const ratingMin=state.settings.ratingMin??0;
  const ratingMax=state.settings.ratingMax??3000;

  const categories=[
    'Elementary Boys',
    'Elementary Girls',
    'Secondary Boys',
    'Secondary Girls',
    'University / College Men',
    'University / College Women',
    'University / College Open',
    'Open'
  ];

  const timeControls=[
    'No Clock','60+0','45+15','30+0','25+5','15+10',
    '10+5','10+0','5+3','5+0','3+2','3+0','1+0'
  ];

  return `
    <hr style="margin:18px 0">
    <h3>Event Category & Tournament Rules</h3>
    <div class="form-row">
      <div class="field wide">
        <label>Tournament Category</label>
        <select id="wizTournamentCategory">
          ${categories.map(x=>`<option value="${esc(x)}" ${x===category?'selected':''}>${esc(x)}</option>`).join('')}
        </select>
      </div>

      <div class="field wide">
        <label>Time Control</label>
        <select id="wizTimeControl">
          ${timeControls.map(x=>`<option value="${esc(x)}" ${x===tc?'selected':''}>${esc(x)}</option>`).join('')}
        </select>
        <div class="help" style="margin-top:5px">Choose <b>No Clock</b> if chess clocks are not being used.</div>
      </div>

      <div class="field wide">
        <label>Entry / Eligibility Type</label>
        <select id="wizEntryType" onchange="toggleWizardRatingRestriction()">
          <option value="open" ${entry==='open'?'selected':''}>Open</option>
          <option value="invitational" ${entry==='invitational'?'selected':''}>Invitational</option>
          <option value="rating" ${entry==='rating'?'selected':''}>Rating-Restricted</option>
        </select>
      </div>

      <div class="field wide">
        <label>Final Tie Resolution</label>
        <select id="wizFinalTie">
          <option value="ranking" ${finalTie==='ranking'?'selected':''}>Use selected ranking tie-breaks</option>
          <option value="rapid" ${finalTie==='rapid'?'selected':''}>Rapid playoff</option>
          <option value="blitz" ${finalTie==='blitz'?'selected':''}>Blitz playoff</option>
          <option value="armageddon" ${finalTie==='armageddon'?'selected':''}>Armageddon if still tied</option>
        </select>
      </div>

      <div class="field" id="wizRatingMinWrap" style="${entry==='rating'?'':'display:none'}">
        <label>Minimum Rating</label>
        <input id="wizRatingMin" type="number" min="0" value="${ratingMin}">
      </div>
      <div class="field" id="wizRatingMaxWrap" style="${entry==='rating'?'':'display:none'}">
        <label>Maximum Rating</label>
        <input id="wizRatingMax" type="number" min="0" value="${ratingMax}">
      </div>
    </div>`;
}

function toggleWizardRatingRestriction(){
  const active=document.getElementById('wizEntryType')?.value==='rating';
  const minWrap=document.getElementById('wizRatingMinWrap');
  const maxWrap=document.getElementById('wizRatingMaxWrap');
  if(minWrap)minWrap.style.display=active?'':'none';
  if(maxWrap)maxWrap.style.display=active?'':'none';
}

function saveCommonEventOptions(){
  const cat=document.getElementById('wizTournamentCategory');
  const tc=document.getElementById('wizTimeControl');
  const entry=document.getElementById('wizEntryType');
  const finalTie=document.getElementById('wizFinalTie');
  const min=document.getElementById('wizRatingMin');
  const max=document.getElementById('wizRatingMax');

  state.settings.tournamentCategory=cat?.value||'Open';
  state.settings.timeControl=tc?.value||'10+0';
  state.settings.entryType=entry?.value||'open';
  state.settings.finalTieResolution=finalTie?.value||'ranking';

  if(state.settings.entryType==='rating'){
    state.settings.ratingMin=Math.max(0,+min?.value||0);
    state.settings.ratingMax=Math.max(state.settings.ratingMin,+max?.value||3000);
  }else{
    delete state.settings.ratingMin;
    delete state.settings.ratingMax;
  }

  enforceStandardScoring(state);
}


function fideSwissBaselineRounds(playerCount){
  const n=Math.max(0,Math.floor(Number(playerCount)||0));
  if(n<2)return null;

  // Theoretical Swiss baseline from the FIDE Arbiters' Manual:
  // T >= log2(N) theoretically removes ties for first place.
  return Math.max(1,Math.ceil(Math.log2(n)));
}

function recommendedSwissRounds(playerCount){
  const n=Math.max(0,Math.floor(Number(playerCount)||0));
  if(n<2)return null;

  const baseline=fideSwissBaselineRounds(n);

  // Manager recommendation:
  // add one practical separation round beyond the theoretical baseline,
  // while respecting the no-repeat-opponent limit.
  const uniqueOpponentLimit=n-1;
  return Math.max(1,Math.min(15,baseline+1,uniqueOpponentLimit));
}
function swissRoundRange(playerCount){
  const baseline=fideSwissBaselineRounds(playerCount);
  const suggested=recommendedSwissRounds(playerCount);
  if(!baseline||!suggested)return null;
  return {baseline,suggested};
}
function updateSwissRoundRecommendation(){
  const roundsEl=document.getElementById('wizSwissRounds');
  const roundsDisplay=document.getElementById('wizSwissRoundsDisplay');
  const roundsStatus=document.getElementById('wizSwissRoundsStatus');
  const main=document.getElementById('swissRoundRecommendationMain');
  const help=document.getElementById('swissRoundRecommendationHelp');
  const box=document.getElementById('swissRoundRecommendation');
  const actualLabel=document.getElementById('wizSwissActualParticipants');

  const n=state.players.length;
  if(actualLabel)actualLabel.textContent=String(n);

  const baseline=fideSwissBaselineRounds(n);
  const decided=recommendedSwissRounds(n);

  if(!baseline || !decided){
    state.settings.rounds=0;
    if(roundsEl)roundsEl.value='0';
    if(roundsDisplay)roundsDisplay.textContent='—';
    if(roundsStatus)roundsStatus.textContent='Waiting for roster';
    if(main)main.textContent=`${n} actual player${n===1?'':'s'} registered — add at least 2.`;
    if(help)help.textContent='The FIDE theoretical baseline and manager recommendation will appear after actual players are added.';
    if(box)box.classList.remove('match','diff');
    return;
  }

  // The manager automatically uses the practical recommendation.
  state.settings.rounds=decided;
  if(roundsEl)roundsEl.value=String(decided);
  if(roundsDisplay)roundsDisplay.textContent=String(decided);
  if(roundsStatus)roundsStatus.textContent='manager recommendation selected';

  if(main){
    main.innerHTML=`
      <div class="round-decision-lines">
        <div><span>Actual roster</span><strong>${n} players</strong></div>
        <div><span>FIDE theoretical baseline</span><strong>${baseline} round${baseline===1?'':'s'}</strong></div>
        <div class="recommended"><span>Manager recommendation</span><strong>${decided} round${decided===1?'':'s'}</strong></div>
      </div>`;
  }

  if(help){
    help.textContent=`Basis: ceil(log₂(${n})) = ${baseline}. The manager adds one practical separation round, capped at ${n-1} unique opponent${n-1===1?'':'s'}.`;
  }

  if(box){
    box.classList.remove('diff');
    box.classList.add('match');
  }
}
function useSwissRecommendedRounds(){
  updateSwissRoundRecommendation();
  renderWizardParticipantCountPanel();
}

function openWizardAddPlayerModal(){
  const modal=document.getElementById('wizardAddPlayerModal');
  if(!modal){
    alert('Add Player window could not be opened.');
    return;
  }

  // Ensure it is a top-level child so no parent stacking context can hide it.
  if(modal.parentElement!==document.body)document.body.appendChild(modal);

  modal.classList.add('show');
  modal.style.display='flex';
  modal.style.zIndex='420';
  modal.setAttribute('aria-hidden','false');

  toggleWizardPlayerRating();
  initWizardSchoolCascade();
  setTimeout(()=>document.getElementById('wizPlayerLastName')?.focus(),50);
}
function closeWizardAddPlayerModal(){
  const modal=document.getElementById('wizardAddPlayerModal');
  if(!modal)return;
  modal.classList.remove('show');
  modal.style.display='none';
  modal.setAttribute('aria-hidden','true');
}
function addWizardPlayerFromModal(){
  const before=state.players.length;
  addWizardPlayer();
  if(state.players.length>before){
    closeWizardAddPlayerModal();
    renderWizardParticipantCountPanel();
  }
}

function renderCompactWizardRosterPreview(){
  const box=document.getElementById('wizardCompactRosterPreview');
  if(!box)return;

  if(!state.players.length){
    box.innerHTML='<div class="compact-roster-empty">No participants added yet.</div>';
    return;
  }

  const preview=state.players.slice(0,6);
  box.innerHTML=`
    <div class="compact-roster-head">
      <b>Current participants</b>
      <span>${state.players.length} total</span>
    </div>
    <div class="compact-roster-list">
      ${preview.map((p,i)=>`
        <div class="compact-roster-row">
          <span class="compact-roster-no">${i+1}</span>
          <span class="compact-roster-person">
            <b>${esc(p.name)}</b>
            <small>${esc(compactDelegationLabel(p)||p.school||'')} · ${ratingText(p)}</small>
          </span>
          <button type="button" class="btn small danger" onclick="removeWizardPlayer('${p.id}')">Remove</button>
        </div>`).join('')}
    </div>
    ${state.players.length>6?`<div class="compact-roster-more">+ ${state.players.length-6} more participant(s) — full list appears on Roster Check.</div>`:''}`;
}

function renderWizardParticipantCountPanel(){
  const count=state.players.length;

  const topCount=document.getElementById('wizardActualPlayerCount');
  if(topCount)topCount.textContent=String(count);

  const swissCount=document.getElementById('wizSwissActualParticipants');
  if(swissCount)swissCount.textContent=String(count);

  const box=document.getElementById('wizardParticipantCountPanel');
  if(box){
    let detail='';
    if(wizardFormat==='swiss'){
      const rec=recommendedSwissRounds(count);
      const baseline=fideSwissBaselineRounds(count);
      detail=rec
        ? `<span class="participant-live-rec">${count} actual players → FIDE baseline <b>${baseline}</b> • Manager recommends <b>${rec} rounds</b></span>`
        : '<span>Add/import at least 2 players to calculate the Swiss round recommendation.</span>';
    }else if(wizardFormat==='roundrobin'){
      if(count>=2){
        const single=count%2===0?count-1:count;
        detail=`<span>${count} actual players → Single Round Robin requires <b>${single} rounds</b>${count%2?' (one sit-out each round)':''}.</span>`;
      }else detail='<span>Add/import at least 2 players to calculate the Round Robin schedule.</span>';
    }else{
      detail=`<span>${count} actual participant${count===1?'':'s'} currently registered.</span>`;
    }

    box.innerHTML=`<div class="participant-live-panel">
      <div><b>${count}</b> ACTUAL PARTICIPANT${count===1?'':'S'}</div>
      <div>${detail}</div>
    </div>`;
  }

  if(wizardFormat==='swiss')updateSwissRoundRecommendation();
  renderCompactWizardRosterPreview();
}

function renderWizardFormatOptions(format){
  const box=document.getElementById('wizardFormatOptions');
  const tb=(state.tieBreaksByMode&&state.tieBreaksByMode[format])||cloneDefaultTB(format);
  const common=commonEventOptionsHTML();

  if(format==='swiss'){
    const variant=state.settings.swissVariant||'flexible';
    box.innerHTML=`
      <h3>Swiss Tournament Options</h3>
      <div class="note">Choose the Swiss pairing style, select only the tie-breaks required by your event, then add/import the actual participants below.</div>
      <div class="form-row" style="margin-top:12px">
        <div class="field wide">
          <label>Swiss Pairing System / Style</label>
          <select id="wizSwissVariant" onchange="updateSwissVariantHelp()">
            <option value="flexible" ${variant==='flexible'?'selected':''}>Flexible / Practical Swiss</option>
            <option value="dutch" ${variant==='dutch'?'selected':''}>Dutch-style Swiss</option>
            <option value="accelerated" ${variant==='accelerated'?'selected':''}>Accelerated Swiss</option>
            <option value="double" ${variant==='double'?'selected':''}>Double Swiss — two games per pairing</option>
          </select>
        </div>
        <div class="field">
          <label>Actual Registered Players</label>
          <div class="actual-count-field">
            <strong id="wizSwissActualParticipants">${state.players.length}</strong>
            <span>participant(s)</span>
          </div>
          <div class="help" style="margin-top:5px">Add or import the real players below. This count updates automatically.</div>
        </div>

        <div class="field">
          <label>Number of Rounds — Manager Recommendation</label>
          <div class="engine-round-field">
            <strong id="wizSwissRoundsDisplay">—</strong>
            <span id="wizSwissRoundsStatus">Waiting for roster</span>
          </div>
          <input id="wizSwissRounds" type="hidden" value="0">
          <div class="help" style="margin-top:5px">The manager uses the FIDE theoretical baseline from the actual roster, then adds one practical separation round.</div>
        </div>

        <div class="field full">
          <div class="round-recommendation" id="swissRoundRecommendation">
            <div>
              <div class="round-rec-kicker">FIDE BASELINE + MANAGER RECOMMENDATION</div>
              <div class="round-rec-main" id="swissRoundRecommendationMain">Add or import at least 2 actual players below.</div>
              <div class="round-rec-help" id="swissRoundRecommendationHelp">The round count will be set automatically from the actual number of registered players.</div>
            </div>
          </div>
        </div>

        <div class="field full">
          <div class="fide-score-lock">
            <div class="fide-score-title">Standard Scoring — Locked</div>
            <div class="fide-score-pills">
              <span>Win <b>1</b></span>
              <span>Draw <b>½</b></span>
              <span>Loss <b>0</b></span>
              <span>Swiss Pairing Bye <b>1</b></span>
            </div>
          </div>
        </div>

        <div class="field full">
          <div class="toolbar tb-presets" style="margin:2px 0 0">
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(5)">Use First 5</button>
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(8)">Enable 8 Slots</button>
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(0)">Points Only</button>
          </div>
          <div class="help">Up to 8 tie-breaks may be active. Each slot can choose from all available methods, including BH-C1, BH-M1, and BH-M2. Only checked tie-breaks affect ranking and printed standings.</div>
          <div class="note" style="margin-top:8px">
            <b>Buchholz variants:</b> BH-C1 cuts the lowest contribution only; BH-M1 cuts the lowest and highest; BH-M2 cuts the two lowest and two highest.
          </div>
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn1" onchange="updateWizardTieSlot(1)"> <span>1st Tie-break</span></label>
          ${wizardTieSelect('wizTb1',tb[0]||'de')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn2" onchange="updateWizardTieSlot(2)"> <span>2nd Tie-break</span></label>
          ${wizardTieSelect('wizTb2',tb[1]||'buchholzCut1')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn3" onchange="updateWizardTieSlot(3)"> <span>3rd Tie-break</span></label>
          ${wizardTieSelect('wizTb3',tb[2]||'buchholz')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn4" onchange="updateWizardTieSlot(4)"> <span>4th Tie-break</span></label>
          ${wizardTieSelect('wizTb4',tb[3]||'wins')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn5" onchange="updateWizardTieSlot(5)"> <span>5th Tie-break</span></label>
          ${wizardTieSelect('wizTb5',tb[4]||'blackWins')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn6" onchange="updateWizardTieSlot(6)"> <span>6th Tie-break</span></label>
          ${wizardTieSelect('wizTb6',tb[5]||'sb')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn7" onchange="updateWizardTieSlot(7)"> <span>7th Tie-break</span></label>
          ${wizardTieSelect('wizTb7',tb[6]||'cumulative')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn8" onchange="updateWizardTieSlot(8)"> <span>8th Tie-break</span></label>
          ${wizardTieSelect('wizTb8',tb[7]||'rating')}
        </div>
      </div>
      <div id="swissVariantHelp" class="help"></div>
      ${common}
      <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveWizardFormatOptions()">Save Format & Check Roster →</button></div>`;
    updateSwissVariantHelp();
    updateSwissRoundRecommendation();
  } else if(format==='roundrobin'){
    box.innerHTML=`
      <h3>Round Robin Options</h3>
      <div class="note">Every player plays every other player. Choose single/double Round Robin and configure up to <b>8 active ranking tie-break slots</b>.</div>
      <div class="form-row" style="margin-top:12px">
        <div class="field wide"><label>Round Robin Type</label>
          <select id="wizRRType">
            <option value="single" ${state.settings.roundRobinType!=='double'?'selected':''}>Single Round Robin</option>
            <option value="double" ${state.settings.roundRobinType==='double'?'selected':''}>Double Round Robin</option>
          </select>
        </div>
        <div class="field full">
          <div class="fide-score-lock">
            <div class="fide-score-title">Standard Scoring — Locked</div>
            <div class="fide-score-pills">
              <span>Win <b>1</b></span>
              <span>Draw <b>½</b></span>
              <span>Loss <b>0</b></span>
              <span>Scheduled Sit-out <b>0</b></span>
            </div>
          </div>
        </div>
        <div class="field full">
          <div class="toolbar tb-presets" style="margin:2px 0 0">
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(5)">Use First 5</button>
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(8)">Enable 8 Slots</button>
            <button type="button" class="btn small" onclick="setWizardTieBreakCount(0)">Points Only</button>
          </div>
          <div class="help">Up to 8 tie-breaks may be active. Each slot can choose from all available methods, including BH-C1, BH-M1, and BH-M2. Only checked tie-breaks affect ranking and printed standings.</div>
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn1" onchange="updateWizardTieSlot(1)"> <span>1st Tie-break</span></label>
          ${wizardTieSelect('wizTb1',tb[0]||'de')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn2" onchange="updateWizardTieSlot(2)"> <span>2nd Tie-break</span></label>
          ${wizardTieSelect('wizTb2',tb[1]||'wins')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn3" onchange="updateWizardTieSlot(3)"> <span>3rd Tie-break</span></label>
          ${wizardTieSelect('wizTb3',tb[2]||'sb')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn4" onchange="updateWizardTieSlot(4)"> <span>4th Tie-break</span></label>
          ${wizardTieSelect('wizTb4',tb[3]||'blackWins')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn5" onchange="updateWizardTieSlot(5)"> <span>5th Tie-break</span></label>
          ${wizardTieSelect('wizTb5',tb[4]||'cumulative')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn6" onchange="updateWizardTieSlot(6)"> <span>6th Tie-break</span></label>
          ${wizardTieSelect('wizTb6',tb[5]||'rating')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn7" onchange="updateWizardTieSlot(7)"> <span>7th Tie-break</span></label>
          ${wizardTieSelect('wizTb7',tb[6]||'buchholzCut1')}
        </div>
        <div class="field tb-slot">
          <label class="tb-slot-head"><input type="checkbox" id="wizTbEn8" onchange="updateWizardTieSlot(8)"> <span>8th Tie-break</span></label>
          ${wizardTieSelect('wizTb8',tb[7]||'buchholz')}
        </div>
      </div>
      ${common}
      <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveWizardFormatOptions()">Continue to Roster →</button></div>`;
  } else if(format==='team'){
    box.innerHTML=`
      <h3>Team Tournament Options</h3>
      <div class="note">Players are grouped into teams using the delegation shown for the selected meet level: School, Town/City, or Region.</div>
      <div class="form-row" style="margin-top:12px">
        <div class="field wide"><label>Team Pairing Format</label>
          <select id="wizTeamFormat">
            <option value="swiss" ${(state.settings.teamFormat||'swiss')==='swiss'?'selected':''}>Team Swiss</option>
            <option value="roundrobin" ${state.settings.teamFormat==='roundrobin'?'selected':''}>Team Round Robin</option>
          </select>
        </div>
        <div class="field"><label>Boards per Team</label><input id="wizTeamBoards" type="number" min="1" max="12" value="${state.settings.teamBoards||4}"></div>
        <div class="field"><label>Rounds</label><input id="wizTeamRounds" type="number" min="1" max="30" value="${state.settings.rounds||5}"></div>
        <div class="field"><label>Match Win Points</label><input id="wizTeamMatchWin" type="number" step=".5" value="${state.settings.teamMatchWin??2}"></div>
        <div class="field"><label>Match Draw Points</label><input id="wizTeamMatchDraw" type="number" step=".5" value="${state.settings.teamMatchDraw??1}"></div>
      </div>
      <div class="help">Board order is based on roster rating order. Team standings use Match Points first, then Board Points.</div>
      ${common}
      <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveWizardFormatOptions()">Continue to Roster →</button></div>`;
  } else {
    box.innerHTML=`
      <h3>Knockout Options</h3>
      <div class="note">Players advance through a bracket. Ranking tie-breaks are not used for advancement.</div>
      <div class="form-row" style="margin-top:12px">
        <div class="field wide"><label>Seeding Method</label>
          <select id="wizKOSeed">
            <option value="rating" ${state.settings.knockoutSeeding!=='random'?'selected':''}>Seed by Rating</option>
            <option value="random" ${state.settings.knockoutSeeding==='random'?'selected':''}>Random Draw</option>
          </select>
        </div>
        <div class="field full">
          <div class="fide-score-lock">
            <div class="fide-score-title">Game Scoring — Locked</div>
            <div class="fide-score-pills">
              <span>Win <b>1</b></span>
              <span>Draw <b>½</b></span>
              <span>Loss <b>0</b></span>
            </div>
          </div>
        </div>
      </div>
      ${common}
      <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveWizardFormatOptions()">Continue to Roster →</button></div>`;
  }

  toggleWizardRatingRestriction();

  // Activate only the tie-breaks already enabled for this tournament format.
  const activeCount=(state.tieBreaksByMode?.[format]||[]).length;
  for(let i=1;i<=8;i++){
    const cb=document.getElementById(`wizTbEn${i}`);
    if(cb)cb.checked=i<=activeCount;
    updateWizardTieSlot(i,false);
  }
}

function updateSwissVariantHelp(){
  const el=document.getElementById('swissVariantHelp');
  const v=document.getElementById('wizSwissVariant')?.value||'flexible';
  if(!el)return;
  const msg={
    flexible:'Flexible / Practical Swiss uses the manager’s local school-event engine: similar scores, repeat-opponent avoidance, and color balancing.',
    dutch:'Dutch-style Swiss splits score groups into upper and lower halves and pairs across the halves. For an officially FIDE-rated event, verify the generated pairing with an endorsed/approved pairing tool.',
    accelerated:'Accelerated Swiss gives the upper seed group temporary virtual pairing points in the opening rounds to reduce early mismatches. The virtual points affect pairing only, not the real standings.',
    double:'Double Swiss makes each pairing a two-game match with reversed colors. Both game results count toward the player score.'
  };
  el.textContent=msg[v]||'';
}
function saveWizardFormatOptions(){
  if(!wizardFormat){
    alert('Select a tournament format first.');
    wizardGo(1);
    return;
  }
  state.settings.mode=wizardFormat;
  state.settings.tournamentStarted=false;
  const mainMode=document.getElementById('mode');
  if(mainMode)mainMode.value=wizardFormat;

  saveCommonEventOptions();

  if(state.players.length<2){
    alert('Add or import at least 2 actual participants before continuing.');
    wizardGo(2);
    return;
  }

  if(wizardFormat==='swiss'){
    state.settings.swissVariant=document.getElementById('wizSwissVariant').value;
    const engineRounds=recommendedSwissRounds(state.players.length);
    if(!engineRounds){
      alert('Add or import at least 2 actual participants first.');
      wizardGo(2);
      return;
    }
    state.settings.rounds=engineRounds;
    const roundsInput=document.getElementById('wizSwissRounds');
    if(roundsInput)roundsInput.value=String(engineRounds);
    delete state.settings.expectedParticipants;
    enforceStandardScoring(state);
    saveWizardTieBreaks('swiss');
  } else if(wizardFormat==='roundrobin'){
    state.settings.roundRobinType=document.getElementById('wizRRType').value;
    enforceStandardScoring(state);
    saveWizardTieBreaks('roundrobin');
  } else if(wizardFormat==='team'){
    state.settings.teamFormat=document.getElementById('wizTeamFormat').value;
    state.settings.teamBoards=Math.max(1,+document.getElementById('wizTeamBoards').value||4);
    state.settings.rounds=Math.max(1,+document.getElementById('wizTeamRounds').value||5);
    state.settings.teamMatchWin=+document.getElementById('wizTeamMatchWin').value||0;
    state.settings.teamMatchDraw=+document.getElementById('wizTeamMatchDraw').value||0;
    enforceStandardScoring(state);
    state.tieBreaksByMode.team=[];
    state.tieBreaks=[];
  } else {
    state.settings.knockoutSeeding=document.getElementById('wizKOSeed').value;
    enforceStandardScoring(state);
    state.tieBreaksByMode.knockout=[];
    state.tieBreaks=[];
  }

  wizardFormatConfigured=true;
  hydrateInputs();
  persist();
  renderAll();
  renderModeTieBreakSelectors();
  wizardGo(3);
}
function saveWizardTieBreaks(format){
  const selected=[];
  for(let i=1;i<=8;i++){
    const cb=document.getElementById(`wizTbEn${i}`);
    const sel=document.getElementById(`wizTb${i}`);
    if(cb?.checked && sel?.value && !selected.includes(sel.value))selected.push(sel.value);
  }
  state.tieBreaksByMode[format]=selected;
  state.tieBreaks=[...selected];
}
function renderWizardRoster(){
  const box=document.getElementById('wizardRosterSummary');
  if(!box)return;
  state.players.forEach(ensurePlayerStructuredName);

  if(!state.players.length){
    box.innerHTML='<div class="empty">No players selected yet. Add manually or import a roster above.</div>';
    return;
  }

  const actualCount=state.players.length;
  let roundCheck='';
  if(state.settings.mode==='swiss'){
    const baseline=fideSwissBaselineRounds(actualCount);
    const rec=recommendedSwissRounds(actualCount);
    if(rec)state.settings.rounds=rec;
    roundCheck=`<div class="roster-round-check">
      <b>Swiss round decision:</b> ${actualCount} actual player(s) •
      FIDE theoretical baseline: <b>${baseline||'—'}</b> •
      Manager recommendation: <b>${rec||'—'} rounds</b>.
      <br><span style="color:var(--muted)">The manager uses one additional practical separation round beyond the theoretical baseline, while respecting the no-repeat-opponent limit.</span>
    </div>`;
  }else if(state.settings.mode==='roundrobin'){
    const rr=actualCount%2===0?actualCount-1:actualCount;
    roundCheck=`<div class="roster-round-check"><b>Schedule check:</b> ${actualCount} actual player(s) • Single Round Robin = <b>${rr} rounds</b>${actualCount%2?' with one sit-out per round':''}.</div>`;
  }

  box.innerHTML=`<div class="card">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <b>${state.players.length} player(s) selected</b>
      <span class="badge green">Tournament Roster</span>
    </div>
    ${roundCheck}
    <table style="margin-top:8px">
      <thead><tr><th>#</th><th>Player</th><th>School / Delegation</th><th>Rating</th><th></th></tr></thead>
      <tbody>${state.players.map((p,i)=>`<tr>
        <td>${i+1}</td>
        <td><b>${esc(rosterName(p))}</b></td>
        <td>${esc(delegationLabel(p)||p.school||'—')}</td>
        <td>${ratingText(p)}</td>
        <td><button class="btn small danger" onclick="removeWizardPlayer('${p.id}')">Remove</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
function renderWizardReview(){
  const box=document.getElementById('wizardReview');
  const m=state.settings.mode||wizardFormat||'swiss';
  const tb=state.tieBreaksByMode?.[m]||[];
  let special='';
  if(m==='swiss'){
    const sv={flexible:'Flexible / Practical Swiss',dutch:'Dutch-style Swiss',accelerated:'Accelerated Swiss',double:'Double Swiss'}[state.settings.swissVariant||'flexible'];
    const baseline=fideSwissBaselineRounds(state.players.length);
    special=`<b>Swiss Style:</b> ${sv}<br><b>Actual Participants:</b> ${state.players.length}<br><b>FIDE Theoretical Baseline:</b> ${baseline||'—'} round(s)<br><b>Manager Recommended Rounds:</b> ${state.settings.rounds}<br><b>Tie-breaks (${tb.length} enabled):</b> ${tb.length?tb.map(x=>esc(TB_LABELS[x])).join(' → '):'Points only'}`;
  }else if(m==='roundrobin'){
    special=`<b>Type:</b> ${state.settings.roundRobinType==='double'?'Double Round Robin':'Single Round Robin'}<br><b>Tie-breaks (${tb.length} enabled):</b> ${tb.length?tb.map(x=>esc(TB_LABELS[x])).join(' → '):'Points only'}`;
  }else if(m==='team'){
    special=`<b>Team Format:</b> ${(state.settings.teamFormat||'swiss')==='swiss'?'Team Swiss':'Team Round Robin'}<br><b>Boards per Team:</b> ${state.settings.teamBoards||4}<br><b>Team Ranking:</b> Match Points → Board Points → Match Wins`;
  }else{
    special=`<b>Seeding:</b> ${state.settings.knockoutSeeding==='random'?'Random Draw':'Rating'}<br><b>Tie-breaks:</b> Not used for advancement`;
  }
  box.innerHTML=`
    <h3 style="margin-top:0">${esc(state.settings.name)}</h3>
    <b>Category:</b> ${esc(state.settings.tournamentCategory||'Open')}<br>
    <b>Format:</b> ${esc(modeName(m))}<br>
    <b>Meet Level:</b> ${esc((state.settings.meetLevel||'municipal').toUpperCase())}<br>
    <b>Players:</b> ${state.players.length}<br>
    ${special}<br>
    <b>Entry Type:</b> ${esc(({open:'Open',invitational:'Invitational',rating:'Rating-Restricted'}[state.settings.entryType||'open']))}${state.settings.entryType==='rating'?` (${state.settings.ratingMin||0}–${state.settings.ratingMax||0})`:''}<br>
    <b>Final Tie Resolution:</b> ${esc(({ranking:'Ranking tie-breaks',rapid:'Rapid playoff',blitz:'Blitz playoff',armageddon:'Armageddon if still tied'}[state.settings.finalTieResolution||'ranking']))}<br>
    <b>Time Control:</b> ${esc(state.settings.timeControl||'')}<br>
    <b>Scoring:</b> Win 1 • Draw ½ • Loss 0<br>
    <b>Venue:</b> ${esc(state.settings.venue||'')}<br>
    <b>Chief Arbiter:</b> ${esc(state.settings.chiefArbiter||'—')}<br>
    <b>Tournament Director (TD):</b> ${esc(state.settings.tournamentDirector||'—')}
  `;
}

async function confirmStartTournament(){
  if(!wizardFormat || !wizardFormatConfirmed){
    alert('Select and confirm a tournament format first.');
    wizardGo(1);
    return;
  }
  if(!wizardFormatConfigured || !state.settings.mode){
    alert('Configure the selected tournament format first.');
    wizardGo(2);
    return;
  }
  if(state.players.length<2){
    alert('Add at least 2 players to the roster before starting.');
    wizardGo(3);
    return;
  }

  if(state.settings.entryType==='rating'){
    const min=state.settings.ratingMin||0,max=state.settings.ratingMax||9999;
    const invalid=state.players.filter(p=>!p.unrated && (p.rating<min||p.rating>max));
    if(invalid.length){
      alert(`Rating restriction is ${min}–${max}. ${invalid.length} rated player(s) are outside the allowed range.`);
      wizardGo(3);return;
    }
  }

  if(state.settings.mode==='team'){
    const teams=getTeams();
    if(teams.length<2){
      alert('Team Tournament needs at least two different schools/delegations.');
      wizardGo(3);return;
    }
    const boards=state.settings.teamBoards||4;
    const short=teams.filter(t=>t.players.length<boards);
    if(short.length && !await appConfirm(`${short.length} team(s) have fewer than ${boards} players. Missing boards will be treated as byes/forfeits. Continue?`,{title:'Incomplete Team Boards',confirmText:'Continue',danger:false}))return;
  }

  // Apply special format behavior before Round 1.
  if(state.settings.mode==='knockout' && state.settings.knockoutSeeding==='random'){
    for(let i=state.players.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [state.players[i],state.players[j]]=[state.players[j],state.players[i]];
    }
  }

  if(state.settings.mode==='roundrobin'){
    const n=state.players.length;
    const singleRounds=(n%2===0)?n-1:n;
    state.settings.rounds=state.settings.roundRobinType==='double'?singleRounds*2:singleRounds;
  }
  if(state.settings.mode==='team' && state.settings.teamFormat==='roundrobin'){
    const n=getTeams().length;
    state.settings.rounds=(n%2===0)?n-1:n;
  }

  state.settings.tournamentStarted=true;
  // New tournaments must always receive their own permanent ID.
  if(!state.settings.tournamentId)state.settings.tournamentId=newTournamentId();
  state.settings.updatedAt=new Date().toISOString();
  const mainMode=document.getElementById('mode');
  if(mainMode)mainMode.value=state.settings.mode;
  wizardPreviousState=null;

  // Tournament creation ends on Dashboard with ZERO generated rounds.
  state.rounds=[];
  persist();
  saveActiveTournamentToLibrary();

  closeTournamentWizard();
  hydrateInputs();
  renderAll();
  renderModeTieBreakSelectors();
  updateTieBreakVisibility();
  renderTournamentSwitcher();
  hideHomeScreen();
  goTab('dashboard');

  showToast(
    'Tournament created. Round 1 has not been generated yet. Open Pairings when you are ready.',
    'success',
    'Tournament ready'
  );
}
