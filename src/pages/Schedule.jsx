import { useState, useEffect, useCallback, useMemo } from 'react'
import AppLayout from '../components/AppLayout'
import styles from './Schedule.module.css'
import AddFixtureModal from '../components/AddFixtureModal'
import AddResultModal from '../components/AddResultModal'
import EditResultModal from '../components/EditResultModal'
import { getFixtures, getSession } from '../api'

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(timeStr) {
  return timeStr ? timeStr.slice(0, 5) : ''
}

export default function Schedule() {
  const [upcoming,         setUpcoming]         = useState([])
  const [past,             setPast]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [showFixtureModal, setShowFixtureModal] = useState(false)
  const [showResultModal,  setShowResultModal]  = useState(false)
  const [editFixture,      setEditFixture]      = useState(null)

  const [filterTeam,     setFilterTeam]     = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')

  const session = getSession()
  const isAdmin = session?.role === 'admin'
  const leagueId = JSON.parse(localStorage.getItem('pitchsync'))?.LeagueId

  const loadFixtures = useCallback(() => {
    if (!leagueId) {
      setError('No league found. Please log in.')
      setLoading(false)
      return
    }
    setLoading(true)
    getFixtures(leagueId)
      .then(({ upcoming, past }) => {
        setUpcoming(upcoming)
        setPast(past)
        setError('')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [leagueId])

  useEffect(() => { loadFixtures() }, [loadFixtures])

  const teams = useMemo(() => {
    const set = new Set()
    past.forEach(r => { set.add(r.home_team_name); set.add(r.away_team_name) })
    return [...set].sort()
  }, [past])

  const filteredPast = useMemo(() => past.filter(r => {
    if (filterTeam && r.home_team_name !== filterTeam && r.away_team_name !== filterTeam) return false
    if (filterDateFrom && r.date < filterDateFrom) return false
    if (filterDateTo   && r.date > filterDateTo)   return false
    return true
  }), [past, filterTeam, filterDateFrom, filterDateTo])

  const hasFilters = filterTeam || filterDateFrom || filterDateTo

  function clearFilters() {
    setFilterTeam('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

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
              <button className={styles.btnSecondary} onClick={() => setShowFixtureModal(true)}>
                + Add Fixture
              </button>
              <button className={styles.btnPrimary} onClick={() => setShowResultModal(true)}>
                + Add Result
              </button>
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
                  <div key={f.id} className={`${styles.fixtureRow} ${isAdmin ? styles.fixtureRowAdmin : ''}`}>
                    <span className={styles.rowDate}>{formatDate(f.date)}</span>
                    <span className={styles.rowMatchup}>
                      <span className={styles.teamName}>{f.home_team_name}</span>
                      <span className={styles.vs}>vs</span>
                      <span className={styles.teamName}>{f.away_team_name}</span>
                    </span>
                    <span className={styles.rowTime}>{formatTime(f.time)}</span>
                    {isAdmin && (
                      <button className={styles.btnInlineResult} onClick={() => setShowResultModal(true)}>
                        Add Result
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className={styles.sectionLabel}>
                <span className={styles.labelLine} />
                Past Results
              </div>

              <div className={styles.filters}>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Team</label>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={filterTeam}
                      onChange={e => setFilterTeam(e.target.value)}
                    >
                      <option value="">All teams</option>
                      {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>From</label>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                  />
                </div>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>To</label>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                  />
                </div>
                {hasFilters && (
                  <button className={styles.btnClearFilters} onClick={clearFilters}>
                    Clear
                  </button>
                )}
              </div>

              <div className={styles.list}>
                {filteredPast.length === 0 && (
                  <p style={{ color: '#666', padding: '16px 24px', fontSize: '0.8125rem' }}>
                    {hasFilters ? 'No results match the filter.' : 'No results yet.'}
                  </p>
                )}
                {filteredPast.map(r => (
                  <div key={r.id} className={`${styles.resultRow} ${isAdmin ? styles.resultRowAdmin : ''}`}>
                    <span className={styles.rowDate}>{formatDate(r.date)}</span>
                    <span className={styles.rowMatchup}>
                      <span className={styles.teamName}>{r.home_team_name}</span>
                      <span className={styles.score}>{r.home_score} – {r.away_score}</span>
                      <span className={styles.teamName}>{r.away_team_name}</span>
                    </span>
                    <span className={styles.rowTime}>{formatTime(r.time)}</span>
                    {isAdmin && (
                      <button className={styles.btnInlineResult} onClick={() => setEditFixture(r)}>
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

      </div>

      {showFixtureModal && (
        <AddFixtureModal onClose={() => setShowFixtureModal(false)} onSuccess={() => { setShowFixtureModal(false); loadFixtures() }} />
      )}
      {showResultModal && (
        <AddResultModal onClose={() => setShowResultModal(false)} onSuccess={() => { setShowResultModal(false); loadFixtures() }} />
      )}
      {editFixture && (
        <EditResultModal
          fixture={editFixture}
          onClose={() => setEditFixture(null)}
          onSuccess={() => { setEditFixture(null); loadFixtures() }}
        />
      )}

    </AppLayout>
  )
}
