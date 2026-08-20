// Chess Tournament Manager 2.0
// Pairing engines, Swiss safeguards, rounds/results, and pairing print.

function playerHistory(){
  const h={};
  state.players.forEach(p=>h[p.id]={score:0,opp:[],colors:[],wins:0,blackWins:0,roundScores:[],bye:0});
  for(const rnd of state.rounds){
    for(const g of rnd.games){
      if(g.bye){
        if(h[g.white]){
          // Swiss pairing-allocated bye = 1 point.
          // Round-Robin scheduled sit-out = 0 points because no game is played.
          const byePoints=state.settings.mode==='roundrobin' ? 0 : state.settings.scoring.bye;
          h[g.white].score += byePoints;
          h[g.white].bye++;
        }
        continue;
      }
      if(!h[g.white]||!h[g.black])continue;
      h[g.white].opp.push(g.black);
      h[g.black].opp.push(g.white);
      h[g.white].colors.push('W');
      h[g.black].colors.push('B');
      let ws=0,bs=0;
      if(g.result==='1-0'||g.result==='1F-0F'){
        ws=state.settings.scoring.win;bs=state.settings.scoring.loss;h[g.white].wins++;
      } else if(g.result==='0-1'||g.result==='0F-1F'){
        ws=state.settings.scoring.loss;bs=state.settings.scoring.win;h[g.black].wins++;h[g.black].blackWins++;
      } else if(g.result==='½-½'){
        ws=state.settings.scoring.draw;bs=state.settings.scoring.draw;
      }
      h[g.white].score+=ws;
      h[g.black].score+=bs;
    }
    // Record the running score once per tournament round, even if a format
    // contains multiple games per pairing (e.g. Double Swiss).
    for(const p of state.players){
      h[p.id].roundScores.push(h[p.id].score);
    }
  }
  return h;
}
function scoreOf(id){return playerHistory()[id]?.score||0;}
function played(a,b){return state.rounds.some(r=>r.games.some(g=>!g.bye&&((g.white===a&&g.black===b)||(g.white===b&&g.black===a))));}
function colorBalance(id){
  const c=playerHistory()[id]?.colors||[]; return c.filter(x=>x==='W').length-c.filter(x=>x==='B').length;
}
function lastColors(id,n=2){return (playerHistory()[id]?.colors||[]).slice(-n);}
function chooseColors(a,b){
  const ba=colorBalance(a.id),bb=colorBalance(b.id),la=lastColors(a.id),lb=lastColors(b.id);
  const penalty=(pid,color)=>{
    const bal=colorBalance(pid)+(color==='W'?1:-1); let p=Math.abs(bal)*2;
    const l=lastColors(pid,2); if(l.length===2&&l[0]===color&&l[1]===color)p+=20;
    return p;
  };
  const p1=penalty(a.id,'W')+penalty(b.id,'B'), p2=penalty(a.id,'B')+penalty(b.id,'W');
  if(p1<p2)return [a.id,b.id]; if(p2<p1)return [b.id,a.id];
  return Math.random()<.5?[a.id,b.id]:[b.id,a.id];
}
function selectBye(players){
  const h=playerHistory();
  const eligible=players.filter(p=>(h[p.id]?.bye||0)===0);
  if(!eligible.length)return null;
  return [...eligible].sort((a,b)=>
    (h[a.id].score-h[b.id].score)||
    ((a.unrated?0:a.rating)-(b.unrated?0:b.rating))||
    a.name.localeCompare(b.name)
  )[0];
}

function buildConflictFreeSwissPairs(pool,pairingScore){
  const h=playerHistory();
  const historyPairs=new Set();
  for(const rnd of state.rounds){
    for(const g of rnd.games){
      if(g.bye||!g.white||!g.black)continue;
      historyPairs.add([g.white,g.black].sort().join('|'));
    }
  }
  const canPair=(a,b)=>!historyPairs.has([a.id,b.id].sort().join('|'));
  const balance=p=>{
    const colors=h[p.id]?.colors||[];
    return colors.filter(x=>x==='W').length-colors.filter(x=>x==='B').length;
  };
  const pairCost=(a,b)=>
    Math.abs(pairingScore(a)-pairingScore(b))*10000+
    Math.abs(balance(a)+balance(b))*50+
    Math.abs((a.unrated?0:a.rating||0)-(b.unrated?0:b.rating||0))/10;

  let nodes=0;
  const NODE_LIMIT=250000;

  const search=(remaining,pairs)=>{
    if(!remaining.length)return pairs;
    if(++nodes>NODE_LIMIT)return null;

    let pickIndex=0,minOptions=Infinity;
    for(let i=0;i<remaining.length;i++){
      let options=0;
      for(let j=0;j<remaining.length;j++){
        if(i!==j && canPair(remaining[i],remaining[j]))options++;
      }
      if(options<minOptions){minOptions=options;pickIndex=i;}
      if(minOptions===0)break;
    }
    if(minOptions===0)return null;

    const a=remaining[pickIndex];
    const rest=remaining.filter((_,i)=>i!==pickIndex);
    const candidates=rest.filter(b=>canPair(a,b)).sort((x,y)=>pairCost(a,x)-pairCost(a,y));

    for(const b of candidates){
      const next=rest.filter(x=>x.id!==b.id);
      const found=search(next,[...pairs,[a,b]]);
      if(found)return found;
    }
    return null;
  };

  return search([...pool],[]);
}

