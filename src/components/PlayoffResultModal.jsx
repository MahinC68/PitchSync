import { useEffect, useRef, useState } from 'react'
import { SelectPicker } from './FilterPicker'
import useModalMotion from './useModalMotion'
import { savePlayoffResult } from '../api'
import styles from './Modal.module.css'
import rules from '../pages/LeagueRules.module.css'

export default function PlayoffResultModal({config,bracket,onClose,onSaved}) {
  const {match}=config, team=id=>bracket.entries.find(team=>team.team_id===id)?.name||'Team'
  const [home,setHome]=useState(match.home_score??0),[away,setAway]=useState(match.away_score??0),[penalty,setPenalty]=useState(match.penalty_winner_id??'')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[resolution,setResolution]=useState(null)
  const input=useRef(null),{closing,close,modalRef}=useModalMotion(onClose,config.origin)
  useEffect(()=>{input.current?.focus({preventScroll:true});return()=>config.trigger?.isConnected&&config.trigger.focus({preventScroll:true})},[config])
  function change(setter,value){setter(value);setResolution(null);setError('')}
  async function save(event,clear=false,confirmed=null){event?.preventDefault();setBusy(true);setError('');try{
    const body=confirmed?.body||{home_score:Number(home),away_score:Number(away),penalty_winner_id:Number(home)===Number(away)&&penalty!==''?Number(penalty):null,expected_revision:bracket.revision}
    const data=await savePlayoffResult(match.id,{...body,...(confirmed?{reset_match_ids:confirmed.affected.map(match=>match.id)}:{})},confirmed?confirmed.clear:clear)
    onSaved(data);onClose()
  }catch(error){setError(error.message);if(error.code==='DOWNSTREAM_RESULTS'&&error.details?.affected?.length)setResolution({affected:error.details.affected,clear,body:{home_score:Number(home),away_score:Number(away),penalty_winner_id:Number(home)===Number(away)&&penalty!==''?Number(penalty):null,expected_revision:bracket.revision}});else setResolution(null)}finally{setBusy(false)}}
  function keys(event){if(event.key==='Escape'&&!busy&&!event.defaultPrevented){event.preventDefault();close()}if(event.key==='Tab'){const controls=[...modalRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(node=>node.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}
  return <div className={styles.overlay} data-closing={closing||undefined} onKeyDown={keys} onClick={()=>!busy&&close()}><div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="playoff-result-title" onClick={event=>event.stopPropagation()}>
    <div className={styles.modalHead}><h2 id="playoff-result-title" className={styles.modalTitle}>{match.winner_id?'Edit':'Record'} {match.label.toLowerCase()} result</h2><button className={styles.closeBtn} aria-label="Close playoff result" disabled={busy} onClick={close}>×</button></div>
    <form className={styles.modalBody} onSubmit={save}>
      <div className={styles.fieldRow}>{[[team(match.home_team_id),home,setHome],[team(match.away_team_id),away,setAway]].map(([name,value,setter],index)=><label className={styles.field} key={index}><span className={styles.fieldLabel}>{name} score</span><input ref={index===0?input:undefined} className={styles.input} aria-label={`${name} score`} type="number" min="0" max="99" step="1" required disabled={busy} value={value} onChange={event=>change(setter,event.target.value)}/></label>)}</div>
      {Number(home)===Number(away)&&<div className={styles.field}><span className={styles.fieldLabel}>Penalty-shootout winner</span><SelectPicker label="Penalty-shootout winner" disabled={busy} value={penalty} onChange={value=>change(setPenalty,value)} options={[{value:'',label:'Choose winner…'},...[match.home_team_id,match.away_team_id].map(id=>({value:id,label:team(id)}))]}/></div>}
      <p className={rules.hint}>The score is saved separately from the penalty winner. Playoff goals do not enter the regular-season player leaderboard.</p>
      {error&&<p role="alert" className={styles.modalError}>{error}</p>}
      {resolution&&<section className={rules.editor} aria-label="Resolve dependent results"><h3>Clear affected results?</h3><p className={rules.hint}>Changing this result changes the participants in these completed matches. Their scores and penalty winners must be cleared:</p><ul>{resolution.affected.map(match=><li key={match.id}>{match.label}</li>)}</ul><div className={rules.actions}><button type="button" className={rules.danger} disabled={busy} onClick={()=>save(null,false,resolution)}>Clear {resolution.affected.length} dependent {resolution.affected.length===1?'result':'results'} and {resolution.clear?'clear':'save'}</button><button type="button" className={rules.secondary} disabled={busy} onClick={()=>setResolution(null)}>Keep existing results</button></div></section>}
      <div className={styles.modalActions}>{match.winner_id&&<button type="button" className={rules.danger} disabled={busy} onClick={()=>save(null,true)}>Clear result</button>}<button type="button" className={styles.btnGhost} disabled={busy} onClick={close}>Cancel</button><button className={styles.btnPrimary} disabled={busy||!!resolution}>{busy?'Saving…':'Save playoff result'}</button></div>
    </form>
  </div></div>
}
