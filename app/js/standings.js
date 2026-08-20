// Chess Tournament Manager 2.0
// Standings and tie-break logic: BH, BH-C1, BH-M1, BH-M2, SB, DE, etc.

function resultScoreForPlayer(game,playerId){
  if(!game||game.bye)return 0;
  if(game.result==='½-½')return .5;
  if(game.white===playerId && (game.result==='1-0'||game.result==='1F-0F'))return 1;
  if(game.black===playerId && (game.result==='0-1'||game.result==='0F-1F'))return 1;
  return 0;
}
function tieBreakExplanationHTML(playerId){
  const p=getPlayer(playerId);
  if(!p)return '<div class="empty">Player not found.</div>';

  const h=playerHistory();
  const vals=tiebreakValues();
  const ph=h[playerId];
  const v=vals[playerId];
  const opps=(ph?.opp||[]).map(id=>({p:getPlayer(id),score:h[id]?.score||0}));
  const oppScoreList=opps.map(x=>fmt(x.score));
  const sortedScores=opps.map(x=>x.score).sort((a,b)=>a-b);
  const lowest=sortedScores.length?sortedScores[0]:0;
  const highest=sortedScores.length?sortedScores[sortedScores.length-1]:0;
  const lowestTwo=sortedScores.slice(0,2);
  const highestTwo=sortedScores.slice(-2);

  const cards=[];
  const active=state.tieBreaks.length?state.tieBreaks:['buchholzCut1','buchholz','sb'];

  for(const tb of active){
    if(tb==='buchholz'){
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">${oppScoreList.length?oppScoreList.join(' + '):'0'} = ${fmt(v.buchholz)}</div>
        <div class="tie-calc-detail">Sum of the current scores of all opponents played.</div>
      </div>`);
    }else if(tb==='buchholzCut1'){
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">(${oppScoreList.length?oppScoreList.join(' + '):'0'}) − ${fmt(lowest)} = ${fmt(v.buchholzCut1)}</div>
        <div class="tie-calc-detail">Cut-1 removes only the least significant opponent-score contribution.</div>
      </div>`);
    }else if(tb==='buchholzMedian1'){
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">(${oppScoreList.length?oppScoreList.join(' + '):'0'}) − ${fmt(lowest)} − ${fmt(highest)} = ${fmt(v.buchholzMedian1)}</div>
        <div class="tie-calc-detail">Median-1 removes the least and the most significant opponent-score contributions.</div>
      </div>`);
    }else if(tb==='buchholzMedian2'){
      const lowText=lowestTwo.length?lowestTwo.map(fmt).join(' + '):'0';
      const highText=highestTwo.length?highestTwo.map(fmt).join(' + '):'0';
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">BH − (${lowText}) − (${highText}) = ${fmt(v.buchholzMedian2)}</div>
        <div class="tie-calc-detail">Median-2 removes the two least and the two most significant opponent-score contributions.</div>
      </div>`);
    }else if(tb==='sb'){
      const terms=[];
      for(const r of state.rounds){
        for(const g of r.games){
          if(g.bye||!(g.white===playerId||g.black===playerId))continue;
          const oppId=g.white===playerId?g.black:g.white;
          const os=h[oppId]?.score||0;
          const my=resultScoreForPlayer(g,playerId);
          terms.push(`${fmt(my)}×${fmt(os)}`);
        }
      }
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">${terms.length?terms.join(' + '):'0'} = ${fmt(v.sb)}</div>
        <div class="tie-calc-detail">Your score against each opponent multiplied by that opponent's score.</div>
      </div>`);
    }else if(tb==='de'){
      const tied=state.players.filter(x=>(h[x.id]?.score||0)===(ph?.score||0)&&x.id!==playerId);
      const details=[];
      for(const r of state.rounds){
        for(const g of r.games){
          if(g.bye||!(g.white===playerId||g.black===playerId))continue;
          const oppId=g.white===playerId?g.black:g.white;
          if(!tied.some(x=>x.id===oppId))continue;
          details.push(`${getPlayer(oppId)?.name||'Opponent'}: ${fmt(resultScoreForPlayer(g,playerId))}`);
        }
      }
      cards.push(`<div class="tie-calc-card">
        <h4>${esc(TB_LABELS[tb])}</h4>
        <div class="tie-calc-formula">${fmt(v.de)}</div>
        <div class="tie-calc-detail">${details.length?details.map(x=>esc(x)).join(' • '):'No direct-encounter games among currently tied players.'}</div>
      </div>`);
    }else if(tb==='wins'){
      cards.push(`<div class="tie-calc-card"><h4>${esc(TB_LABELS[tb])}</h4><div class="tie-calc-formula">${v.wins}</div><div class="tie-calc-detail">Number of wins recorded.</div></div>`);
    }else if(tb==='blackWins'){
      cards.push(`<div class="tie-calc-card"><h4>${esc(TB_LABELS[tb])}</h4><div class="tie-calc-formula">${v.blackWins}</div><div class="tie-calc-detail">Number of wins achieved with Black.</div></div>`);
    }else if(tb==='cumulative'){
      const scores=ph?.roundScores||[];
      cards.push(`<div class="tie-calc-card"><h4>${esc(TB_LABELS[tb])}</h4><div class="tie-calc-formula">${scores.length?scores.map(fmt).join(' + '):'0'} = ${fmt(v.cumulative)}</div><div class="tie-calc-detail">Running score after each round, summed.</div></div>`);
    }else if(tb==='rating'){
      cards.push(`<div class="tie-calc-card"><h4>${esc(TB_LABELS[tb])}</h4><div class="tie-calc-formula">${p.unrated?'NR':p.rating}</div><div class="tie-calc-detail">Starting rating used only when this tie-break is enabled.</div></div>`);
    }
  }

  return `<div class="note" style="margin-bottom:10px"><b>Score:</b> ${fmt(v.score)} • <b>Opponents:</b> ${opps.length}</div>
          <div class="tie-explain-grid">${cards.join('')}</div>`;
}
function openTieBreakExplanation(playerId){
  const p=getPlayer(playerId);if(!p)return;
  const modal=document.getElementById('tieBreakExplainModal');if(!modal)return;
  document.getElementById('tieExplainPlayer').textContent=p.name;
  document.getElementById('tieExplainBody').innerHTML=tieBreakExplanationHTML(playerId);
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
function closeTieBreakExplanation(){
  const modal=document.getElementById('tieBreakExplainModal');if(!modal)return;
  modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
}

function tiebreakValues(){
  const h=playerHistory(); const vals={};
  for(const p of state.players){
    const ph=h[p.id], oppScores=ph.opp.map(id=>h[id]?.score||0);
    const buchholz=oppScores.reduce((a,b)=>a+b,0);

    // Buchholz modifiers:
    // BH-C1  = remove the least significant contribution.
    // BH-M1  = remove the least and the most significant contributions.
    // BH-M2  = remove the two least and the two most significant contributions.
    const sortedOppScores=[...oppScores].sort((a,b)=>a-b);
    const cut1=sortedOppScores.length
      ? sortedOppScores.slice(1).reduce((a,b)=>a+b,0)
      : 0;
    const median1=sortedOppScores.length>2
      ? sortedOppScores.slice(1,-1).reduce((a,b)=>a+b,0)
      : 0;
    const median2=sortedOppScores.length>4
      ? sortedOppScores.slice(2,-2).reduce((a,b)=>a+b,0)
      : 0;

    let sb=0,de=0;
    for(const r of state.rounds){
      for(const g of r.games){
        if(g.bye)continue;
        if(g.white===p.id||g.black===p.id){
          const opp=g.white===p.id?g.black:g.white, os=h[opp]?.score||0;
          let my=0;if(g.result==='½-½')my=.5;else if((g.white===p.id&&(g.result==='1-0'||g.result==='1F-0F'))||(g.black===p.id&&(g.result==='0-1'||g.result==='0F-1F')))my=1;
          sb+=my*os;
        }
      }
    }
    const tiedIds=state.players.filter(x=>(h[x.id]?.score||0)===ph.score).map(x=>x.id);
    for(const r of state.rounds){
      for(const g of r.games){
        if(g.bye)continue;
        const isMine=g.white===p.id||g.black===p.id; if(!isMine)continue;
        const opp=g.white===p.id?g.black:g.white;if(!tiedIds.includes(opp))continue;
        if(g.result==='½-½')de+=.5;
        else if((g.white===p.id&&(g.result==='1-0'||g.result==='1F-0F'))||(g.black===p.id&&(g.result==='0-1'||g.result==='0F-1F')))de+=1;
      }
    }
    vals[p.id]={
      score:ph.score,
      de,
      buchholzCut1:cut1,
      buchholzMedian1:median1,
      buchholzMedian2:median2,
      buchholz,
      sb,
      wins:ph.wins,
      blackWins:ph.blackWins,
      cumulative:ph.roundScores.reduce((a,b)=>a+b,0),
      rating:p.unrated?-1:p.rating
    };
  } return vals;
}
function standings(){
  const v=tiebreakValues();
  const arr=state.players.map(p=>({...p,...v[p.id]}));
  arr.sort((a,b)=>{
    if(b.score!==a.score)return b.score-a.score;
    for(const tb of state.tieBreaks){if((b[tb]??0)!==(a[tb]??0))return (b[tb]??0)-(a[tb]??0);}
    return a.name.localeCompare(b.name);
  });
  return arr;
}
function fmt(v){return Number.isInteger(v)?String(v):Number(v).toFixed(1);}

function renderPairingsRanking(){
  const box=document.getElementById('pairingsRankingTable');
  const subtitle=document.getElementById('pairingsRankingSubtitle');
  if(!box)return;

  const completedGames=state.rounds.reduce((n,r)=>n+r.games.filter(g=>g.bye||g.result).length,0);
  const totalGames=state.rounds.reduce((n,r)=>n+r.games.length,0);
  if(subtitle){
    subtitle.textContent=`Live standings after Round ${state.rounds.length || 0} • ${completedGames}/${totalGames} game result(s) encoded`;
  }

  if(state.settings.mode==='team'){
    const arr=teamStandings();
    if(!arr.length){
      box.innerHTML='<div class="empty">No team ranking yet.</div>';
      return;
    }
    box.innerHTML=`<table>
      <thead><tr><th>Rank</th><th>Team / Delegation</th><th>MP</th><th>Board Pts</th><th>Match Wins</th></tr></thead>
      <tbody>${arr.map((t,i)=>`<tr class="${i===0?'rank1':''}">
        <td><b>${i+1}</b></td>
        <td><b>${esc(t.name)}</b></td>
        <td><b>${fmt(t.matchPoints||0)}</b></td>
        <td>${fmt(t.boardPoints||0)}</td>
        <td>${t.wins||0}</td>
      </tr>`).join('')}</tbody>
    </table>`;
    return;
  }

  const arr=standings();
  if(!arr.length){
    box.innerHTML='<div class="empty">No ranking yet.</div>';
    return;
  }

  const visibleTB=state.tieBreaks.slice(0,8);
  const headers=['Rank','Player','Rtg','Pts',...visibleTB.map(tb=>TB_LABELS[tb].split(' – ')[0])];

  box.innerHTML=`<table>
    <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${arr.map((p,i)=>`<tr class="${i===0?'rank1':''}">
      <td><b>${i+1}</b></td>
      <td class="standings-player"><b>${esc(p.name)}</b><br><small class="school-short" title="${esc(p.school||delegationLabel(p)||'')}">${esc(compactDelegationLabel(p)||p.category||'')}</small></td>
      <td>${ratingText(p)}</td>
      <td><b>${fmt(p.score)}</b></td>
      ${visibleTB.map(tb=>`<td>${fmt(p[tb]||0)}</td>`).join('')}
    </tr>`).join('')}</tbody>
  </table>`;
}



function standingsTieShort(tb){
  const map={
    de:'DE',
    buchholz:'BH',
    buchholzCut1:'BH-C1',
    buchholzMedian1:'BH-M1',
    buchholzMedian2:'BH-M2',
    wins:'W',
    blackWins:'BWG',
    sb:'SB',
    sonneborn:'SB',
    cumulative:'CUM',
    rating:'RTG'
  };
  return map[tb]||String(tb||'').toUpperCase();
}
function standingsTieLegend(tb){
  const map={
    de:'DE = Direct Encounter',
    buchholz:'BH = Buchholz',
    buchholzCut1:'BH-C1 = Buchholz Cut 1 — exclude the lowest contribution',
    buchholzMedian1:'BH-M1 = Buchholz Median-1 — exclude the lowest and highest contributions',
    buchholzMedian2:'BH-M2 = Buchholz Median-2 — exclude the two lowest and two highest contributions',
    wins:'W = Number of Wins',
    blackWins:'BWG = Wins with Black',
    sb:'SB = Sonneborn-Berger',
    sonneborn:'SB = Sonneborn-Berger',
    cumulative:'CUM = Cumulative Score',
    rating:'RTG = Starting Rating'
  };
  return map[tb]||standingsTieShort(tb);
}
function standingsDelegationHeader(){
  const lvl=state.settings.meetLevel||'municipal';
  if(lvl==='municipal')return 'SCHOOL';
  if(lvl==='division')return 'MUNICIPALITY / CITY';
  if(lvl==='regional')return 'DIVISION / PROVINCE';
  if(lvl==='national')return 'REGION';
  return 'DELEGATION';
}
function standingsDelegationValue(p){
  const lvl=state.settings.meetLevel||'municipal';
  if(lvl==='municipal')return compactDelegationLabel(p)||p.school||'';
  if(lvl==='division')return p.town||compactDelegationLabel(p)||p.school||'';
  if(lvl==='regional')return p.division||p.town||compactDelegationLabel(p)||p.school||'';
  if(lvl==='national')return p.region||p.division||p.town||compactDelegationLabel(p)||p.school||'';
  return compactDelegationLabel(p)||p.school||'';
}
function isTournamentFinalResult(){
  const total=+state.settings.rounds||0;
  if(total<=0 || state.rounds.length<total)return false;
  return state.rounds.length>0 &&
    state.rounds.every(r=>r.games.every(g=>g.bye||g.result));
}
function standingsReportTitle(){
  return isTournamentFinalResult()
    ? 'Final Ranking'
    : `Provisional Standing — Round ${state.rounds.length||0}`;
}
function standingsReportStatus(){
  return isTournamentFinalResult()
    ? 'OFFICIAL FINAL RESULT'
    : 'CURRENT / UNOFFICIAL';
}
function printStandingsReport(){
  goTab('standings');
  buildStandingsPrintSheet();

  // More than 5 tie-break columns or many players benefits from landscape.
  const useLandscape=(state.tieBreaks?.length||0)>5 || (state.players?.length||0)>32;
  const compactLargeRoster=(state.players?.length||0)>=30;
  document.body.classList.toggle('landscape-print',useLandscape);
  document.body.classList.toggle('large-standings-print',compactLargeRoster);

  const cleanup=()=>{
    document.body.classList.remove('printing-standings','landscape-print','large-standings-print');
    window.removeEventListener('afterprint',cleanup);
  };
  document.body.classList.add('printing-standings');
  window.addEventListener('afterprint',cleanup);
  setTimeout(()=>window.print(),60);
}
function buildStandingsPrintSheet(){
  const box=document.getElementById('printStandingsSheet');
  if(!box)return;

  const title=(state.settings.name||'Chess Tournament').toUpperCase();
  const category=state.settings.tournamentCategory||'Open';
  const rankingTitle=standingsReportTitle();
  const reportStatus=standingsReportStatus();
  const delegationHeader=standingsDelegationHeader();
  const date=state.settings.date||'—';
  const venue=state.settings.venue||'—';
  const timeControl=state.settings.timeControl||'—';
  const chief=state.settings.chiefArbiter||'';
  const td=state.settings.tournamentDirector||'';
  const totalRounds=state.settings.rounds||0;
  const roundsText=`${state.rounds.length}/${totalRounds}`;
  const tieCols=state.tieBreaks.slice(0,8);
  const generatedAt=new Date().toLocaleString();
  const isFinal=isTournamentFinalResult();

  if(state.settings.mode==='team'){
    const arr=teamStandings();
    if(!arr.length){
      box.innerHTML='<div style="font-family:Arial;color:#000">No team standings yet.</div>';
      return;
    }

    const rows=arr.map((t,i)=>`<tr class="${isFinal?(i===0?'top1':i===1?'top2':i===2?'top3':''):''}">
      <td class="c-rank">${i+1}${isFinal&&i<3?`<span class="rank-medal">${i===0?'CHAMPION':i===1?'2ND':'3RD'}</span>`:''}</td>
      <td class="player-cell"><span class="player-name">${esc(t.name)}</span></td>
      <td>${esc(t.name)}</td>
      <td class="c-pts">${fmt(t.matchPoints||0)}</td>
      <td class="c-small">${fmt(t.boardPoints||0)}</td>
      <td class="c-small">${t.wins||0}</td>
    </tr>`).join('');

    box.innerHTML=`
      <div class="fs-document">
        <div class="fs-header">
          <div class="fs-header-left">
            <div class="fs-kicker">Chess Tournament Official Result</div>
            <div class="fs-event">${esc(title)}</div>
            <div class="fs-category">${esc(category)}</div>
          </div>
          <div class="fs-status">
            <div class="fs-status-title">${esc(rankingTitle)}</div>
            <div class="fs-status-round">${esc(reportStatus)}</div>
          </div>
        </div>

        <div class="fs-meta">
          <div class="fs-meta-item"><span class="fs-meta-label">Format</span><span class="fs-meta-value">${esc(modeName(state.settings.mode))}</span></div>
          <div class="fs-meta-item"><span class="fs-meta-label">Rounds</span><span class="fs-meta-value">${esc(roundsText)}</span></div>
          <div class="fs-meta-item"><span class="fs-meta-label">Time Control</span><span class="fs-meta-value">${esc(timeControl)}</span></div>
          <div class="fs-meta-item"><span class="fs-meta-label">Date</span><span class="fs-meta-value">${esc(date)}</span></div>
        </div>

        <div class="fs-table-title"><h2>Team Ranking</h2><div class="count">${arr.length} team(s) • ${esc(venue)}</div></div>

        <table class="print-standings-table">
          <colgroup>
            <col style="width:8%"><col style="width:42%"><col style="width:26%"><col style="width:8%"><col style="width:8%"><col style="width:8%">
          </colgroup>
          <thead><tr><th>Rank</th><th>Team</th><th>${esc(delegationHeader)}</th><th>MP</th><th>BP</th><th>W</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="fs-legend"><b>Ranking:</b> Match Points → Board Points → Match Wins.</div>

        <div class="fs-cert">
          <div class="fs-cert-box"><div class="fs-cert-caption">Officiated by:</div><div class="fs-cert-name">${esc(chief).toUpperCase()}</div><div class="fs-cert-role">Chief Arbiter</div></div>
          <div class="fs-cert-box"><div class="fs-cert-caption">Prepared by:</div><div class="fs-cert-name">${esc(td).toUpperCase()}</div><div class="fs-cert-role">Tournament Director (TD)</div></div>
          <div class="fs-cert-box"><div class="fs-cert-caption">Verified / Checked by:</div><div class="fs-cert-name">&nbsp;</div><div class="fs-cert-role">Tournament Committee</div></div>
        </div>

        <div class="fs-footer"><div>Generated by Chess Tournament Manager</div><div class="right">${esc(generatedAt)}</div></div>
      </div>`;
    return;
  }

  const arr=standings();
  if(!arr.length){
    box.innerHTML='<div style="font-family:Arial;color:#000">No standings yet.</div>';
    return;
  }

  const rows=arr.map((p,i)=>{
    const printableName = ((p.lastName||'')+' '+(p.firstName||'')+(p.middleInitial?(' '+p.middleInitial):'')).trim() || p.name;
    return `<tr class="${isFinal?(i===0?'top1':i===1?'top2':i===2?'top3':''):''}">
      <td class="c-rank">${i+1}${isFinal&&i<3?`<span class="rank-medal">${i===0?'CHAMPION':i===1?'2ND':'3RD'}</span>`:''}</td>
      <td class="player-cell">
        <span class="player-name">${esc(printableName).toUpperCase()}</span>
      </td>
      <td>${esc(standingsDelegationValue(p)).toUpperCase()}</td>
      <td class="c-pts"><b>${fmt(p.score)}</b></td>
      ${tieCols.map(tb=>`<td class="c-small">${fmt(p[tb]||0)}</td>`).join('')}
    </tr>`;
  }).join('');

  // Dynamic widths: retain a strong Name/Delegation area, then share remainder among TBs.
  const tbCount=Math.max(1,tieCols.length);
  const tbWidth=Math.max(5,Math.floor(31/tbCount));
  const colWidths=['7%','36%','22%','7%',...tieCols.map(()=>`${tbWidth}%`)];
  const headers=['Rank','Name',delegationHeader,'Pts',...tieCols.map(standingsTieShort)];

  const legend=tieCols.map((tb,i)=>`${i+1}. ${standingsTieLegend(tb)}`).join(' &nbsp; • &nbsp; ');

  box.innerHTML=`
    <div class="fs-document">
      <div class="fs-header">
        <div class="fs-header-left">
          <div class="fs-kicker">Chess Tournament Official Result</div>
          <div class="fs-event">${esc(title)}</div>
          <div class="fs-category">${esc(category)}</div>
        </div>
        <div class="fs-status">
          <div class="fs-status-title">${esc(rankingTitle)}</div>
          <div class="fs-status-round">${esc(reportStatus)}</div>
        </div>
      </div>

      <div class="fs-meta">
        <div class="fs-meta-item"><span class="fs-meta-label">Format</span><span class="fs-meta-value">${esc(cleanFormatName())}</span></div>
        <div class="fs-meta-item"><span class="fs-meta-label">Rounds</span><span class="fs-meta-value">${esc(roundsText)}</span></div>
        <div class="fs-meta-item"><span class="fs-meta-label">Time Control</span><span class="fs-meta-value">${esc(timeControl)}</span></div>
        <div class="fs-meta-item"><span class="fs-meta-label">Date</span><span class="fs-meta-value">${esc(date)}</span></div>
      </div>

      <div class="fs-table-title">
        <h2>${esc(rankingTitle)}</h2>
        <div class="count">${arr.length} participant(s) • ${esc(venue)}</div>
      </div>

      <table class="print-standings-table">
        <colgroup>${colWidths.map(w=>`<col style="width:${w}">`).join('')}</colgroup>
        <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="fs-legend">
        <b>Tie-break order:</b> ${legend || 'None'}
      </div>

      <div class="fs-cert">
        <div class="fs-cert-box">
          <div class="fs-cert-caption">Officiated by:</div>
          <div class="fs-cert-name">${esc(chief).toUpperCase()}</div>
          <div class="fs-cert-role">Chief Arbiter</div>
        </div>
        <div class="fs-cert-box">
          <div class="fs-cert-caption">Prepared by:</div>
          <div class="fs-cert-name">${esc(td).toUpperCase()}</div>
          <div class="fs-cert-role">Tournament Director (TD)</div>
        </div>
        <div class="fs-cert-box">
          <div class="fs-cert-caption">Verified / Checked by:</div>
          <div class="fs-cert-name">&nbsp;</div>
          <div class="fs-cert-role">Tournament Committee</div>
        </div>
      </div>

      <div class="fs-footer">
        <div>Generated by Chess Tournament Manager</div>
        <div class="right">${esc(generatedAt)}</div>
      </div>
    </div>`;
}

function renderStandings(){
  if(state.settings.mode==='team'){
    const arr=teamStandings();
    if(!arr.length){standingsTable.innerHTML='<div class="empty">No teams yet.</div>';return;}
    standingsTable.innerHTML=`<table><thead><tr><th>Rank</th><th>Team / Delegation</th><th>MP</th><th>Board Pts</th><th>Match Wins</th><th>Players</th></tr></thead><tbody>`+
      arr.map((t,i)=>`<tr class="${i===0?'rank1':''}"><td><b>${i+1}</b></td><td><b>${esc(t.name)}</b></td><td><b>${fmt(t.matchPoints||0)}</b></td><td>${fmt(t.boardPoints||0)}</td><td>${t.wins||0}</td><td>${t.players.length}</td></tr>`).join('')+
      `</tbody></table>`;
    return;
  }
  const arr=standings(); if(!arr.length){standingsTable.innerHTML='<div class="empty">No players yet.</div>';return;}
  const cols=['Rank','Player','Rtng','Pts',...state.tieBreaks.slice(0,5).map(x=>TB_LABELS[x].split(' – ')[0]),'Math'];
  standingsTable.innerHTML=`<table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`+
  arr.map((p,i)=>`<tr class="${i===0?'rank1':''}"><td><b>${i+1}</b></td><td class="standings-player"><b>${esc(p.name)}</b><br><small class="school-short" title="${esc(p.school||delegationLabel(p)||'')}">${esc(compactDelegationLabel(p)||p.category||'')}</small></td><td>${ratingText(p)}</td><td><b>${fmt(p.score)}</b></td>${state.tieBreaks.slice(0,5).map(tb=>`<td>${fmt(p[tb]||0)}</td>`).join('')}<td><button class="btn small tie-explain-btn" onclick="openTieBreakExplanation('${p.id}')" title="Show tie-break calculation">ⓘ</button></td></tr>`).join('')+
  `</tbody></table>`;
}
function renderPlayers(){
  state.players.forEach(ensurePlayerStructuredName);
  if(!state.players.length){
    playersTable.innerHTML='<div class="empty">No players registered.</div>';
    return;
  }
  playersTable.innerHTML=`<table><thead><tr>
    <th>#</th><th>Last Name</th><th>First Name</th><th>M.I.</th>
    <th>School ID</th><th>School</th><th>Town/City</th><th>Rating</th><th>Category</th><th></th>
  </tr></thead><tbody>`+
  state.players.map((p,i)=>`<tr>
    <td>${i+1}</td>
    <td><b>${esc(p.lastName||p.name||'')}</b></td>
    <td>${esc(p.firstName||'')}</td>
    <td>${esc(p.middleInitial||'')}</td>
    <td>${esc(p.schoolId||'—')}</td>
    <td>${esc(p.school||'—')}</td>
    <td>${esc(p.town||'—')}</td>
    <td>${ratingText(p)}</td>
    <td>${esc(p.category)}</td>
    <td><button class="btn small" onclick="editPlayer('${p.id}')">Edit</button>
        <button class="btn small danger" onclick="deletePlayer('${p.id}')">Delete</button></td>
  </tr>`).join('')+`</tbody></table>`;
}
function moveTie(i,dir){
  const m=state.settings.mode||'';
  if(!m || m==='knockout'||m==='team')return;
  const j=i+dir;if(j<0||j>=state.tieBreaks.length)return;
  [state.tieBreaks[i],state.tieBreaks[j]]=[state.tieBreaks[j],state.tieBreaks[i]];
  state.tieBreaksByMode[m]=[...state.tieBreaks];
  persist();renderTieList();renderAll();renderModeTieBreakSelectors();
}
function renderTieList(){
  const m=state.settings.mode||'';
  if(!m){
    tieList.innerHTML='<div class="empty">Select a tournament format first.</div>';
    return;
  }
  const advTitle=document.getElementById('advancedTieTitle');
  if(advTitle)advTitle.textContent=`Tie-break Priority — ${modeName(m)}`;
  if(m==='knockout'||m==='team'){
    tieList.innerHTML=`<div class="empty">${m==='team'?'Team standings use Match Points → Board Points → Match Wins.':'Knockout does not use a standings tie-break order for advancement.'}</div>`;
    return;
  }
  tieList.innerHTML=state.tieBreaks.length
    ? state.tieBreaks.map((tb,i)=>`<div class="tie-item"><div><span class="badge gold">${i+1}</span> <b>${esc(TB_LABELS[tb])}</b></div><div><button class="btn small" onclick="moveTie(${i},-1)">↑</button> <button class="btn small" onclick="moveTie(${i},1)">↓</button></div></div>`).join('')
    : '<div class="empty">No ranking tie-break is enabled. Players are ranked by points, then name as a local display fallback.</div>';
}
function resetTieBreaks(){
  const m=state.settings.mode||'';
  if(!m)return;
  state.tieBreaksByMode[m]=cloneDefaultTB(m);
  state.tieBreaks=[...state.tieBreaksByMode[m]];
  persist();renderAll();renderModeTieBreakSelectors();
}
function renderDashboard(){
  const st=state.settings.mode==='team'?teamStandings():standings();
  kpiPlayers.textContent=state.players.length;kpiRound.textContent=state.rounds.length;
  kpiGames.textContent=state.rounds.reduce((n,r)=>n+r.games.filter(g=>g.result||g.bye).length,0);
  kpiLeader.textContent=st[0]?(state.settings.mode==='team'?st[0].name:st[0].name.split(' ')[0]):'—';
  if(!document.querySelector('.section.active')?.id || document.querySelector('.section.active')?.id==='dashboard'){
    eventSubtitle.textContent=`${state.settings.tournamentCategory||'Open'} • ${state.settings.name} • ${modeName(state.settings.mode)} • ${state.settings.rounds} round(s)`;
  }
  configSummary.innerHTML=`<b>${esc(state.settings.name)}</b><br>Category: ${esc(state.settings.tournamentCategory||'Open')}<br>Mode: ${esc(modeName(state.settings.mode))}${state.settings.mode==='swiss'?` (${esc(({flexible:'Flexible',dutch:'Dutch-style',accelerated:'Accelerated',double:'Double Swiss'}[state.settings.swissVariant||'flexible']))})`:''}<br>Entry: ${esc(({open:'Open',invitational:'Invitational',rating:'Rating-Restricted'}[state.settings.entryType||'open']))}<br>Meet Level: ${esc((state.settings.meetLevel||'municipal').toUpperCase())}<br>Rounds: ${state.settings.rounds}<br>School: ${esc(state.settings.school||'')}${state.settings.schoolId?' ('+esc(state.settings.schoolId)+')':''}<br>Time Control: ${esc(state.settings.timeControl)}<br>Venue: ${esc(state.settings.venue)}<br>Chief Arbiter: ${esc(state.settings.chiefArbiter||'—')}<br>Tournament Director: ${esc(state.settings.tournamentDirector||'—')}<br><br><b>${esc(modeName(state.settings.mode))} Tie-breaks:</b><br>${state.tieBreaks.length?state.tieBreaks.slice(0,5).map((x,i)=>`${i+1}. ${esc(TB_LABELS[x])}`).join('<br>'):'Not used in Knockout'}`;
  if(!st.length)dashboardStandings.innerHTML='<div class="empty">Add players to begin.</div>';
  else if(state.settings.mode==='team'){
    dashboardStandings.innerHTML=`<table><thead><tr><th>Rank</th><th>Team</th><th>MP</th><th>Board Pts</th></tr></thead><tbody>${st.slice(0,8).map((t,i)=>`<tr><td>${i+1}</td><td><b>${esc(t.name)}</b></td><td>${fmt(t.matchPoints||0)}</td><td>${fmt(t.boardPoints||0)}</td></tr>`).join('')}</tbody></table>`;
  } else dashboardStandings.innerHTML=`<table><thead><tr><th>Rank</th><th>Player</th><th>Pts</th><th>Primary TB</th></tr></thead><tbody>${st.slice(0,8).map((p,i)=>`<tr><td>${i+1}</td><td><b>${esc(playerDisplay(p))}</b></td><td>${fmt(p.score)}</td><td>${state.tieBreaks.length?`${fmt(p[state.tieBreaks[0]]||0)} ${esc(TB_LABELS[state.tieBreaks[0]].split(' – ')[0])}`:'—'}</td></tr>`).join('')}</tbody></table>`;
  notationEvent.textContent=state.settings.name;
  notationArbiter.textContent=state.settings.chiefArbiter||'';

  const cleanTitle=document.getElementById('cleanRoundStatusTitle');
  const cleanHelp=document.getElementById('cleanRoundStatusHelp');
  const cleanBtn=document.getElementById('dashboardGenerateRoundBtn');
  if(cleanTitle&&cleanHelp&&cleanBtn){
    if(!state.settings?.tournamentStarted){
      cleanTitle.textContent='No Tournament Open';
      cleanHelp.textContent='Open a saved tournament or create a new one first.';
      cleanBtn.textContent='Tournaments';
      cleanBtn.onclick=()=>showHomeScreen();
    }else if(!state.rounds.length){
      cleanTitle.textContent='No Round Generated';
      cleanHelp.textContent='Tournament is ready. Round 1 has not been paired yet.';
      cleanBtn.textContent='Open Pairings →';
      cleanBtn.onclick=()=>goTab('pairings');
    }else{
      cleanTitle.textContent=`${state.rounds.length} Round${state.rounds.length===1?'':'s'} Generated`;
      cleanHelp.textContent='These rounds exist because they were generated earlier and saved with this tournament.';
      cleanBtn.textContent='Open Pairings & Results →';
      cleanBtn.onclick=()=>goTab('pairings');
    }
  }

}