function validateSwissAbsoluteCriteria(games,{doubleSwiss=false}={}){
  if(!Array.isArray(games)||!games.length)return {ok:false,message:'No valid games were generated.'};
  const h=playerHistory();
  const seenPlayers=new Map();
  const seenCurrentPairs=new Set();

  for(const g of games){
    if(g.bye){
      if(!g.white)return {ok:false,message:'A pairing-allocated bye has no player.'};
      if((h[g.white]?.bye||0)>0){
        const p=getPlayer(g.white);
        return {ok:false,message:`${p?.name||'A player'} already received a pairing-allocated bye.`};
      }
      seenPlayers.set(g.white,(seenPlayers.get(g.white)||0)+1);
      continue;
    }

    if(!g.white||!g.black)return {ok:false,message:'A generated board is missing a player.'};

    const key=[g.white,g.black].sort().join('|');
    if(played(g.white,g.black)){
      const a=getPlayer(g.white),b=getPlayer(g.black);
      return {ok:false,message:`Repeat opponent blocked: ${a?.name||'Player'} vs ${b?.name||'Player'} already occurred.`};
    }

    if(seenCurrentPairs.has(key) && !doubleSwiss){
      return {ok:false,message:'The same opponents were paired twice in the new round.'};
    }
    seenCurrentPairs.add(key);

    seenPlayers.set(g.white,(seenPlayers.get(g.white)||0)+1);
    seenPlayers.set(g.black,(seenPlayers.get(g.black)||0)+1);
  }

  if(!doubleSwiss){
    for(const [id,count] of seenPlayers){
      if(count>1){
        const p=getPlayer(id);
        return {ok:false,message:`${p?.name||'A player'} appears more than once in the generated round.`};
      }
    }
  }
  return {ok:true,message:''};
}

function swissPairByScore(players, pairingScore){
  const h=playerHistory();
  let pool=[...players].sort((a,b)=>
    pairingScore(b)-pairingScore(a)||
    (b.unrated?0:b.rating||0)-(a.unrated?0:a.rating||0)||
    a.name.localeCompare(b.name)
  );
  const games=[];

  if(pool.length%2){
    const bye=selectBye(pool);
    if(!bye){
      showToast('No player is eligible for another pairing-allocated bye. Pairing stopped.','error','Swiss pairing blocked');
      return null;
    }
    games.push({id:uid(),board:0,white:bye.id,black:null,result:'BYE',bye:true});
    pool=pool.filter(p=>p.id!==bye.id);
  }

  const pairs=buildConflictFreeSwissPairs(pool,pairingScore);
  if(!pairs){
    showToast('A conflict-free Swiss round could not be produced without a repeat opponent. Pairing stopped instead of forcing an invalid board.','error','Swiss pairing blocked');
    return null;
  }

  pairs.sort((x,y)=>Math.max(pairingScore(y[0]),pairingScore(y[1]))-Math.max(pairingScore(x[0]),pairingScore(x[1])));
  let board=1;
  for(const [a,b] of pairs){
    const [w,bl]=chooseColors(a,b);
    games.push({id:uid(),board:board++,white:w,black:bl,result:'',bye:false});
  }
  const byeGame=games.find(g=>g.bye);
  if(byeGame)byeGame.board=board;
  return games;
}

function swissPair(players){
  const h=playerHistory();
  return swissPairByScore(players,p=>h[p.id]?.score||0);
}

function acceleratedSwissPair(players){
  const h=playerHistory();
  const seeded=[...players].sort((a,b)=>(b.rating||0)-(a.rating||0)||a.name.localeCompare(b.name));
  const top=new Set(seeded.slice(0,Math.ceil(seeded.length/2)).map(p=>p.id));
  const opening=state.rounds.length<2;
  return swissPairByScore(players,p=>(h[p.id]?.score||0)+(opening&&top.has(p.id)?1:0));
}

