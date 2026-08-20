// Chess Tournament Manager 2.0
// School indexing, cascading Region/Division/Town/School selectors, lookup/import.

let PH_SCHOOL_INDEX=null;
function ensureSchoolIdIndex(){
  if(PH_SCHOOL_INDEX)return PH_SCHOOL_INDEX;
  PH_SCHOOL_INDEX=new Map(PH_SCHOOLS_DATA.map((r,i)=>[String(r[0]),i]));
  return PH_SCHOOL_INDEX;
}

// National DepEd cascading geography index.
// Each PH_SCHOOLS_DATA row is:
// [School ID, School Name, Municipality/City, Division/Province, Region]
let PH_GEO_INDEX=null;
function ensurePHGeoIndex(){
  if(PH_GEO_INDEX)return PH_GEO_INDEX;
  const regions=new Map();
  for(const r of PH_SCHOOLS_DATA){
    const schoolId=String(r[0]||'').trim();
    const school=String(r[1]||'').trim();
    const town=String(r[2]||'').trim();
    const division=String(r[3]||'').trim();
    const region=String(r[4]||'').trim();
    if(!region)continue;

    if(!regions.has(region))regions.set(region,new Map());
    const divisions=regions.get(region);
    if(!divisions.has(division))divisions.set(division,new Map());
    const towns=divisions.get(division);
    if(!towns.has(town))towns.set(town,[]);
    towns.get(town).push({schoolId,school,town,division,region});
  }
  for(const divisions of regions.values()){
    for(const towns of divisions.values()){
      for(const schools of towns.values()){
        schools.sort((a,b)=>a.school.localeCompare(b.school)||a.schoolId.localeCompare(b.schoolId));
      }
    }
  }
  PH_GEO_INDEX=regions;
  return PH_GEO_INDEX;
}

function sortedUnique(values){
  return [...values].filter(Boolean).sort((a,b)=>a.localeCompare(b));
}
function setSelectOptions(select, items, placeholder, valueFn=x=>x, labelFn=x=>x){
  if(!select)return;
  select.innerHTML = `<option value="">${esc(placeholder)}</option>` +
    items.map(item => `<option value="${esc(valueFn(item))}">${esc(labelFn(item))}</option>`).join('');
}
function disableSelect(select, placeholder){
  if(!select)return;
  select.innerHTML=`<option value="">${esc(placeholder)}</option>`;
  select.disabled=true;
}
function populateRegionSelect(select){
  const geo=ensurePHGeoIndex();
  const regions=sortedUnique(geo.keys());
  setSelectOptions(select,regions,'Select Region');
  select.disabled=false;
}
function divisionsForRegion(region){
  const divisions=ensurePHGeoIndex().get(region);
  return divisions ? sortedUnique(divisions.keys()) : [];
}
function townsForDivision(region,division){
  const divisions=ensurePHGeoIndex().get(region);
  const towns=divisions?.get(division);
  return towns ? sortedUnique(towns.keys()) : [];
}
function schoolsForTown(region,division,town){
  return ensurePHGeoIndex().get(region)?.get(division)?.get(town) || [];
}
function schoolByCascade(region,division,town,schoolId){
  return schoolsForTown(region,division,town).find(s=>String(s.schoolId)===String(schoolId)) || null;
}

