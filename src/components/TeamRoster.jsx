import { useEffect, useState } from 'react'
import { getPlayersByTeam, addPlayer, renamePlayer, deletePlayer } from '../api'
import styles from '../pages/SettingsTeams.module.css'

export default function TeamRoster({team,limit,onChanged,onBusy}){
  const [players,setPlayers]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
  const [name,setName]=useState(''),[edit,setEdit]=useState(null),[confirm,setConfirm]=useState(null),[error,setError]=useState('')
  useEffect(()=>{let live=true;getPlayersByTeam(team.id).then(players=>{if(live)setPlayers(players)}).catch(error=>{if(live)setError(error.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[team.id])
  function pending(value){setBusy(value);onBusy(value)}
  async function add(event){event.preventDefault();pending(true);setError('');try{const player=await addPlayer(name.trim(),team.id);setPlayers(current=>[...current,{...player,has_goals:false}]);setName('');await onChanged()}catch(error){setError(error.message)}finally{pending(false)}}
  async function rename(event){event.preventDefault();pending(true);setError('');try{const player=await renamePlayer(edit.id,edit.name.trim());setPlayers(current=>current.map(item=>item.id===player.id?{...item,name:player.name}:item));setEdit(null)}catch(error){setError(error.message)}finally{pending(false)}}
  async function remove(id){pending(true);setError('');try{await deletePlayer(id);setPlayers(current=>current.filter(item=>item.id!==id));setConfirm(null);await onChanged()}catch(error){setError(error.message)}finally{pending(false)}}
  const full=limit!==null&&players.length>=limit
  return <section className={styles.roster} aria-label={`${team.name} roster`}>
    <div className={styles.rosterHeading}><h2>Team roster</h2><span role="status">{players.length} players · {limit===null?'Unlimited':`${limit} maximum`}</span></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {loading?<p className={styles.hint}>Loading roster…</p>:<>
      {full&&<p className={styles.capacityNotice}>{players.length>limit?'This roster exceeds the new limit. Existing players are retained.':'This team has reached its roster limit.'} Increase the league limit or remove an eligible player before adding another.</p>}
      <form className={styles.addRow} onSubmit={add}><input aria-label="Player name" placeholder="Player name" maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={busy||full} required /><button className={styles.btnPrimary} disabled={busy||full||!name.trim()}>+ Add Player</button></form>
      <p className={styles.hint}>Players with recorded goals can be renamed but cannot be deleted, preserving their historical attribution.</p>
      <div className={styles.rosterList}>
        {!players.length&&<p className={styles.hint}>No players on this team yet.</p>}
        {players.map(player=><div key={player.id} className={styles.playerRow}>
          {edit?.id===player.id?<form className={styles.editPlayer} onSubmit={rename}><input aria-label="New player name" maxLength={100} required autoFocus value={edit.name} onChange={event=>setEdit(current=>({...current,name:event.target.value}))} /><div className={styles.rowActions}><button className={styles.btnSave} disabled={busy||!edit.name.trim()}>Save player</button><button type="button" className={styles.btnGhost} disabled={busy} onClick={()=>setEdit(null)}>Cancel</button></div></form>:<><span>{player.name}</span><div className={styles.rowActions}>{confirm===player.id?<><span className={styles.hint}>Delete player?</span><button className={styles.btnDelete} disabled={busy} onClick={()=>remove(player.id)}>Confirm delete player</button><button className={styles.btnGhost} disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></>:<><button className={styles.btnSave} aria-label={`Rename ${player.name}`} disabled={busy} onClick={()=>{setEdit({id:player.id,name:player.name});setConfirm(null)}}>Rename</button><button className={styles.btnDeleteOutline} aria-label={`Delete ${player.name}`} title={player.has_goals?'This player has recorded goals. Rename instead.':undefined} disabled={busy||player.has_goals} onClick={()=>setConfirm(player.id)}>Delete</button></>}</div></>}
        </div>)}
      </div>
    </>}
  </section>
}