function dutchStyleSwissPair(players){
  const h=playerHistory();
  const games=swissPairByScore(players,p=>h[p.id]?.score||0);
  if(games)games.forEach(g=>{if(!g.bye)g.dutchStyle=true;});
  return games;
}
function doubleSwissPair(players){
  const base=(state.settings.doubleSwissBase||'dutch')==='flexible'
    ? swissPair(players)
    : dutchStyleSwissPair(players);
  const out=[];
  let board=1;
  for(const g of base){
    if(g.bye){
      out.push({...g,board:board++});
      continue;
    }
    const matchId=uid();
    out.push({...g,id:uid(),board:board++,matchId,doubleSwissGame:1});
    out.push({id:uid(),board:board++,white:g.black,black:g.white,result:'',bye:false,matchId,doubleSwissGame:2});
  }
  return out;
}
function roundRobinSchedule(){
  let arr=[...state.players];
  if(arr.length%2)arr.push({id:'BYE',name:'BYE'});
  const n=arr.length, schedules=[];
  let work=[...arr];
  for(let r=0;r<n-1;r++){
    const games=[];
    for(let i=0;i<n/2;i++){
      const a=work[i],b=work[n-1-i];
      if(a.id==='BYE'||b.id==='BYE'){
        const real=a.id==='BYE'?b:a; games.push({id:uid(),board:games.length+1,white:real.id,black:null,result:'BYE',bye:true});
      }else{
        const reverse=(r+i)%2===1;games.push({id:uid(),board:games.length+1,white:reverse?b.id:a.id,black:reverse?a.id:b.id,result:'',bye:false});
      }
    }
    schedules.push(games);
    work=[work[0],work[n-1],...work.slice(1,n-1)];
  }
  if(state.settings.roundRobinType==='double'){
    const second=schedules.map(round=>round.map(g=>{
      if(g.bye)return {...g,id:uid()};
      return {...g,id:uid(),white:g.black,black:g.white,result:''};
    }));
    return [...schedules,...second];
  }
  return schedules;
}
function knockoutPair(){
  if(state.rounds.length===0){
    const seeded=[...state.players].sort((a,b)=>b.rating-a.rating);
    const games=[];let board=1;
    while(seeded.length){
      const a=seeded.shift(),b=seeded.pop();
      if(!b)games.push({id:uid(),board:board++,white:a.id,black:null,result:'BYE',bye:true});
      else games.push({id:uid(),board:board++,white:a.id,black:b.id,result:'',bye:false});
    } return games;
  }
  const prev=currentRound(); const winners=[];
  for(const g of prev.games){
    if(g.bye)winners.push(getPlayer(g.white));
    else if(g.result==='1-0'||g.result==='1F-0F')winners.push(getPlayer(g.white));
    else if(g.result==='0-1'||g.result==='0F-1F')winners.push(getPlayer(g.black));
    else {alert('Knockout games must have a winner. Resolve draws before generating the next round.');return null;}
  }
  if(winners.length<=1){alert('Knockout tournament already has a champion.');return null;}
  const games=[];let board=1;
  for(let i=0;i<winners.length;i+=2){
    const a=winners[i],b=winners[i+1];
    if(!b)games.push({id:uid(),board:board++,white:a.id,black:null,result:'BYE',bye:true});
    else {const [w,bl]=chooseColors(a,b);games.push({id:uid(),board:board++,white:w,black:bl,result:'',bye:false});}
  } return games;
}

