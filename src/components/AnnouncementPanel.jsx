import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnnouncements, getSession } from '../api'
import styles from './AnnouncementPanel.module.css'

export function publicationDate(value){return new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}
export default function AnnouncementPanel(){
  const leagueId=getSession()?.leagueId
  const [data,setData]=useState(null),[error,setError]=useState('')
  useEffect(()=>{let live=true;getAnnouncements(leagueId,3).then(data=>{if(live)setData(data)}).catch(error=>{if(live)setError(error.message)});return()=>{live=false}},[leagueId])
  if(error)return <section className={styles.panel} aria-label="League announcements"><h2>Announcements</h2><p className={styles.error}>Announcements could not be loaded.</p><Link to="/announcements">View announcements →</Link></section>
  if(!data?.items.length)return null
  return <section className={styles.panel} aria-label="League announcements"><header><h2>Announcements</h2><span>{data.total}</span></header>{data.items.map(item=><details key={item.id} className={styles.item}><summary><time dateTime={item.published_at}>{publicationDate(item.published_at)}</time><strong>{item.title}</strong></summary><p>{item.message}</p></details>)}<Link to="/announcements" viewTransition>View all announcements →</Link></section>
}