function initRosterSchoolCascade(force=false){
  const region=document.getElementById('playerRegion');
  if(!region)return;
  if(force || region.options.length<=1) populateRegionSelect(region);
  if(force){
    disableSelect(document.getElementById('playerDivision'),'Select Division / Province');
    disableSelect(document.getElementById('playerTown'),'Select Town / Municipality / City');
    disableSelect(document.getElementById('playerSchoolId'),'Select School');
    const school=document.getElementById('playerSchool');
    if(school)school.value='';
  }
}
function onRosterRegionChange(){
  const region=playerRegion.value;
  disableSelect(playerTown,'Select Town / Municipality / City');
  disableSelect(playerSchoolId,'Select School');
  playerSchool.value='';
  if(!region){
    disableSelect(playerDivision,'Select Division / Province');
    return;
  }
  setSelectOptions(playerDivision,divisionsForRegion(region),'Select Division / Province');
  playerDivision.disabled=false;
}
function onRosterDivisionChange(){
  const region=playerRegion.value, division=playerDivision.value;
  disableSelect(playerSchoolId,'Select School');
  playerSchool.value='';
  if(!region || !division){
    disableSelect(playerTown,'Select Town / Municipality / City');
    return;
  }
  setSelectOptions(playerTown,townsForDivision(region,division),'Select Town / Municipality / City');
  playerTown.disabled=false;
}
function onRosterTownChange(){
  const region=playerRegion.value, division=playerDivision.value, town=playerTown.value;
  playerSchool.value='';
  if(!region || !division || !town){
    disableSelect(playerSchoolId,'Select School');
    return;
  }
  const schools=schoolsForTown(region,division,town);
  setSelectOptions(
    playerSchoolId,
    schools,
    'Select School / DepEd School ID',
    s=>s.schoolId,
    s=>`${s.schoolId} — ${s.school}`
  );
  playerSchoolId.disabled=false;
}
function onRosterSchoolChange(){
  const s=schoolByCascade(playerRegion.value,playerDivision.value,playerTown.value,playerSchoolId.value);
  playerSchool.value=s?.school||'';
  const status=document.getElementById('schoolLookupStatus');
  if(status){
    status.innerHTML=s
      ? `✓ <b>${esc(s.schoolId)} — ${esc(s.school)}</b> • ${esc(s.town)} • ${esc(s.division)} • ${esc(s.region)}`
      : 'Select a school from the national DepEd dropdown.';
  }
}

function initWizardSchoolCascade(force=false){
  const region=document.getElementById('wizPlayerRegion');
  if(!region)return;
  if(force || region.options.length<=1) populateRegionSelect(region);
  if(force){
    disableSelect(document.getElementById('wizPlayerDivision'),'Select Division / Province');
    disableSelect(document.getElementById('wizPlayerTown'),'Select Town / Municipality / City');
    disableSelect(document.getElementById('wizPlayerSchoolId'),'Select School');
    const school=document.getElementById('wizPlayerSchool');
    if(school)school.value='';
  }
}
function onWizardRegionChange(){
  const region=wizPlayerRegion.value;
  disableSelect(wizPlayerTown,'Select Town / Municipality / City');
  disableSelect(wizPlayerSchoolId,'Select School');
  wizPlayerSchool.value='';
  if(!region){
    disableSelect(wizPlayerDivision,'Select Division / Province');
    return;
  }
  setSelectOptions(wizPlayerDivision,divisionsForRegion(region),'Select Division / Province');
  wizPlayerDivision.disabled=false;
}
function onWizardDivisionChange(){
  const region=wizPlayerRegion.value, division=wizPlayerDivision.value;
  disableSelect(wizPlayerSchoolId,'Select School');
  wizPlayerSchool.value='';
  if(!region || !division){
    disableSelect(wizPlayerTown,'Select Town / Municipality / City');
    return;
  }
  setSelectOptions(wizPlayerTown,townsForDivision(region,division),'Select Town / Municipality / City');
  wizPlayerTown.disabled=false;
}
function onWizardTownChange(){
  const region=wizPlayerRegion.value, division=wizPlayerDivision.value, town=wizPlayerTown.value;
  wizPlayerSchool.value='';
  if(!region || !division || !town){
    disableSelect(wizPlayerSchoolId,'Select School');
    return;
  }
  const schools=schoolsForTown(region,division,town);
  setSelectOptions(
    wizPlayerSchoolId,
    schools,
    'Select School / DepEd School ID',
    s=>s.schoolId,
    s=>`${s.schoolId} — ${s.school}`
  );
  wizPlayerSchoolId.disabled=false;
}
function onWizardSchoolChange(){
  const s=schoolByCascade(wizPlayerRegion.value,wizPlayerDivision.value,wizPlayerTown.value,wizPlayerSchoolId.value);
  wizPlayerSchool.value=s?.school||'';
  const status=document.getElementById('wizPlayerSchoolStatus');
  if(status){
    status.innerHTML=s
      ? `✓ <b>${esc(s.schoolId)} — ${esc(s.school)}</b> • ${esc(s.town)} • ${esc(s.division)} • ${esc(s.region)}`
      : 'Select a school from the national DepEd dropdown.';
  }
}

function schoolRowObject(r){
  return r ? {schoolId:String(r[0]),school:r[1]||'',town:r[2]||'',division:r[3]||'',region:r[4]||''} : null;
}

let PH_FAST_SCHOOL_INDEX_READY=false;
let PH_FAST_SCHOOL_ID_ROWS=[];
let PH_FAST_SCHOOL_WORD_BUCKETS=new Map();