function teamKeyForPlayer(p){
  return delegationLabel(p)||p.school||p.town||p.region||'Unassigned';
}
function getTeams(){
  const map=new Map();
  for(const p of state.players){
    const key=teamKeyForPlayer(p);
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(p);
  }
  return [...map.entries()].map(([name,players])=>({
    name,
    players:players.sort((a,b)=>(b.unrated?0:b.rating)-(a.unrated?0:a.rating)||a.name.localeCompare(b.name)),
    avgRating:players.length?players.reduce((s,p)=>s+(p.unrated?0:p.rating),0)/players.length:0
  }));
}
function teamHistory(){
  const teams=getTeams();
  const h={};
  teams.forEach(t=>h[t.name]={matchPoints:0,boardPoints:0,wins:0,opponents:[]});
  for(const rnd of state.rounds){
    if(!rnd.teamMatches)continue;
    for(const m of rnd.teamMatches){
      if(m.bye){
        if(h[m.teamA]){
          h[m.teamA].matchPoints+=(state.settings.teamMatchWin??2);
          h[m.teamA].boardPoints+=(state.settings.teamBoards||4);
          h[m.teamA].wins++;
        }
        continue;
      }
      if(!h[m.teamA]||!h[m.teamB])continue;
      h[m.teamA].opponents.push(m.teamB);
      h[m.teamB].opponents.push(m.teamA);
      const games=rnd.games.filter(g=>g.matchId===m.id);
      let aBP=0,bBP=0,complete=true;
      for(const g of games){
        if(!g.result){complete=false;continue;}
        const whiteTeam=g.whiteTeam, blackTeam=g.blackTeam;
        let w=0,b=0;
        if(g.result==='1-0'||g.result==='1F-0F'){w=1;}
        else if(g.result==='0-1'||g.result==='0F-1F'){b=1;}
        else if(g.result==='½-½'){w=.5;b=.5;}
        if(whiteTeam===m.teamA){aBP+=w;bBP+=b;}else{aBP+=b;bBP+=w;}
      }
      h[m.teamA].boardPoints+=aBP;
      h[m.teamB].boardPoints+=bBP;
      if(complete){
        if(aBP>bBP){h[m.teamA].matchPoints+=(state.settings.teamMatchWin??2);h[m.teamA].wins++;}
        else if(bBP>aBP){h[m.teamB].matchPoints+=(state.settings.teamMatchWin??2);h[m.teamB].wins++;}
        else{
          h[m.teamA].matchPoints+=(state.settings.teamMatchDraw??1);
          h[m.teamB].matchPoints+=(state.settings.teamMatchDraw??1);
        }
      }
    }
  }
  return h;
}
function teamPlayed(a,b){
  return state.rounds.some(r=>(r.teamMatches||[]).some(m=>!m.bye&&((m.teamA===a&&m.teamB===b)||(m.teamA===b&&m.teamB===a))));
}
function buildTeamMatch(teamA,teamB,matchNo,roundNo){
  const boards=Math.max(1,state.settings.teamBoards||4);
  const matchId=uid();
  const games=[];
  for(let i=0;i<boards;i++){
    const a=teamA.players[i], b=teamB.players[i];
    if(!a&&!b)continue;
    if(a&&!b){
      games.push({id:uid(),board:i+1,white:a.id,black:null,result:'BYE',bye:true,matchId,whiteTeam:teamA.name,blackTeam:teamB.name,teamBoard:true});
      continue;
    }
    if(!a&&b){
      games.push({id:uid(),board:i+1,white:b.id,black:null,result:'BYE',bye:true,matchId,whiteTeam:teamB.name,blackTeam:teamA.name,teamBoard:true});
      continue;
    }
    const aWhite=((roundNo+i)%2===0);
    games.push({
      id:uid(),board:i+1,
      white:aWhite?a.id:b.id,black:aWhite?b.id:a.id,
      result:'',bye:false,matchId,
      whiteTeam:aWhite?teamA.name:teamB.name,
      blackTeam:aWhite?teamB.name:teamA.name,
      teamBoard:true
    });
  }
  return {match:{id:matchId,number:matchNo,teamA:teamA.name,teamB:teamB.name,bye:false},games};
}
function generateTeamSwissRound(){
  const teams=getTeams();
  const h=teamHistory();
  let pool=[...teams].sort((a,b)=>(h[b.name]?.matchPoints||0)-(h[a.name]?.matchPoints||0)||(h[b.name]?.boardPoints||0)-(h[a.name]?.boardPoints||0)||b.avgRating-a.avgRating);
  const teamMatches=[],games=[];
  if(pool.length%2){
    const bye=pool.pop();
    const id=uid();
    teamMatches.push({id,number:teamMatches.length+1,teamA:bye.name,teamB:null,bye:true});
  }
  let n=1;
  while(pool.length){
    const a=pool.shift();
    let idx=pool.findIndex(b=>!teamPlayed(a.name,b.name));
    if(idx<0)idx=0;
    const b=pool.splice(idx,1)[0];
    const built=buildTeamMatch(a,b,n++,state.rounds.length+1);
    teamMatches.push(built.match);
    games.push(...built.games);
  }
  return {teamMatches,games};
}
function teamRoundRobinSchedule(){
  let teams=getTeams().map(t=>t.name);
  if(teams.length%2)teams.push('BYE');
  const all=[],n=teams.length;
  let work=[...teams];
  for(let r=0;r<n-1;r++){
    const matches=[];
    for(let i=0;i<n/2;i++){
      const a=work[i],b=work[n-1-i];
      matches.push([a,b]);
    }
    all.push(matches);
    work=[work[0],work[n-1],...work.slice(1,n-1)];
  }
  return all;
}
function generateTeamRound(){
  const teams=getTeams();
  if(teams.length<2){alert('A team tournament needs at least 2 different delegations/teams.');return null;}
  if((state.settings.teamFormat||'swiss')==='roundrobin'){
    const sched=teamRoundRobinSchedule();
    const idx=state.rounds.length;
    if(idx>=sched.length){alert('Team Round Robin is complete.');return null;}
    const teamMap=new Map(teams.map(t=>[t.name,t]));
    const teamMatches=[],games=[];
    let no=1;
    for(const [aName,bName] of sched[idx]){
      if(aName==='BYE'||bName==='BYE'){
        const real=aName==='BYE'?bName:aName;
        teamMatches.push({id:uid(),number:no++,teamA:real,teamB:null,bye:true});
      }else{
        const built=buildTeamMatch(teamMap.get(aName),teamMap.get(bName),no++,idx+1);
        teamMatches.push(built.match);games.push(...built.games);
      }
    }
    return {teamMatches,games};
  }
  return generateTeamSwissRound();
}
function teamStandings(){
  const h=teamHistory();
  return getTeams().map(t=>({...t,...(h[t.name]||{})}))
    .sort((a,b)=>(b.matchPoints||0)-(a.matchPoints||0)||(b.boardPoints||0)-(a.boardPoints||0)||(b.wins||0)-(a.wins||0)||b.avgRating-a.avgRating||a.name.localeCompare(b.name));
}

