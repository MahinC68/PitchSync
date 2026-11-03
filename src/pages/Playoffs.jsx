import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPlayoffs, getSession } from '../api'
import TeamLogo from '../components/TeamLogo'
import PlayoffResultModal from '../components/PlayoffResultModal'
import styles from './Playoffs.module.css'

export default function Playoffs(){
  const session=getSession(),leagueId=session?.leagueId,isAdmin=session?.role==='admin'
  const [data,setData]=useState(null),[error,setError]=useState(''),[editor,setEditor]=useState(null)
  const load=useCallback(()=>getPlayoffs(leagueId).then(data=>{setData(data);setError('')}).catch(error=>setError(error.message)),[leagueId])
  useEffect(()=>{let live=true;getPlayoffs(leagueId).then(data=>{if(live)setData(data)}).catch(error=>{if(live)setError(error.message)});return()=>{live=false}},[leagueId])
  const bracket=data?.bracket,team=id=>bracket?.entries.find(team=>team.team_id===id),rounds=bracket?Math.log2(bracket.qualifiers):0
  function open(match,event){const trigger=event.currentTarget,rect=trigger.getBoundingClientRect();setEditor({match,trigger,origin:{x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width}})}
  function card(match){const ready=match.home_team_id&&match.away_team_id
    return <article key={match.id} className={`${styles.match} ${match.winner_id?styles.decided:''}`} aria-label={match.label}>
      <header><span>{match.label}</span><small>{match.winner_id?'Completed':ready?'Ready to play':'Awaiting teams'}</small></header>
      {[[match.home_team_id,match.home_score],[match.away_team_id,match.away_score]].map(([id,score],index)=><div key={index} className={`${styles.team} ${id&&id===match.winner_id?styles.winner:''}`}><span className={styles.seed}>{team(id)?.seed??'–'}</span><TeamLogo name={team(id)?.name||'?'} logoKey={team(id)?.logo_key} size="compact"/><span>{team(id)?.name||(match.kind==='third'?`Loser of semifinal ${index+1}`:`Winner of ${match.round===2&&rounds===3?'quarterfinal':'semifinal'} ${match.position*2-1+index}`)}</span><strong>{score??'–'}</strong>{id&&id===match.winner_id&&<span className={styles.winnerMark} aria-label="Winner">✓</span>}</div>)}
      {match.penalty_winner_id&&<p className={styles.penalties}>{team(match.penalty_winner_id)?.name} won on penalties</p>}
      {isAdmin&&ready&&<button className={styles.edit} onClick={event=>open(match,event)}>{match.winner_id?'Edit result':'Record result'}</button>}
    </article>
  }
  return <div className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Knockout competition</p><h1>Playoffs</h1></div><div className={styles.actions}><button onClick={load}>Refresh bracket</button>{isAdmin&&<Link to="/settings/playoffs" viewTransition>Playoff settings →</Link>}</div></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {!data&&!error&&<p className={styles.hint}>Loading playoffs…</p>}
    {data&&!bracket&&<section className={styles.empty}><h2>{data.settings.enabled?'The bracket is not generated yet':'Playoffs are disabled'}</h2><p className={styles.hint}>{data.settings.enabled?`The top ${data.settings.qualifiers} teams qualify from the regular league standings.`:'Regular league fixtures and standings continue as usual.'}</p>{isAdmin&&<Link to="/settings/playoffs" viewTransition>Configure and preview playoffs →</Link>}</section>}
    {bracket&&<>
      {!data.settings.enabled&&<p className={styles.notice}>Playoffs are disabled in settings. This saved bracket and its results remain available.</p>}
      <div className={styles.summary}><span>{bracket.qualifiers} qualified teams</span><span>Single elimination</span><span>{bracket.completed?'Competition completed':bracket.champion_id?'Third-place match pending':'Competition in progress'}</span></div>
      {bracket.champion_id&&<section className={styles.champion} aria-label="Playoff champion"><TeamLogo name={team(bracket.champion_id)?.name} logoKey={team(bracket.champion_id)?.logo_key} size="large"/><div><p className={styles.eyebrow}>Champion</p><h2>{team(bracket.champion_id)?.name}</h2></div><span aria-hidden="true">✧</span></section>}
      <section aria-label="Playoff bracket" className={styles.bracket} style={{'--rounds':rounds}}>{Array.from({length:rounds},(_,index)=>index+1).map(round=><section className={styles.round} key={round} aria-label={round===rounds?'Final round':`Round ${round}`}><h2>{round===rounds?'Final':round===rounds-1?'Semifinals':'Quarterfinals'}</h2><div className={styles.roundMatches}>{bracket.matches.filter(match=>match.kind==='main'&&match.round===round).map(card)}</div></section>)}</section>
      {bracket.third_place&&<section className={styles.third} aria-label="Third place">{bracket.matches.filter(match=>match.kind==='third').map(card)}</section>}
      <section className={styles.qualified} aria-label="Qualified teams"><h2>Qualified teams</h2><p className={styles.hint}>Seeds are fixed from the standings at bracket generation. Playoff matches do not affect league standings or the regular-season goal leaderboard.</p><div>{bracket.entries.map(entry=><div className={styles.qualifiedTeam} key={entry.team_id}><small>#{entry.seed}</small><TeamLogo name={entry.name} logoKey={entry.logo_key} size="compact"/><span>{entry.name}</span></div>)}</div></section>
    </>}
    {editor&&<PlayoffResultModal config={editor} bracket={bracket} onClose={()=>setEditor(null)} onSaved={bracket=>setData(current=>({...current,bracket}))}/>}
  </div>
}
