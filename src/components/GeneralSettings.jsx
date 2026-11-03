import { useEffect, useRef, useState } from 'react'
import { useLeagues } from './LeagueContext'
import LeagueSwitcher from './LeagueSwitcher'
import LeagueLogo from './LeagueLogo'
import { uploadLeagueLogo, removeLeagueLogo } from '../api'
import styles from '../pages/Settings.module.css'

export default function GeneralSettings(){
  const {leagues,activeId,openRename,updateLeague}=useLeagues()
  const league=leagues.find(league=>league.id===activeId)
  const [copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const file=useRef(null)
  const copiedTimer=useRef(null)
  useEffect(()=>()=>clearTimeout(copiedTimer.current),[])
  if(!league)return null
  async function copy(){try{await navigator.clipboard.writeText(league.access_code);setCopied(true);clearTimeout(copiedTimer.current);copiedTimer.current=setTimeout(()=>setCopied(false),2000)}catch{setError('Could not copy the access code. You can select and copy it directly.')}}
  async function logoAction(work){setBusy(true);setError('');setNotice('');try{updateLeague(await work());setNotice('League logo updated.')}catch(error){setError(error.message)}finally{setBusy(false);if(file.current)file.current.value=''}}
  async function upload(event){const chosen=event.target.files?.[0];if(!chosen)return;await logoAction(async()=>{if(chosen.size>2*1024*1024)throw Error('League logos must be 2 MB or smaller');return uploadLeagueLogo(chosen)})}
  return <section className={styles.accessCodeSection} aria-label="General settings">
    <h2 className={styles.generalTitle}>General</h2>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.nameRow}><div className={styles.brandIdentity}><LeagueLogo league={league} size="large"/><div><div className={styles.accessCodeLabel}>League name</div><strong>{league.name}</strong></div></div><button className={styles.btnCopy} disabled={busy} onClick={event=>openRename(league,event)}>Rename league</button></div>
    <div className={styles.brandControls}><label className={styles.uploadLabel}>{league.logo_key?'Replace league logo':'Upload league logo'}<input ref={file} aria-label="League logo file" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload}/></label>{league.logo_key&&<button className={styles.btnCopy} disabled={busy} onClick={()=>logoAction(removeLeagueLogo)}>Remove league logo</button>}</div>
    <p className={styles.accessCodeHint}>PNG, JPEG or WebP · 2 MB max · up to 4096 × 4096 pixels</p>
    <div className={styles.accessCodeLabel}>Player Access Code</div><p className={styles.accessCodeHint}>Share this code with players so they can join and view {league.name}.</p>
    <div className={styles.accessCodeRow}><span className={styles.accessCode}>{league.access_code}</span><button className={styles.btnCopy} onClick={copy}>{copied?'Copied!':'Copy'}</button></div>
    <div className={styles.leagueManagement}><div className={styles.accessCodeLabel}>Switch or manage leagues</div><LeagueSwitcher label="Manage leagues"/></div>
  </section>
}