function buildFastSchoolLookupIndex(){
  if(PH_FAST_SCHOOL_INDEX_READY)return;
  const idRows=[];
  const buckets=new Map();

  for(let i=0;i<PH_SCHOOLS_DATA.length;i++){
    const r=PH_SCHOOLS_DATA[i];
    const id=String(r[0]||'');
    idRows.push([id,i]);

    const name=String(r[1]||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ');
    const words=name.split(/\s+/).filter(Boolean);
    const keys=new Set();
    if(name.length>=3)keys.add(name.slice(0,3));
    for(const w of words)if(w.length>=3)keys.add(w.slice(0,3));

    for(const key of keys){
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(i);
    }
  }

  idRows.sort((a,b)=>a[0].localeCompare(b[0]));
  PH_FAST_SCHOOL_ID_ROWS=idRows;
  PH_FAST_SCHOOL_WORD_BUCKETS=buckets;
  PH_FAST_SCHOOL_INDEX_READY=true;
}

function scheduleFastSchoolLookupIndex(){
  const run=()=>{try{buildFastSchoolLookupIndex();ensureSchoolIdIndex();ensurePHGeoIndex()}catch(e){}};
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:3500});
  else setTimeout(run,700);
}

function nationalSchoolById(id){
  const i=ensureSchoolIdIndex().get(String(id));
  return i===undefined ? null : schoolRowObject(PH_SCHOOLS_DATA[i]);
}
function nationalSchoolsByIdPrefix(prefix,limit=8){
  prefix=String(prefix||'').trim();
  if(!prefix)return [];

  if(!PH_FAST_SCHOOL_INDEX_READY){
    const out=[];
    for(const r of PH_SCHOOLS_DATA){
      if(String(r[0]).startsWith(prefix)){
        out.push(schoolRowObject(r));
        if(out.length>=limit)break;
      }
    }
    return out;
  }

  const rows=PH_FAST_SCHOOL_ID_ROWS;
  let lo=0,hi=rows.length;
  while(lo<hi){
    const mid=(lo+hi)>>1;
    if(rows[mid][0]<prefix)lo=mid+1;else hi=mid;
  }
  const out=[];
  for(let i=lo;i<rows.length&&out.length<limit;i++){
    if(!rows[i][0].startsWith(prefix))break;
    out.push(schoolRowObject(PH_SCHOOLS_DATA[rows[i][1]]));
  }
  return out;
}
function nationalSchoolNameMatches(query,limit=8){
  const q=String(query||'').trim().toLowerCase();
  if(q.length<3)return [];

  const starts=[],contains=[];
  const scanIndexes=PH_FAST_SCHOOL_INDEX_READY
    ? (PH_FAST_SCHOOL_WORD_BUCKETS.get(q.slice(0,3))||[])
    : null;

  const scanRow=r=>{
    const name=String(r[1]||'');
    const n=name.toLowerCase();
    if(n.startsWith(q))starts.push(schoolRowObject(r));
    else if(n.includes(q))contains.push(schoolRowObject(r));
  };

  if(scanIndexes){
    for(const i of scanIndexes){
      scanRow(PH_SCHOOLS_DATA[i]);
      if(starts.length>=limit)break;
    }
  }else{
    for(const r of PH_SCHOOLS_DATA){
      scanRow(r);
      if(starts.length>=limit)break;
    }
  }

  if(PH_FAST_SCHOOL_INDEX_READY&&!starts.length&&!contains.length){
    for(const r of PH_SCHOOLS_DATA){
      const n=String(r[1]||'').toLowerCase();
      if(n.includes(q)){
        contains.push(schoolRowObject(r));
        if(contains.length>=limit)break;
      }
    }
  }
  return starts.concat(contains).slice(0,limit);
}

