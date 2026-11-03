import { useLeagues } from './LeagueContext'
import LeagueLogo from './LeagueLogo'
import styles from './LeagueHeader.module.css'

export default function LeagueHeader(){
  const {identity}=useLeagues()
  return <div className={styles.header} role="group" aria-label="League header"><LeagueLogo league={identity} size="compact"/><span>{identity?.name||'League overview'}</span></div>
}