function generateNextRound(skipHistory=false){
  // Capture any currently selected result before validating the round.
  syncVisibleResults();
  persist();

  // Do not call syncSettings() here because tournament format/settings
  // are already fixed for the active tournament and the dashboard mode field is locked.
  if(state.players.length<2){alert('Register at least 2 players first.');return;}
  const cur=currentRound();
  if(cur && cur.games.some(g=>!g.bye&&!g.result)){
    alert('Please select a result for every played game before generating the next round.');
    return;
  }
  if(state.settings.mode!=='knockout' && state.rounds.length>=state.settings.rounds){alert('All scheduled rounds are already generated.');return;}
  let games;
  if(state.settings.mode==='swiss'){
    const v=state.settings.swissVariant||'flexible';
    if(v==='dutch')games=dutchStyleSwissPair(state.players);
    else if(v==='accelerated')games=acceleratedSwissPair(state.players);
    else if(v==='double')games=doubleSwissPair(state.players);
    else games=swissPair(state.players);
  }
  if(state.settings.mode==='team'){
    const teamRound=generateTeamRound();
    if(!teamRound)return;
    if(!skipHistory)pushHistory(`Generate Round ${state.rounds.length+1}`);
    state.rounds.push({number:state.rounds.length+1,games:teamRound.games,teamMatches:teamRound.teamMatches});
    persist();renderAll();goTab('pairings');
    showToast(`Round ${state.rounds.length} generated successfully.`,'success','Pairings ready');
    return;
  }
  if(state.settings.mode==='roundrobin'){
    const sched=roundRobinSchedule();
    if(state.rounds.length>=sched.length){alert('Round Robin schedule is complete.');return;}
    games=sched[state.rounds.length];
  }
  if(state.settings.mode==='knockout')games=knockoutPair();
  if(!games)return;

  if(state.settings.mode==='swiss'){
    const check=validateSwissAbsoluteCriteria(games,{doubleSwiss:state.settings.swissVariant==='double'});
    if(!check.ok){showToast(check.message,'error','Pairing blocked');return;}
  }

  if(!skipHistory)pushHistory(`Generate Round ${state.rounds.length+1}`);
  state.rounds.push({number:state.rounds.length+1,games});
  persist();renderAll();goTab('pairings');
  showToast(`Round ${state.rounds.length} generated successfully.`,'success','Pairings ready');
}

function openEditRoundModal(){
  syncVisibleResults();
  persist();

  if(!state.rounds.length){
    alert('There are no generated rounds to edit yet.');
    return;
  }

  const select=document.getElementById('editRoundSelect');
  select.innerHTML=state.rounds
    .map(r=>`<option value="${r.number}" ${r.number===currentRound()?.number?'selected':''}>Round ${r.number}</option>`)
    .join('');

  renderEditRoundGames();
  document.getElementById('editRoundModal').classList.add('show');
}

function closeEditRoundModal(){
  document.getElementById('editRoundModal').classList.remove('show');
}

function selectedEditRound(){
  const n=+document.getElementById('editRoundSelect')?.value;
  return state.rounds.find(r=>r.number===n)||null;
}

