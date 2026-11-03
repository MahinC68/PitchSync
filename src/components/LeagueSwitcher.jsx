import { Picker } from './FilterPicker'
import { useLeagues } from './LeagueContext'
import styles from './LeagueSwitcher.module.css'

export default function LeagueSwitcher({ label = 'Switch league' }) {
  const { leagues, activeId, switching, switchLeague, openCreate, openRename } = useLeagues()
  const active = leagues.find(league => league.id === activeId)
  return <div className={styles.switcher}>
    <Picker label={label} display={<span className={styles.current}>{active?.name || 'Choose a league'}</span>} disabled={switching}>
      {close => <div className={styles.menu}>
        <p className={styles.label}>Your leagues</p>
        <div className={styles.list}>
          {leagues.map(league => <div className={styles.row} key={league.id}>
            <button type="button" className={`${styles.league} ${league.id === activeId ? styles.active : ''}`} aria-pressed={league.id === activeId} onClick={() => { close(); switchLeague(league.id) }}>
              <span>{league.name}</span>{league.id === activeId && <small>Active</small>}
            </button>
            <button type="button" className={styles.rename} aria-label={`Rename ${league.name}`} onClick={event => { openRename(league, event); close() }}>✎</button>
          </div>)}
        </div>
        <button type="button" className={styles.create} onClick={event => { openCreate(event); close() }}>+ Create league</button>
      </div>}
    </Picker>
  </div>
}
