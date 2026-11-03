import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectPicker } from '../components/FilterPicker'
import TeamLogo from '../components/TeamLogo'
import TeamRoster from '../components/TeamRoster'
import { getTeams,addTeam,renameTeam,deleteTeam,getRosterSettings,saveRosterSettings,uploadTeamLogo,removeTeamLogo } from '../api'
import styles from './SettingsTeams.module.css'

export default function SettingsTeams(){
  const [teams,setTeams]=useState([]),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true)
  const [limit,setLimit]=useState(null),[limitChoice,setLimitChoice]=useState('unlimited'),[custom,setCustom]=useState(10)
  const [name,setName]=useState(''),[editing,setEditing]=useState(null),[confirm,setConfirm]=useState(false)
  const [busy,setBusy]=useState(false),[rosterBusy,setRosterBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const file=useRef(null)
  useEffect(()=>{let live=true;Promise.all([getTeams(),getRosterSettings()]).then(([teams,settings])=>{if(!live)return;setTeams(teams);setSelected(teams[0]?.id??null);const max=settings.max_roster_size;setLimit(max);setLimitChoice(max===null?'unlimited':[10,15,20].includes(max)?String(max):'custom');if(max!==null)setCustom(max)}).catch(error=>{if(live)setError(error.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[])
  async function refresh(){const teams=await getTeams();setTeams(teams);setSelected(id=>teams.some(team=>team.id===id)?id:teams[0]?.id??null)}
  async function action(work){setBusy(true);setError('');setNotice('');try{await work()}catch(error){setError(error.message)}finally{setBusy(false)}}
  async function create(event){event.preventDefault();await action(async()=>{const team=await addTeam(name.trim());await refresh();setSelected(team.id);setName('');setNotice('Team created.')})}
  async function saveLimit(event){event.preventDefault();await action(async()=>{const value=limitChoice==='unlimited'?null:limitChoice==='custom'?Number(custom):Number(limitChoice);const settings=await saveRosterSettings(value);setLimit(settings.max_roster_size);setNotice('Roster limit saved. Existing players are retained.')})}
  async function saveName(event){event.preventDefault();await action(async()=>{await renameTeam(selected,editing.trim());await refresh();setEditing(null);setNotice('Team renamed.')})}
  async function remove(){await action(async()=>{await deleteTeam(selected);await refresh();setConfirm(false);setEditing(null);setNotice('Team deleted.')})}
  async function upload(event){const chosen=event.target.files?.[0];if(!chosen)return;await action(async()=>{if(chosen.size>2*1024*1024)throw Error('Team logos must be 2 MB or smaller');await uploadTeamLogo(selected,chosen);await refresh();setNotice('Team logo saved.')});if(file.current)file.current.value=''}
  const team=teams.find(team=>team.id===selected),disabled=busy||rosterBusy
  return <div className={styles.page}>
    <div className={styles.pageHead}><Link to="/settings" className={styles.backLink}>← Back to Settings</Link><p className={styles.eyebrow}>League settings</p><h1 className={styles.pageTitle}>Teams & Players</h1></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {loading?<p className={styles.hint}>Loading teams…</p>:<>
      <section className={styles.limitPanel} aria-label="League roster limit"><div><h2>Maximum roster size</h2><p className={styles.hint}>Applies to every team, including players added during result entry. Lowering the limit never removes existing players.</p></div><form className={styles.limitForm} onSubmit={saveLimit}>
        <SelectPicker label="Maximum roster size" disabled={disabled} value={limitChoice} onChange={setLimitChoice} options={[{value:'unlimited',label:'Unlimited'},...[10,15,20].map(value=>({value:String(value),label:`${value} players`})),{value:'custom',label:'Custom limit'}]} />
        {limitChoice==='custom'&&<input aria-label="Custom roster limit" type="number" step="1" min="1" max="1000" required value={custom} onChange={event=>setCustom(event.target.value)} disabled={disabled} />}
        <button className={styles.btnPrimary} disabled={disabled}>Save roster limit</button>
      </form></section>
      <div className={styles.management}>
        <section className={styles.teamPanel} aria-label="League teams"><h2>Your teams</h2><form className={styles.addTeam} onSubmit={create}><input placeholder="Team name" aria-label="Team name" maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={disabled} required /><button className={styles.btnPrimary} disabled={disabled||!name.trim()}>+ Add Team</button></form>
          {!teams.length&&<p className={styles.hint}>Create a team to add its roster and logo.</p>}
          <div className={styles.teamList}>{teams.map(team=><button type="button" key={team.id} aria-label={`View ${team.name} roster`} aria-pressed={team.id===selected} className={`${styles.teamOption} ${team.id===selected?styles.selected:''}`} disabled={disabled} onClick={()=>{setSelected(team.id);setEditing(null);setConfirm(false);setError('');setNotice('')}}><TeamLogo name={team.name} logoKey={team.logo_key}/><span><strong>{team.name}</strong><small>{team.player_count} players{limit!==null?` / ${limit}`:' · Unlimited'}</small></span></button>)}</div>
        </section>
        {team&&<section className={styles.detail} aria-label="Selected team">
          <div className={styles.teamHeader}><TeamLogo name={team.name} logoKey={team.logo_key} size="large"/><div><h2>{team.name}</h2><p className={styles.hint}>{team.player_count} players · {limit===null?'Unlimited roster':`${limit} maximum`}</p></div></div>
          <div className={styles.logoActions}><label className={styles.uploadLabel}>{team.logo_key?'Replace logo':'Upload logo'}<input ref={file} aria-label="Team logo file" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={upload}/></label>{team.logo_key&&<button className={styles.btnGhost} disabled={disabled} onClick={()=>action(async()=>{await removeTeamLogo(team.id);await refresh();setNotice('Team logo removed.')})}>Remove logo</button>}<p className={styles.hint}>PNG, JPEG or WebP · 2 MB max · up to 4096 × 4096 pixels</p></div>
          {editing!==null?<form className={styles.renameForm} onSubmit={saveName}><input aria-label="New team name" autoFocus maxLength={100} required value={editing} disabled={disabled} onChange={event=>setEditing(event.target.value)}/><div className={styles.rowActions}><button className={styles.btnSave} disabled={disabled||!editing.trim()}>Save team name</button><button type="button" className={styles.btnGhost} disabled={disabled} onClick={()=>setEditing(null)}>Cancel</button></div></form>:<div className={styles.rowActions}><button className={styles.btnSave} disabled={disabled} onClick={()=>setEditing(team.name)}>Rename team</button>{confirm?<><p className={styles.hint}>Delete this team and its eligible roster?</p><button className={styles.btnDelete} disabled={disabled} onClick={remove}>Confirm delete team</button><button className={styles.btnGhost} disabled={disabled} onClick={()=>setConfirm(false)}>Cancel</button></>:<button className={styles.btnDeleteOutline} disabled={disabled} onClick={()=>setConfirm(true)}>Delete team</button>}</div>}
          <TeamRoster key={team.id} team={team} limit={limit} onChanged={refresh} onBusy={setRosterBusy}/>
        </section>}
      </div>
    </>}
  </div>
}
