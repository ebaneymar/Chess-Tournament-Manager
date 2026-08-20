// Chess Tournament Manager 2.0
// Player roster, structured names, ratings, CSV import, and player actions.

function playerDisplay(p){
  if(!p)return '';
  ensurePlayerStructuredName(p);
  const d=delegationLabel(p);
  return d ? `${p.name} — ${d}` : p.name;
}


function cleanMiddleInitial(v){
  v=String(v||'').trim().replace(/\./g,'').toUpperCase();
  return v.slice(0,2);
}
function formatStructuredName(lastName,firstName,middleInitial){
  const last=String(lastName||'').trim();
  const first=String(firstName||'').trim();
  const mi=cleanMiddleInitial(middleInitial);
  if(!last && !first)return '';
  const mid=mi ? ` ${mi}.` : '';
  return last ? `${last.toUpperCase()}, ${first}${mid}`.trim() : `${first}${mid}`.trim();
}
function ensurePlayerStructuredName(p){
  if(!p)return p;
  if(typeof p.lastName==='undefined')p.lastName='';
  if(typeof p.firstName==='undefined')p.firstName='';
  if(typeof p.middleInitial==='undefined')p.middleInitial='';
  const structured=formatStructuredName(p.lastName,p.firstName,p.middleInitial);
  if(structured)p.name=structured;
  return p;
}
function rosterName(p){
  if(!p)return '';
  ensurePlayerStructuredName(p);
  return p.name||'';
}
function rosterTemplateRows(){
  return [
    ['Last Name','First Name','Middle Initial','School ID','School','Rating Status','Rating','Category'],
    ['Averia','John Vincent','A','108661','San Pablo Suha ES','NR','','Elementary Boys'],
    ['Dela Cruz','Juan','P','','','Rated','1450','Secondary Boys']
  ];
}
function downloadRosterTemplate(){
  const rows=rosterTemplateRows();
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Chess_Roster_Import_Template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
function csvHeaderIndex(headers,candidates){
  const h=headers.map(normalizedHeader);
  for(const cand of candidates){
    const c=normalizedHeader(cand);
    let i=h.findIndex(x=>x===c);
    if(i>=0)return i;
    i=h.findIndex(x=>x.includes(c));
    if(i>=0)return i;
  }
  return -1;
}
async function importRosterCSV(event,fromWizard=false){
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    const raw=await file.text();
    const lines=raw.split(/\r?\n/).filter(x=>x.trim());
    if(lines.length<2){alert('The roster file has no player rows.');return;}

    const headers=parseCSVLine(lines[0]);
    const iLast=csvHeaderIndex(headers,['Last Name','Surname','Family Name']);
    const iFirst=csvHeaderIndex(headers,['First Name','Given Name']);
    const iMI=csvHeaderIndex(headers,['Middle Initial','MI']);
    const iSchoolId=csvHeaderIndex(headers,['School ID','DepEd School ID']);
    const iSchool=csvHeaderIndex(headers,['School','School Name']);
    const iStatus=csvHeaderIndex(headers,['Rating Status','Status']);
    const iRating=csvHeaderIndex(headers,['Rating','Elo']);
    const iCategory=csvHeaderIndex(headers,['Category','Sex / Category','Sex']);

    if(iLast<0 || iFirst<0){
      alert('Roster CSV must contain Last Name and First Name columns.');
      return;
    }

    let added=0;
    for(let lineNo=1;lineNo<lines.length;lineNo++){
      const v=parseCSVLine(lines[lineNo]);
      const last=String(v[iLast]||'').trim();
      const first=String(v[iFirst]||'').trim();
      if(!last&&!first)continue;
      const mi=iMI>=0?cleanMiddleInitial(v[iMI]):'';
      const schoolId=iSchoolId>=0?String(v[iSchoolId]||'').trim().replace(/\.0$/,''):'';
      let school=iSchool>=0?String(v[iSchool]||'').trim():'';
      let town='',division='',region='';

      if(schoolId){
        const s=BUILTIN_SCHOOLS[schoolId]||nationalSchoolById(schoolId)||await getImportedSchool(schoolId);
        if(s){
          if(!school)school=s.school||'';
          town=s.town||'';division=s.division||'';region=s.region||'';
        }
      }

      const status=iStatus>=0?String(v[iStatus]||'').trim().toUpperCase():'';
      const ratingVal=iRating>=0?String(v[iRating]||'').trim():'';
      const unrated=status==='NR'||status==='NON-RATED'||status==='UNRATED'||!ratingVal;
      const rating=unrated?0:(+ratingVal||0);

      state.players.push({
        id:uid(),
        lastName:last,firstName:first,middleInitial:mi,
        name:formatStructuredName(last,first,mi),
        schoolId,school,town,division,region,
        rating,unrated,
        team:'',
        category:iCategory>=0?(String(v[iCategory]||'Open').trim()||'Open'):'Open'
      });
      added++;
    }

    persist();renderAll();
    if(fromWizard){renderWizardRoster();renderWizardParticipantCountPanel();}
    alert(`${added} player(s) imported.`);
  }catch(err){
    alert('Could not import the roster CSV.');
  }finally{
    event.target.value='';
  }
}
function toggleWizardPlayerRating(){
  const rated=document.getElementById('wizPlayerRatingStatus')?.value==='rated';
  const wrap=document.getElementById('wizPlayerRatingWrap');
  if(wrap)wrap.style.display=rated?'':'none';
}
async function lookupWizardPlayerSchool(){ initWizardSchoolCascade(); }
function addWizardPlayer(){
  const last=wizPlayerLastName.value.trim();
  const first=wizPlayerFirstName.value.trim();
  const mi=cleanMiddleInitial(wizPlayerMiddleInitial.value);
  if(!last||!first){
    alert('Enter both Last Name and First Name.');
    return;
  }
  if(!wizPlayerRegion.value || !wizPlayerDivision.value || !wizPlayerTown.value || !wizPlayerSchoolId.value){
    alert('Select Region, Division/Province, Town/City, and School first.');
    return;
  }
  const unrated=wizPlayerRatingStatus.value!=='rated';
  pushHistory('Add player');
  state.players.push({
    id:uid(),
    lastName:last,firstName:first,middleInitial:mi,
    name:formatStructuredName(last,first,mi),
    schoolId:wizPlayerSchoolId.value.trim(),
    school:wizPlayerSchool.value.trim(),
    town:wizPlayerTown.value.trim(),
    division:wizPlayerDivision.value.trim(),
    region:wizPlayerRegion.value.trim(),
    rating:unrated?0:(+wizPlayerRating.value||0),
    unrated,team:'',
    category:wizPlayerCategory.value
  });

  wizPlayerLastName.value='';wizPlayerFirstName.value='';wizPlayerMiddleInitial.value='';
  initWizardSchoolCascade(true);
  wizPlayerRatingStatus.value='unrated';wizPlayerRating.value='1200';wizPlayerCategory.value='Elementary Boys';
  toggleWizardPlayerRating();
  if(wizPlayerSchoolStatus)wizPlayerSchoolStatus.textContent='Select Region → Division/Province → Town/City → School / DepEd School ID.';
  persist();renderAll();renderWizardRoster();renderWizardParticipantCountPanel();
}
function removeWizardPlayer(id){
  if(state.rounds.length)return;
  state.players=state.players.filter(p=>p.id!==id);
  persist();renderAll();renderWizardRoster();renderWizardParticipantCountPanel();
}

