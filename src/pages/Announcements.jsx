import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession, getAnnouncements, deleteAnnouncement } from '../api'
import AnnouncementModal from '../components/AnnouncementModal'
import { publicationDate } from '../components/AnnouncementPanel'
import LeagueHeader from '../components/LeagueHeader'
import styles from './Announcements.module.css'

export default function Announcements({manage=false}){
  const session=getSession(),leagueId=session?.leagueId,isAdmin=session?.role==='admin'
  const [data,setData]=useState(null),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true)
  const [editor,setEditor]=useState(null),[confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{let live=true;setLoading(true);getAnnouncements(leagueId,20,offset).then(data=>{if(!live)return;if(offset&&!data.items.length){setOffset(data.total?Math.floor((data.total-1)/20)*20:0);return}setData(data);setError('')}).catch(error=>{if(live)setError(error.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[leagueId,offset,refresh])
  function open(item,event){const trigger=event.currentTarget,rect=trigger.getBoundingClientRect();setEditor({item,trigger,origin:{x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width}});setConfirm(null)}
  async function remove(id){setBusy(true);setError('');setNotice('');try{await deleteAnnouncement(id);setConfirm(null);setRefresh(value=>value+1);setNotice('Announcement deleted.')}catch(error){setError(error.message)}finally{setBusy(false)}}
  return <div className={styles.page}>
    <Link className={styles.back} to={manage?'/settings':'/standings'} viewTransition>← Back to {manage?'Settings':'Standings'}</Link>
    <div className={styles.heading}><div><LeagueHeader/><h1>Announcements</h1><p className={styles.hint}>{manage?'Publish updates for your league’s administrators and players.':'The latest updates from your league.'}</p></div><div className={styles.actions}>{manage&&isAdmin?<button className={styles.primary} disabled={busy||loading} onClick={event=>open(null,event)}>+ New announcement</button>:isAdmin&&<Link className={styles.back} to="/settings/announcements" viewTransition>Manage announcements →</Link>}</div></div>
    {error&&<div role="alert" className={styles.error}>{error} <button className={styles.secondary} onClick={()=>setRefresh(value=>value+1)}>Retry</button></div>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {loading?<p className={styles.hint}>Loading announcements…</p>:data&&<>
      {!data.items.length&&<section className={styles.empty}><h2>No announcements yet</h2><p className={styles.hint}>{manage?'Publish your first update using the button above.':'League updates will appear here when published.'}</p></section>}
      <div className={styles.list}>{data.items.map(item=><article className={styles.card} key={item.id} aria-label={item.title}><time dateTime={item.published_at}>{publicationDate(item.published_at)}</time><h2>{item.title}</h2><p className={styles.message}>{item.message}</p>{manage&&isAdmin&&<div className={styles.actions}>{confirm===item.id?<><span className={styles.hint}>Delete this announcement?</span><button className={styles.danger} disabled={busy} onClick={()=>remove(item.id)}>Confirm delete announcement</button><button className={styles.secondary} disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></>:<><button className={styles.secondary} disabled={busy} onClick={event=>open(item,event)}>Edit announcement</button><button className={styles.danger} disabled={busy} onClick={()=>setConfirm(item.id)}>Delete announcement</button></>}</div>}</article>)}</div>
      {data.total>20&&<nav className={styles.pagination} aria-label="Announcement pages"><button className={styles.secondary} disabled={busy||offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous</button><span>{offset+1}–{Math.min(offset+20,data.total)} of {data.total}</span><button className={styles.secondary} disabled={busy||offset+20>=data.total} onClick={()=>setOffset(value=>value+20)}>Next</button></nav>}
    </>}
    {editor&&<AnnouncementModal config={editor} onClose={()=>setEditor(null)} onSaved={()=>{setOffset(0);setRefresh(value=>value+1);setNotice(editor.item?'Announcement updated.':'Announcement published.')}}/>}
  </div>
}