const BUILTIN_SCHOOLS = {
  "108661": {schoolId:"108661", school:"San Pablo Suha ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108643": {schoolId:"108643", school:"Ajos ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108644": {schoolId:"108644", school:"Anusan ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108645": {schoolId:"108645", school:"Bolo Elementary School", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108647": {schoolId:"108647", school:"Bulagsong ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108648": {schoolId:"108648", school:"Camandiison Elementary School", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108649": {schoolId:"108649", school:"Catanauan CS", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108650": {schoolId:"108650", school:"Cutcutan ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108651": {schoolId:"108651", school:"Dahican ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108652": {schoolId:"108652", school:"Don Abadilla ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108653": {schoolId:"108653", school:"Doongan Ibaba ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108654": {schoolId:"108654", school:"Ireneo L. Comiso ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108657": {schoolId:"108657", school:"Milagrosa ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108659": {schoolId:"108659", school:"San Isidro ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108660": {schoolId:"108660", school:"San Jose Anyao ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108662": {schoolId:"108662", school:"San Roque ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108663": {schoolId:"108663", school:"San Vicente Kanluran ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108664": {schoolId:"108664", school:"San Vicente Silangan ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108665": {schoolId:"108665", school:"Sta. Maria Dao ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108666": {schoolId:"108666", school:"Tagabas Ibaba ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108667": {schoolId:"108667", school:"Tagabas Ilaya ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108668": {schoolId:"108668", school:"Tagbacan Ibaba ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108669": {schoolId:"108669", school:"Peregrino C. Natividad ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108670": {schoolId:"108670", school:"Tagbacan Silangan ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "108671": {schoolId:"108671", school:"Tuhian ES", town:"Catanauan", division:"Quezon", region:"Region IV-A"},
  "301310": {schoolId:"301310", school:"Catanauan National High School", town:"Catanauan", division:"Quezon", region:"Region IV-A"}
};

function openSchoolDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    const req=indexedDB.open('ChessManagerSchoolDB',1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('schools'))db.createObjectStore('schools',{keyPath:'schoolId'});};
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function getImportedSchool(id){
  try{
    const db=await openSchoolDB(); if(!db)return null;
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('schools','readonly');const req=tx.objectStore('schools').get(String(id));
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
  }catch(e){return null;}
}
function fillSchoolFields(s){
  if(!s)return;
  playerSchool.value=s.school||'';
  playerTown.value=s.town||'';
  playerDivision.value=s.division||'';
  playerRegion.value=s.region||'';
}
function hideTournamentSchoolPopup(){
  const pop=document.getElementById('tournamentSchoolPopup');
  if(pop)pop.style.display='none';
}
function useTournamentSchool(id){
  const s=window._tournamentSchoolMatches?.find(x=>x.schoolId===String(id))
    || BUILTIN_SCHOOLS[String(id)]
    || nationalSchoolById(String(id));
  if(!s)return;
  document.getElementById('school').value=s.school;
  state.settings.school=s.school;
  state.settings.schoolId=s.schoolId||'';
  state.settings.schoolTown=s.town||'';
  state.settings.schoolDivision=s.division||'';
  state.settings.schoolRegion=s.region||'';
  persist();
  hideTournamentSchoolPopup();
  renderAll();
}
async function importedSchoolsByPrefix(prefix,limit=8){
  try{
    const db=await openSchoolDB(); if(!db)return [];
    return await new Promise((resolve,reject)=>{
      const out=[];
      const tx=db.transaction('schools','readonly');
      const st=tx.objectStore('schools');
      const range=IDBKeyRange.bound(String(prefix),String(prefix)+'\uffff');
      const req=st.openCursor(range);
      req.onsuccess=()=>{
        const cur=req.result;
        if(!cur || out.length>=limit){resolve(out);return;}
        out.push(cur.value);cur.continue();
      };
      req.onerror=()=>reject(req.error);
    });
  }catch(e){return [];}
}
let tournamentSchoolTimer=null;
function lookupTournamentSchool(){
  clearTimeout(tournamentSchoolTimer);
  tournamentSchoolTimer=setTimeout(async()=>{
    const input=document.getElementById('school');
    const pop=document.getElementById('tournamentSchoolPopup');
    if(!input||!pop)return;
    const q=input.value.trim();

    state.settings.school=q;
    persist();

    if(!q || q==='______________________________'){
      pop.style.display='none';
      return;
    }

    let matches=[];

    if(/^\d{2,}$/.test(q)){
      // School-ID search from the nationwide embedded database.
      const exact=BUILTIN_SCHOOLS[q] || nationalSchoolById(q) || await getImportedSchool(q);
      if(exact)matches.push(exact);

      const prefix=nationalSchoolsByIdPrefix(q,8);
      const imported=await importedSchoolsByPrefix(q,8);
      const seen=new Set(matches.map(x=>String(x.schoolId)));

      for(const x of [...prefix,...imported]){
        if(!seen.has(String(x.schoolId))){
          matches.push(x);seen.add(String(x.schoolId));
        }
        if(matches.length>=8)break;
      }

      // If a nearly complete 5/6-digit ID has no prefix result, offer close IDs.
      if(!matches.length && q.length>=5){
        const candidates=nationalSchoolsByIdPrefix(q.slice(0,-1),30);
        const editDistance=(a,b)=>{
          a=String(a);b=String(b);const dp=Array(b.length+1).fill(0).map((_,j)=>j);
          for(let i=1;i<=a.length;i++){
            let prev=dp[0];dp[0]=i;
            for(let j=1;j<=b.length;j++){
              const temp=dp[j];
              dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
              prev=temp;
            }
          }return dp[b.length];
        };
        matches=candidates.filter(x=>editDistance(q,x.schoolId)<=1).slice(0,8);
      }
    }else{
      // School-name search across the Philippines.
      matches=nationalSchoolNameMatches(q,8);
    }

    // Remove duplicate IDs.
    const uniq=[],seen=new Set();
    for(const x of matches){
      if(!x||seen.has(String(x.schoolId)))continue;
      seen.add(String(x.schoolId));uniq.push(x);
      if(uniq.length>=8)break;
    }
    matches=uniq;
    window._tournamentSchoolMatches=matches;

    pop.style.display='block';
    if(!matches.length){
      pop.innerHTML=`<div style="padding:11px 12px;color:var(--muted)">
        <b>No school found for ${esc(q)}</b><br>
        <small>The built-in nationwide database uses the SY 2020–2021 DepEd masterlist. Newer or renamed schools can be added by importing a newer masterlist CSV in Settings.</small>
      </div>`;
      return;
    }

    window._tournamentSchoolActiveIndex=-1;
    pop.innerHTML=matches.map((x,i)=>`<button type="button" data-school-result-index="${i}" onclick="useTournamentSchool('${esc(x.schoolId)}')" style="display:block;width:100%;border:0;border-bottom:1px solid var(--line);background:#0f1316;color:#fff;text-align:left;padding:10px 12px;cursor:pointer">
      <b>${esc(x.schoolId)} — ${esc(x.school)}</b><br>
      <small style="color:var(--muted)">${esc(x.town||'')}${x.division?' • '+esc(x.division):''}${x.region?' • '+esc(x.region):''}</small>
    </button>`).join('');
  },120);
}

function moveTournamentSchoolSelection(delta){
  const pop=document.getElementById('tournamentSchoolPopup');
  const matches=window._tournamentSchoolMatches||[];
  if(!pop||!matches.length)return;
  let idx=Number(window._tournamentSchoolActiveIndex??-1);
  idx=(idx+delta+matches.length)%matches.length;
  window._tournamentSchoolActiveIndex=idx;
  pop.querySelectorAll('[data-school-result-index]').forEach((b,i)=>b.classList.toggle('school-result-active',i===idx));
  pop.querySelector(`[data-school-result-index="${idx}"]`)?.scrollIntoView({block:'nearest'});
}
document.getElementById('school')?.addEventListener('keydown',e=>{
  const pop=document.getElementById('tournamentSchoolPopup');
  const matches=window._tournamentSchoolMatches||[];
  if(e.key==='ArrowDown'&&matches.length){e.preventDefault();moveTournamentSchoolSelection(1)}
  else if(e.key==='ArrowUp'&&matches.length){e.preventDefault();moveTournamentSchoolSelection(-1)}
  else if(e.key==='Enter'&&matches.length&&Number(window._tournamentSchoolActiveIndex)>=0){
    e.preventDefault();const hit=matches[Number(window._tournamentSchoolActiveIndex)];if(hit)useTournamentSchool(hit.schoolId);
  }else if(e.key==='Escape'&&pop?.style.display!=='none'){e.preventDefault();hideTournamentSchoolPopup()}
});

document.addEventListener('click' ,e=>{
  const wrap=document.getElementById('tournamentSchoolPopup');
  const input=document.getElementById('school');
  if(wrap&&input&&!wrap.contains(e.target)&&e.target!==input)hideTournamentSchoolPopup();
});
let schoolLookupTimer=null;
function lookupSchoolId(){ initRosterSchoolCascade(); }

function normalizedHeader(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseCSVLine(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}
    else if(c===','&&!q){out.push(cur);cur='';}
    else cur+=c;
  }out.push(cur);return out;
}
async function importSchoolMasterlist(e){
  const f=e.target.files[0]; if(!f)return;
  const txt=await f.text();
  const lines=txt.split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2){alert('The CSV appears empty.');return;}
  const headers=parseCSVLine(lines[0]);
  const nh=headers.map(normalizedHeader);
  const findIdx=(cands)=>{for(const c of cands){const i=nh.findIndex(h=>h===c||h.includes(c));if(i>=0)return i;}return -1;};
  const iId=findIdx(['schoolid','beisschoolid','schoolnumber']);
  const iName=findIdx(['schoolname','nameofschool']);
  const iTown=findIdx(['municipality','municipalitycity','citymunicipality','town','city']);
  const iDiv=findIdx(['division','province','schoolsdivision']);
  const iReg=findIdx(['region','regionaloffice']);
  if(iId<0||iName<0){alert('CSV needs at least School ID and School Name columns.');e.target.value='';return;}
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const v=parseCSVLine(lines[i]);const schoolId=String(v[iId]||'').trim().replace(/\.0$/,'');
    if(!schoolId)continue;
    rows.push({schoolId,school:String(v[iName]||'').trim(),town:iTown>=0?String(v[iTown]||'').trim():'',division:iDiv>=0?String(v[iDiv]||'').trim():'',region:iReg>=0?String(v[iReg]||'').trim():''});
  }
  try{
    const db=await openSchoolDB(); if(!db)throw new Error('IndexedDB unavailable');
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('schools','readwrite');const st=tx.objectStore('schools');rows.forEach(r=>st.put(r));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    schoolDbStatus.innerHTML=`✓ Imported <b>${rows.length.toLocaleString()}</b> school records for offline School ID lookup.`;
    alert(`Imported ${rows.length.toLocaleString()} school records.`);
  }catch(err){alert('Could not save the school database on this browser.');}
  e.target.value='';
}

function delegationLabel(p){
  const level=state.settings.meetLevel||'municipal';
  if(level==='municipal') return p.school||p.team||'';
  if(level==='division'||level==='regional') return p.town||p.school||p.team||'';
  if(level==='national') return p.region||p.division||p.town||p.school||'';
  return p.school||p.team||'';
}

function abbreviateSchoolName(name){
  let s=String(name||'').trim();
  if(!s)return '';

  const replacements=[
    [/\bNational High School\b/gi,'NHS'],
    [/\bSenior High School\b/gi,'SHS'],
    [/\bJunior High School\b/gi,'JHS'],
    [/\bIntegrated School\b/gi,'IS'],
    [/\bElementary School\b/gi,'ES'],
    [/\bCentral School\b/gi,'CS'],
    [/\bHigh School\b/gi,'HS'],
    [/\bLearning Center\b/gi,'LC'],
    [/\bLearning Centre\b/gi,'LC'],
    [/\bMemorial School\b/gi,'MS'],
    [/\bKiddie School\b/gi,'Kiddie Sch.'],
    [/\bPreparatory School\b/gi,'Prep. Sch.'],
    [/\bChristian School\b/gi,'Christian Sch.'],
    [/\bAcademy\b/gi,'Acad.'],
    [/\bCollege\b/gi,'Coll.']
  ];
  for(const [re,short] of replacements)s=s.replace(re,short);

  s=s
    .replace(/\bElementary Sch\.?\b/gi,'ES')
    .replace(/\bNational HS\b/gi,'NHS')
    .replace(/\bSenior HS\b/gi,'SHS')
    .replace(/\bJunior HS\b/gi,'JHS')
    .replace(/\bLearning Ctr\.?\b/gi,'LC')
    .replace(/,\s*Inc\.?$/i,'')
    .replace(/\s+Inc\.?$/i,'')
    .replace(/\s{2,}/g,' ')
    .trim();

  // Normalize existing abbreviations from masterlists.
  s=s.replace(/\bEs\b/g,'ES').replace(/\bHs\b/g,'HS').replace(/\bNhs\b/g,'NHS');
  return s;
}

function compactDelegationLabel(p){
  if(!p)return '';
  const level=state.settings.meetLevel||'municipal';
  if(level==='municipal'){
    return abbreviateSchoolName(p.school||p.team||'');
  }
  if(level==='division'||level==='regional'){
    return p.town||abbreviateSchoolName(p.school||p.team||'');
  }
  if(level==='national'){
    return p.region||p.division||p.town||abbreviateSchoolName(p.school||'');
  }
  return abbreviateSchoolName(delegationLabel(p));
}
