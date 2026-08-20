// Chess Tournament Manager 2.0
// Rendering coordinator and CLEAN STARTUP bootstrap.

function renderAll(){renderPlayers();renderPairings();renderStandings();renderPairingsRanking();renderTieList();renderDashboard();renderReports();}


// BUILD 5: New Tournament UI always starts closed and always begins at Step 1.
(function resetTournamentCreationUI(){
  wizardFormat=null;
  wizardFormatConfirmed=false;
  wizardFormatConfigured=false;
  const wizard=document.getElementById('tournamentWizard');
  if(wizard){
    wizard.classList.remove('show');
    wizard.setAttribute('data-step','0');
    [1,2,3,4].forEach(n=>{
      const panel=document.getElementById(`wizardStep${n}`);
      if(panel)panel.style.display=n===1?'block':'none';
    });
  }
})();


document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(document.getElementById('tieBreakExplainModal')?.classList.contains('show'))closeTieBreakExplanation();
  const confirmModal=document.getElementById('appConfirmModal');
  if(confirmModal?.classList.contains('show') && confirmResolver){
    document.getElementById('appConfirmCancel')?.click();
  }
});

applyAppTheme(getSavedAppTheme());
syncPreferencesUI();
loadUndoHistory();
scheduleFastSchoolLookupIndex();

/* BUILD 19 CLEAN STARTUP
   Save/migrate any older working tournament first, then start neutral.
   A saved tournament becomes active only after Open Dashboard is clicked.
*/
migrateCurrentTournamentToLibrary();

state=defaultState();
state.settings.tournamentStarted=false;
state.settings.tournamentId='';
state.settings.mode='';
state.players=[];
state.rounds=[];
state.tieBreaks=[];
clearUndoHistory();

ensureTieBreakState();
hydrateInputs();
toggleRatingInput();
buildNotationGrid([]);
renderAll();
renderModeTieBreakSelectors();
updateTieBreakVisibility();
initRosterSchoolCascade();
renderTournamentSwitcher();

document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
document.getElementById('dashboard')?.classList.add('active');
document.querySelectorAll('.nav button[data-tab]').forEach(b=>{
  b.classList.toggle('active',b.dataset.tab==='dashboard');
});

showHomeScreen();
