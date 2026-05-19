import { useState, useEffect } from 'react'
import AppLayout from '../components/AppLayout'
import styles from './Schedule.module.css'
import { getFixtures, getSession } from '../api'

function formatDate(dateStr) {
  // dateStr is 'YYYY-MM-DD'; noon avoids any UTC-to-local shift
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(timeStr) {
  // timeStr is 'HH:MM:SS' from PostgreSQL
  return timeStr ? timeStr.slice(0, 5) : ''
}

export default function Schedule() {
  const [upcoming, setUpcoming] = useState([])
  const [past,     setPast]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const session = getSession()
  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session?.leagueId) {
      setError('No league found. Please log in.')
      setLoading(false)
      return
    }
    getFixtures(session.leagueId)
      .then(({ upcoming, past }) => {
        setUpcoming(upcoming)
        setPast(past)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Schedule</h1>
            <p className={styles.pageSubtitle}>Fixtures and results</p>
          </div>
          {isAdmin && (
            <div className={styles.adminActions}>
              <button className={styles.btnSecondary}>+ Add Fixture</button>
              <button className={styles.btnPrimary}>+ Add Result</button>
            </div>
          )}
        </div>

        {loading && (
          <p style={{ color: '#888', padding: '32px 0', fontSize: '0.8125rem' }}>Loading…</p>
        )}
        {!loading && error && (
          <p style={{ color: '#c06060', padding: '32px 0', fontSize: '0.8125rem' }}>{error}</p>
        )}

        {!loading && !error && (
          <>
            <section>
              <div className={styles.sectionLabel}>
                <span className={styles.labelLine} />
                Upcoming Fixtures
              </div>
              <div className={styles.list}>
                {upcoming.length === 0 && (
                  <p style={{ color: '#666', padding: '16px 24px', fontSize: '0.8125rem' }}>
                    No upcoming fixtures.
                  </p>
                )}
                {upcoming.map(f => (
                  <div key={f.id} className={styles.fixtureRow}>
                    <span className={styles.rowDate}>{formatDate(f.date)}</span>
                    <span className={styles.rowMatchup}>
                      <span className={styles.teamName}>{f.home_team_name}</span>
                      <span className={styles.vs}>vs</span>
                      <span className={styles.teamName}>{f.away_team_name}</span>
                    </span>
                    <span className={styles.rowTime}>{formatTime(f.time)}</span>
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
                {past.length === 0 && (
                  <p style={{ color: '#666', padding: '16px 24px', fontSize: '0.8125rem' }}>
                    No results yet.
                  </p>
                )}
                {past.map(r => (
                  <div key={r.id} className={styles.resultRow}>
                    <span className={styles.rowDate}>{formatDate(r.date)}</span>
                    <span className={styles.rowMatchup}>
                      <span className={styles.teamName}>{r.home_team_name}</span>
                      <span className={styles.score}>{r.home_score} – {r.away_score}</span>
                      <span className={styles.teamName}>{r.away_team_name}</span>
                    </span>
                    <span className={styles.rowTime}>{formatTime(r.time)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

      </div>
    </AppLayout>
  )
}