function ratingText(p){ return p && p.unrated ? 'NR' : String(p?.rating ?? 0); }
function toggleRatingInput(){
  const unrated = document.getElementById('playerRatingStatus')?.value === 'unrated';
  const wrap = document.getElementById('playerRatingWrap');
  if(wrap) wrap.style.display = unrated ? 'none' : '';
}
function addPlayer(){
  const last=playerLastName.value.trim();
  const first=playerFirstName.value.trim();
  const mi=cleanMiddleInitial(playerMiddleInitial.value);
  if(!last||!first){alert('Enter both Last Name and First Name.');return;}
  if(!playerRegion.value || !playerDivision.value || !playerTown.value || !playerSchoolId.value){
    alert('Select Region, Division/Province, Town/City, and School first.');
    return;
  }

  const unrated=playerRatingStatus.value==='unrated';
  state.players.push({
    id:uid(),
    lastName:last,firstName:first,middleInitial:mi,
    name:formatStructuredName(last,first,mi),
    schoolId:playerSchoolId.value.trim(),
    school:playerSchool.value.trim(),
    town:playerTown.value.trim(),
    division:playerDivision.value.trim(),
    region:playerRegion.value.trim(),
    rating:unrated?0:(+playerRating.value||0),unrated,
    team:'',category:playerCategory.value
  });

  playerLastName.value='';playerFirstName.value='';playerMiddleInitial.value='';
  initRosterSchoolCascade(true);
  playerRatingStatus.value='rated';playerRating.value='1200';playerCategory.value='Elementary Boys';
  toggleRatingInput();
  schoolLookupStatus.textContent='Select Region → Division/Province → Town/City → School / DepEd School ID.';
  persist();renderAll();playerLastName.focus();
}
function deletePlayer(id){
  if(state.rounds.length){alert('Players cannot be deleted after pairings have started. Reset the tournament or remove rounds first.');return;}
  const p=getPlayer(id);
  pushHistory(`Delete player${p?.name?`: ${p.name}`:''}`);
  state.players=state.players.filter(p=>p.id!==id);persist();renderAll();
}
function editPlayer(id){
  const p=getPlayer(id); if(!p)return;
  ensurePlayerStructuredName(p);

  const last=prompt('Last Name / Surname:',p.lastName||''); if(last===null)return;
  const first=prompt('First Name:',p.firstName||''); if(first===null)return;
  const mi=prompt('Middle Initial:',p.middleInitial||''); if(mi===null)return;
  const r=prompt('Rating (type NR for Non-Rated):',p.unrated?'NR':p.rating); if(r===null)return;
  const sid=prompt('DepEd School ID:',p.schoolId||''); if(sid===null)return;
  const sch=prompt('School:',p.school||''); if(sch===null)return;
  const town=prompt('Town / Municipality / City:',p.town||''); if(town===null)return;
  const div=prompt('Division / Province:',p.division||''); if(div===null)return;
  const reg=prompt('Region:',p.region||''); if(reg===null)return;

  p.lastName=last.trim();
  p.firstName=first.trim();
  p.middleInitial=cleanMiddleInitial(mi);
  p.name=formatStructuredName(p.lastName,p.firstName,p.middleInitial)||p.name;
  p.unrated=String(r).trim().toUpperCase()==='NR';
  p.rating=p.unrated?0:(+r||0);
  p.schoolId=sid.trim();p.school=sch.trim();p.town=town.trim();
  p.division=div.trim();p.region=reg.trim();p.team='';
  persist();renderAll();
}
function sortPlayersByRating(){
  if(state.rounds.length){alert('Seeding cannot be changed after the tournament starts.');return;}
  state.players.sort((a,b)=>(Number(a.unrated)-Number(b.unrated))||b.rating-a.rating||a.name.localeCompare(b.name));persist();renderAll();
}
async function clearPlayers(){
  if(state.rounds.length){alert('Reset the tournament first because rounds already exist.');return;}
  if(await appConfirm('Remove all players from this tournament roster?',{title:'Clear Roster',confirmText:'Remove All'})){
    pushHistory('Clear player roster');
    state.players=[];persist();renderAll();showToast('Player roster cleared.','success');
  }
}
