import AppLayout from '../components/AppLayout'
import styles from './Schedule.module.css'

const UPCOMING = [
  { id: 1, date: 'Sat 24 May 2025', home: 'Falcons FC',  away: 'City Rovers', time: '15:00' },
  { id: 2, date: 'Sat 24 May 2025', home: 'Kings FC',    away: 'United SC',   time: '17:30' },
  { id: 3, date: 'Sun 25 May 2025', home: 'Strikers',    away: 'City FC',     time: '11:00' },
  { id: 4, date: 'Sat 31 May 2025', home: 'City Rovers', away: 'Kings FC',    time: '14:00' },
  { id: 5, date: 'Sat 31 May 2025', home: 'United SC',   away: 'Falcons FC',  time: '16:30' },
]

const RESULTS = [
  { id: 1, date: 'Sat 17 May 2025', home: 'Falcons FC',  away: 'Strikers',    hs: 3, as: 1, time: '15:00' },
  { id: 2, date: 'Sat 17 May 2025', home: 'City Rovers', away: 'United SC',   hs: 2, as: 2, time: '17:30' },
  { id: 3, date: 'Sun 18 May 2025', home: 'Kings FC',    away: 'City FC',     hs: 4, as: 0, time: '11:00' },
  { id: 4, date: 'Sat 10 May 2025', home: 'United SC',   away: 'Falcons FC',  hs: 0, as: 2, time: '14:00' },
  { id: 5, date: 'Sat 10 May 2025', home: 'Strikers',    away: 'City Rovers', hs: 1, as: 3, time: '16:30' },
]

export default function Schedule() {
  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Schedule</h1>
            <p className={styles.pageSubtitle}>Fixtures and results</p>
          </div>
          <div className={styles.adminActions}>
            <button className={styles.btnSecondary}>+ Add Fixture</button>
            <button className={styles.btnPrimary}>+ Add Result</button>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="datePicker">Date</label>
            <input id="datePicker" type="date" className={styles.dateInput} />
          </div>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="teamFilter">Team</label>
            <div className={styles.selectWrap}>
              <select id="teamFilter" className={styles.select}>
                <option value="">All Teams</option>
                <option>Falcons FC</option>
                <option>City Rovers</option>
                <option>Kings FC</option>
                <option>United SC</option>
                <option>Strikers</option>
                <option>City FC</option>
              </select>
            </div>
          </div>
        </div>

        <section>
          <div className={styles.sectionLabel}>
            <span className={styles.labelLine} />
            Upcoming Fixtures
          </div>
          <div className={styles.list}>
            {UPCOMING.map(f => (
              <div key={f.id} className={styles.fixtureRow}>
                <span className={styles.rowDate}>{f.date}</span>
                <span className={styles.rowMatchup}>
                  <span className={styles.teamName}>{f.home}</span>
                  <span className={styles.vs}>vs</span>
                  <span className={styles.teamName}>{f.away}</span>
                </span>
                <span className={styles.rowTime}>{f.time}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className={styles.sectionLabel}>
            <span className={styles.labelLine} />
            Past Results
          </div>
          <div className={styles.list}>
            {RESULTS.map(r => (
              <div key={r.id} className={styles.resultRow}>
                <span className={styles.rowDate}>{r.date}</span>
                <span className={styles.rowMatchup}>
                  <span className={styles.teamName}>{r.home}</span>
                  <span className={styles.score}>{r.hs} – {r.as}</span>
                  <span className={styles.teamName}>{r.away}</span>
                </span>
                <span className={styles.rowTime}>{r.time}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </AppLayout>
  )
}