function renderEditRoundGames(){
  const r=selectedEditRound();
  const box=document.getElementById('editRoundGames');
  const warning=document.getElementById('editRoundWarning');
  if(!r||!box)return;

  const hasLater=state.rounds.some(x=>x.number>r.number);
  if(warning){
    warning.style.display=hasLater?'block':'none';
    warning.innerHTML=hasLater
      ? `<b>Important:</b> You are editing Round ${r.number}, but later rounds already exist. Correcting this result will recalculate scores, rankings, and tie-breaks. Existing later-round pairings will remain as originally generated.`
      : '';
  }

  if(state.settings.mode==='team' && r.teamMatches){
    box.innerHTML=r.teamMatches.map(m=>{
      if(m.bye){
        return `<div class="pair-card"><b>Team Match ${m.number}: ${esc(m.teamA)}</b> — TEAM BYE</div>`;
      }
      const games=r.games.filter(g=>g.matchId===m.id).sort((a,b)=>a.board-b.board);
      return `<div class="pair-card">
        <h3>Match ${m.number}: ${esc(m.teamA)} vs ${esc(m.teamB)}</h3>
        <table>
          <thead><tr><th>Board</th><th>White</th><th>Correct Result</th><th>Black</th></tr></thead>
          <tbody>${games.map(g=>{
            const w=getPlayer(g.white),b=getPlayer(g.black);
            if(g.bye){
              return `<tr><td>${g.board}</td><td>${esc(playerDisplay(w))}</td><td>BYE</td><td>—</td></tr>`;
            }
            return `<tr>
              <td>${g.board}</td>
              <td>${esc(w?.name||'')}<br><small>${esc(g.whiteTeam||'')}</small></td>
              <td><select data-edit-round-result="${g.id}">${resultOptions(g.result)}</select></td>
              <td>${esc(b?.name||'')}<br><small>${esc(g.blackTeam||'')}</small></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
    }).join('');
    return;
  }

  box.innerHTML=`<table>
    <thead><tr><th>Board</th><th>White</th><th>Correct Result</th><th>Black</th></tr></thead>
    <tbody>${[...r.games].sort((a,b)=>a.board-b.board).map(g=>{
      const w=getPlayer(g.white),b=getPlayer(g.black);
      if(g.bye){
        return `<tr>
          <td><b>${g.board}</b></td>
          <td>${esc(playerDisplay(w))}</td>
          <td><span class="badge gold">BYE</span></td>
          <td>—</td>
        </tr>`;
      }
      return `<tr>
        <td><b>${g.board}</b></td>
        <td>${esc(playerDisplay(w))}</td>
        <td><select data-edit-round-result="${g.id}">${resultOptions(g.result)}</select></td>
        <td>${esc(playerDisplay(b))}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function saveEditedRound(){
  const r=selectedEditRound();
  if(!r)return;

  const hasLater=state.rounds.some(x=>x.number>r.number);
  if(hasLater){
    const ok=await appConfirm(
      `Save corrections to Round ${r.number}? Rankings and tie-breaks will be recalculated, but already-generated later pairings will NOT be changed.`,
      {title:'Correct Earlier Round',confirmText:'Save Corrections',danger:false}
    );
    if(!ok)return;
  }

  pushHistory(`Edit results — Round ${r.number}`);

  document.querySelectorAll('[data-edit-round-result]').forEach(sel=>{
    const g=r.games.find(x=>x.id===sel.dataset.editRoundResult);
    if(g)g.result=sel.value;
  });

  persist();
  renderAll();
  renderPairingsRanking();
  closeEditRoundModal();

  const status=document.getElementById('saveStatus');
  if(status){
    status.textContent=`Round ${r.number} corrected`;
    setTimeout(()=>status.textContent='Ready',1200);
  }

  showToast(`Round ${r.number} corrections saved. Rankings and tie-breaks were recalculated.`,'success','Round corrected');
}

async function rebuildCurrentRound(){
  if(!state.rounds.length){generateNextRound();return;}
  if(!await appConfirm('Regenerate the current round? Any entered results in this round will be lost.',{title:'Regenerate Round',confirmText:'Regenerate'}))return;
  pushHistory(`Regenerate Round ${state.rounds.length}`);
  state.rounds.pop();persist();generateNextRound(true);
}

function syncVisibleResults(){
  const r=currentRound();
  if(!r)return;
  document.querySelectorAll('[data-result-id]').forEach(sel=>{
    const g=r.games.find(x=>x.id===sel.dataset.resultId);
    if(g)g.result=sel.value;
  });
}

function updateGameResult(gameId,value){
  const r=currentRound();
  if(!r)return;
  const g=r.games.find(x=>x.id===gameId);
  if(!g)return;
  if(g.result===value)return;
  pushHistory(`Change result — Round ${r.number}, Board ${g.board}`);
  g.result=value;
  persist();
  const status=document.getElementById('saveStatus');
  if(status){
    status.textContent='Result saved';
    setTimeout(()=>status.textContent='Ready',900);
  }

  // Update standings/reports immediately without rebuilding the pairing screen.
  renderStandings();
  renderPairingsRanking();
  renderDashboard();
  renderReports();
}

function saveResults(){
  const r=currentRound();if(!r)return;
  syncVisibleResults();
  persist();
  renderAll();
  showToast('Round results saved.','success','Saved');
}
function printPairings(){
  goTab('pairings');
  buildCleanPairingPrint();

  const cleanup=()=>{
    document.body.classList.remove('printing-pairings');
    window.removeEventListener('afterprint',cleanup);
  };

  document.body.classList.add('printing-pairings');
  window.addEventListener('afterprint',cleanup);
  setTimeout(()=>window.print(),60);
}

function pairingPrintPlayer(p){
  if(!p)return {name:'—',delegation:'',rating:'—'};
  ensurePlayerStructuredName(p);
  return {
    name:p.name||'—',
    delegation:compactDelegationLabel(p)||p.school||'',
    rating:ratingText(p)
  };
}

function cleanFormatName(){
  if(state.settings.mode==='swiss'){
    const v={
      flexible:'Flexible / Practical Swiss',
      dutch:'Dutch-style Swiss',
      accelerated:'Accelerated Swiss',
      double:'Double Swiss'
    }[state.settings.swissVariant||'flexible'];
    return `Swiss System — ${v}`;
  }
  if(state.settings.mode==='roundrobin'){
    return state.settings.roundRobinType==='double'?'Double Round Robin':'Round Robin';
  }
  if(state.settings.mode==='team'){
    return (state.settings.teamFormat||'swiss')==='swiss'?'Team Swiss':'Team Round Robin';
  }
  if(state.settings.mode==='knockout')return 'Knockout';
  return modeName(state.settings.mode);
}

function buildCleanPairingPrint(){
  const sheet=document.getElementById('printPairingSheet');
  const r=currentRound();
  if(!sheet)return;

  if(!r){
    sheet.innerHTML='<div style="font-family:Arial;color:#000">No round generated yet.</div>';
    return;
  }

  const s=state.settings;
  const category=s.tournamentCategory||s.category||'';
  const meet=(s.meetLevel||'').replace(/^\w/,c=>c.toUpperCase());

  let rows='';

  if(state.settings.mode==='team' && r.teamMatches){
    let displayBoard=1;
    for(const m of r.teamMatches){
      if(m.bye){
        rows+=`<tr>
          <td class="board">${displayBoard++}</td>
          <td colspan="2"><span class="player-name">${esc(m.teamA)}</span></td>
          <td class="result">TEAM BYE</td>
          <td colspan="2">—</td>
        </tr>`;
        continue;
      }
      const games=r.games.filter(g=>g.matchId===m.id).sort((a,b)=>a.board-b.board);
      for(const g of games){
        const w=pairingPrintPlayer(getPlayer(g.white));
        const b=pairingPrintPlayer(getPlayer(g.black));
        rows+=`<tr>
          <td class="board">${esc(g.board)}</td>
          <td><span class="player-name">${esc(w.name)}</span><span class="delegation">${esc(g.whiteTeam||w.delegation)}</span></td>
          <td class="rating">${esc(w.rating)}</td>
          <td class="result">${esc(g.bye?'BYE':(g.result||'________'))}</td>
          <td><span class="player-name">${esc(b.name)}</span><span class="delegation">${esc(g.blackTeam||b.delegation)}</span></td>
          <td class="rating">${esc(b.rating)}</td>
        </tr>`;
      }
    }
  }else{
    for(const g of [...r.games].sort((a,b)=>a.board-b.board)){
      const w=pairingPrintPlayer(getPlayer(g.white));
      const b=pairingPrintPlayer(getPlayer(g.black));
      rows+=`<tr>
        <td class="board">${esc(g.board)}</td>
        <td><span class="player-name">${esc(w.name)}</span><span class="delegation">${esc(w.delegation)}</span></td>
        <td class="rating">${esc(w.rating)}</td>
        <td class="result">${esc(g.bye?'BYE':(g.result||'________'))}</td>
        <td>${g.bye?'—':`<span class="player-name">${esc(b.name)}</span><span class="delegation">${esc(b.delegation)}</span>`}</td>
        <td class="rating">${g.bye?'—':esc(b.rating)}</td>
      </tr>`;
    }
  }

  sheet.innerHTML=`
    <div class="print-pairing-header">
      <h1>${esc(s.name||'Chess Tournament')}</h1>
      ${category?`<div class="category">${esc(category)}</div>`:''}
      <div class="round-title">PAIRINGS — ROUND ${esc(r.number)}</div>
    </div>

    <div class="print-meta">
      <div><b>Format:</b> ${esc(cleanFormatName())}</div>
      <div><b>Meet Level:</b> ${esc(meet||'—')}</div>
      <div><b>Date:</b> ${esc(s.date||'—')}</div>
      <div><b>Time Control:</b> ${esc(s.timeControl||'—')}</div>
      <div><b>Venue:</b> ${esc(s.venue||'—')}</div>
      <div><b>Players:</b> ${state.players.length}</div>
    </div>

    <table class="print-pairing-table">
      <colgroup>
        <col style="width:7%">
        <col style="width:32%">
        <col style="width:8%">
        <col style="width:11%">
        <col style="width:34%">
        <col style="width:8%">
      </colgroup>
      <thead>
        <tr>
          <th>Board</th>
          <th>White</th>
          <th>Rtg</th>
          <th>Result</th>
          <th>Black</th>
          <th>Rtg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="print-signatures">
      <div class="print-signature">
        <div class="name">${esc(s.chiefArbiter||'')}</div>
        <div class="line">Chief Arbiter</div>
      </div>
      <div class="print-signature">
        <div class="name">${esc(s.tournamentDirector||'')}</div>
        <div class="line">Tournament Director (TD)</div>
      </div>
    </div>
  `;
}
function resultOptions(value){
  const opts=['','1-0','0-1','½-½','1F-0F','0F-1F'];
  return opts.map(o=>`<option ${o===value?'selected':''} value="${o}">${o||'Select result'}</option>`).join('');
}
function renderPairings(){
  const r=currentRound();roundLabel.textContent=r?.number||0;
  pairingNote.style.display=(state.settings.mode==='swiss'||state.settings.mode==='team')?'block':'none';
  if(state.settings.mode==='swiss'){
    const v=state.settings.swissVariant||'flexible';
    pairingNote.textContent=v==='dutch'
      ? 'Dutch-style Swiss pairing: score groups are split into upper/lower halves and paired across. For FIDE-rated use, verify pairings with an endorsed/approved tool.'
      : v==='accelerated'
      ? 'Accelerated Swiss: temporary virtual pairing points are used in the opening rounds; real standings points are unchanged.'
      : v==='double'
      ? 'Double Swiss: each pairing contains two games with reversed colors.'
      : 'Flexible / Practical Swiss: similar scores, repeat-opponent avoidance, and color balancing for school/local events.';
  } else if(state.settings.mode==='team'){
    pairingNote.textContent='Team Tournament: teams are formed from the current meet-level delegation and ranked by Match Points, then Board Points.';
  }
  if(!r){pairingsList.innerHTML='<div class="empty">No round generated yet.</div>';return;}

  if(state.settings.mode==='team' && r.teamMatches){
    pairingsList.innerHTML=r.teamMatches.map(m=>{
      if(m.bye)return `<div class="pair-card"><h3>Team Match ${m.number}: ${esc(m.teamA)} — <span class="badge gold">TEAM BYE</span></h3></div>`;
      const gs=r.games.filter(g=>g.matchId===m.id).sort((a,b)=>a.board-b.board);
      return `<div class="pair-card">
        <h3 style="margin-bottom:10px">Match ${m.number}: ${esc(m.teamA)} vs ${esc(m.teamB)}</h3>
        <table><thead><tr><th>Board</th><th>White</th><th>Result</th><th>Black</th></tr></thead><tbody>
        ${gs.map(g=>{
          const w=getPlayer(g.white),b=getPlayer(g.black);
          if(g.bye)return `<tr><td>${g.board}</td><td>${esc(playerDisplay(w))}</td><td>BYE</td><td>—</td></tr>`;
          return `<tr><td>${g.board}</td><td>${esc(w?.name||'')}<br><small>${esc(g.whiteTeam||'')}</small></td><td><select data-result-id="${g.id}" onchange="updateGameResult('${g.id}',this.value)">${resultOptions(g.result)}</select></td><td>${esc(b?.name||'')}<br><small>${esc(g.blackTeam||'')}</small></td></tr>`;
        }).join('')}</tbody></table>
      </div>`;
    }).join('');
    return;
  }

  pairingsList.innerHTML=r.games.sort((a,b)=>a.board-b.board).map(g=>{
    const w=getPlayer(g.white),b=getPlayer(g.black);
    if(g.bye)return `<div class="pair-card"><div class="pair-line"><div class="board-badge">B${g.board}</div><div>♙ <b>${esc(playerDisplay(w))}</b></div><div>—</div><div><span class="badge gold">PAIRING BYE</span></div><div>${g.result}</div></div></div>`;
    return `<div class="pair-card"><div class="pair-line">
      <div class="board-badge">B${g.board}</div>
      <div><span class="color-dot w">W</span> <b>${esc(playerDisplay(w))}</b> <small>(${ratingText(w)})</small></div>
      <div style="text-align:center">vs</div>
      <div><span class="color-dot b">B</span> <b>${esc(playerDisplay(b))}</b> <small>(${ratingText(b)})</small></div>
      <select data-result-id="${g.id}" onchange="updateGameResult('${g.id}',this.value)">${resultOptions(g.result)}</select>
    </div></div>`;
  }).join('');
}
