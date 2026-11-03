import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSession, getPlayoffs, savePlayoffSettings, previewPlayoffs, generatePlayoffs } from '../api'
import { SelectPicker } from '../components/FilterPicker'
import TeamLogo from '../components/TeamLogo'
import styles from './LeagueRules.module.css'
import bracketStyles from './Playoffs.module.css'

export default function PlayoffSettings() {
  const navigate=useNavigate(), leagueId=getSession()?.leagueId
  const [saved,setSaved]=useState(null),[settings,setSettings]=useState(null),[bracket,setBracket]=useState(null)
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{let live=true;getPlayoffs(leagueId).then(data=>{if(live){setSettings(data.settings);setSaved(data.settings);setBracket(data.bracket)}}).catch(error=>{if(live)setError(error.message)});return()=>{live=false}},[leagueId])
  const dirty=JSON.stringify(settings)!==JSON.stringify(saved)
  function field(key,value){setSettings(current=>({...current,[key]:value,...(key==='qualifiers'&&value===2?{third_place:false}:{})}));setPreview(null);setNotice('')}
  async function save(event){event.preventDefault();setBusy(true);setError('');setNotice('');setPreview(null);try{const data=await savePlayoffSettings(settings);setSettings(data);setSaved(data);setNotice('Playoff settings saved. Existing brackets are preserved.')}catch(error){setError(error.message)}finally{setBusy(false)}}
  async function showPreview(){setBusy(true);setError('');setNotice('');try{setPreview(await previewPlayoffs())}catch(error){setError(error.message)}finally{setBusy(false)}}
  async function generate(){setBusy(true);setError('');try{await generatePlayoffs(preview.token);navigate('/playoffs')}catch(error){setPreview(null);setError(error.message)}finally{setBusy(false)}}
  return <div className={styles.page}>
    <Link to="/settings" className={styles.back}>← Back to Settings</Link>
    <div className={styles.pageHead}><p className={styles.eyebrow}>League settings</p><h1>Playoffs</h1></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {!settings&&!error&&<p className={styles.hint}>Loading playoff settings…</p>}
    {settings&&<>
      <form onSubmit={save}><fieldset className={styles.ruleFields} disabled={busy}><section className={styles.section} aria-label="Playoff configuration">
        <h2>Playoff configuration</h2><p className={styles.hint}>Optional single-elimination playoffs. Qualification follows your league's points, tiebreakers, adjustments and forfeit results.</p>
        <div className={styles.fields}>
          <div className={styles.field}><span>Playoffs</span><SelectPicker label="Enable playoffs" disabled={busy} value={settings.enabled?'enabled':'disabled'} onChange={value=>field('enabled',value==='enabled')} options={[{value:'disabled',label:'Disabled'},{value:'enabled',label:'Enabled'}]}/></div>
          <div className={styles.field}><span>Qualifying teams</span><SelectPicker label="Qualifying teams" disabled={busy} value={settings.qualifiers} onChange={value=>field('qualifiers',Number(value))} options={[2,4,8].map(value=>({value,label:`Top ${value} teams`}))}/></div>
          <div className={styles.field}><span>Third-place match</span><SelectPicker label="Third-place match" disabled={busy||settings.qualifiers===2} value={settings.third_place?'yes':'no'} onChange={value=>field('third_place',value==='yes')} options={[{value:'no',label:'No third-place match'},{value:'yes',label:'Include third-place match'}]}/></div>
        </div>
        <p className={styles.hint}>The top {settings.qualifiers} positions are highlighted while playoffs are enabled. A third-place match is available with four or eight qualifiers.</p>
        <button className={styles.primary} disabled={busy||!dirty}>{busy?'Saving…':'Save playoff settings'}</button>
      </section></fieldset></form>
      <section className={styles.section} aria-label="Playoff bracket management"><h2>Playoff bracket</h2>
        {bracket?<><p className={styles.hint}>A {bracket.qualifiers}-team bracket is saved{bracket.third_place?' with a third-place match':''}. Its seeds and format remain fixed when settings or league standings change. You can continue managing this bracket even with playoffs disabled.</p><Link className={styles.back} to="/playoffs" viewTransition>View existing bracket →</Link></>:<>
          <p className={styles.hint}>Preview seeds from the current standings before saving. You need at least {settings.qualifiers} teams. Saving fixes the qualified teams and bracket format; only one bracket can be created for this league.</p>
          {dirty&&<p className={styles.hint}>Save your settings before previewing.</p>}
          <button className={styles.secondary} disabled={busy||dirty||!settings.enabled} onClick={showPreview}>Preview bracket</button>
          {preview&&<div className={styles.editor} aria-label="Bracket preview"><h2>Bracket preview</h2><p className={styles.hint}>Single elimination · {preview.settings.qualifiers} qualifiers{preview.settings.third_place?' · Third-place match included':''}. No regular-season fixtures will be created.</p><div className={bracketStyles.previewList}>{preview.matchups.map(match=><div className={bracketStyles.previewMatch} key={match.position}><span><small>#{match.home.seed}</small><TeamLogo name={match.home.name} logoKey={match.home.logo_key} size="compact"/><span>{match.home.name}</span></span><span className={bracketStyles.vs}>vs</span><span><small>#{match.away.seed}</small><TeamLogo name={match.away.name} logoKey={match.away.logo_key} size="compact"/><span>{match.away.name}</span></span></div>)}</div><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={generate}>Save playoff bracket</button><button className={styles.secondary} disabled={busy} onClick={()=>setPreview(null)}>Cancel preview</button></div></div>}
        </>}
      </section>
    </>}
  </div>
}
