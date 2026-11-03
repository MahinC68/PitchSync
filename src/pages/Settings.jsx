import { Link } from 'react-router-dom'
import GeneralSettings from '../components/GeneralSettings'
import styles from './Settings.module.css'

const SECTIONS=[
  {to:'/settings/rules',title:'League Rules',subtitle:'Points system, tiebreakers, adjustments, match duration, and forfeits',path:'M3 5h14M3 10h14M3 15h14M7 3v4M13 8v4M9 13v4'},
  {to:'/settings/playoffs',title:'Competition',subtitle:'Playoffs, qualification zones, seeded brackets, and knockout results',path:'M2 3h5v5H2M2 12h5v5H2M7 5h5v10H7M12 10h6'},
  {to:'/settings/teams',title:'Teams & Players',subtitle:'Teams, team logos, player management, and roster limits',path:'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 18c0-4 2-6 6-6s6 2 6 6M14 4a3 3 0 0 1 0 6M15 12c3 0 4 2 4 6'},
  {to:'/settings/announcements',title:'Announcements',subtitle:'Publish and manage updates for everyone in your league',path:'m3 8 12-5v14L3 12V8ZM3 12l2 6h3l-2-5M15 7h3v6h-3'},
]
export default function Settings(){
  return <div className={styles.page}>
    <div className={styles.pageHead}><h1 className={styles.pageTitle}>Settings</h1><p className={styles.pageSubtitle}>Manage your league</p></div>
    <GeneralSettings/>
    <div className={styles.cards} aria-label="League settings sections">{SECTIONS.map(({to,title,subtitle,path})=><Link key={to} to={to} viewTransition className={styles.card}><span className={styles.cardIcon} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d={path} stroke="currentColor" strokeWidth="1.2"/></svg></span><span className={styles.cardBody}><span className={styles.cardTitle}>{title}</span><span className={styles.cardSub}>{subtitle}</span></span><span className={styles.cardArrow} aria-hidden="true">→</span></Link>)}</div>
  </div>
}
