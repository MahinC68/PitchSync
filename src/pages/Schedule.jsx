import { useState, useEffect, useCallback, useMemo } from 'react'
import { DatePicker, TeamPicker } from '../components/FilterPicker'
import styles from './Schedule.module.css'
import AddFixtureModal from '../components/AddFixtureModal'
import AddResultModal from '../components/AddResultModal'
import ForfeitModal from '../components/ForfeitModal'
import EditResultModal from '../components/EditResultModal'
import { getFixtures, getSession, deleteFixture } from '../api'

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
  const [modalOrigin, setModalOrigin] = useState(null)

  function openModal(event, open) {
    const rect = event.currentTarget.getBoundingClientRect()
    setModalOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width })
    open()
  }

  const [forfeitFixture, setForfeitFixture] = useState(null)
  const [editFixture,      setEditFixture]      = useState(null)

  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const [filterTeam,     setFilterTeam]     = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')

  const session = getSession()
  const isAdmin = session?.role === 'admin'
  const leagueId = session?.leagueId

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

  async function handleDelete(id) {
    try {
      await deleteFixture(id)
      setDeleteConfirmId(null)
      loadFixtures()
    } catch (err) {
      console.error(err)
    }
  }

  function clearFilters() {
    setFilterTeam('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  return (
    <>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>League fixtures</p>
            <h1 className={styles.pageTitle}>Schedule</h1>
          </div>
          {isAdmin && (
            <div className={styles.adminActions}>
              <button className={styles.btnSecondary} onClick={event => openModal(event, () => setShowFixtureModal(true))}>
                + Add Fixture
              </button>
              <button className={styles.btnPrimary} onClick={event => openModal(event, () => setShowResultModal(true))}>
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
                      <div className={styles.rowActions}>
                        <button className={styles.btnInlineResult} onClick={event => openModal(event, () => setShowResultModal(true))}>
                          Add Result
                        </button>
                        <button className={styles.btnInlineResult} onClick={event => openModal(event, () => setForfeitFixture(f))}>Forfeit</button>
                        {deleteConfirmId === f.id ? (
                          <>
                            <span className={styles.deleteConfirmText}>Delete?</span>
                            <button className={styles.btnInlineDeleteConfirm} onClick={() => handleDelete(f.id)}>Yes</button>
                            <button className={styles.btnInlineGhost} onClick={() => setDeleteConfirmId(null)}>No</button>
                          </>
                        ) : (
                          <button className={styles.btnInlineDelete} onClick={() => setDeleteConfirmId(f.id)}>Delete</button>
                        )}
                      </div>
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
                  <TeamPicker value={filterTeam} options={teams} onChange={setFilterTeam} />
                </div>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>From</label>
                  <DatePicker label="From" value={filterDateFrom} onChange={setFilterDateFrom} />
                </div>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>To</label>
                  <DatePicker label="To" value={filterDateTo} onChange={setFilterDateTo} />
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
                      <span className={styles.score}>{r.home_score} – {r.away_score}{r.forfeit_team_id != null && <small className={styles.forfeitTag}>Forfeit</small>}</span>
                      <span className={styles.teamName}>{r.away_team_name}</span>
                    </span>
                    <span className={styles.rowTime}>{formatTime(r.time)}</span>
                    {isAdmin && (
                      <div className={styles.rowActions}>
                        <button className={styles.btnInlineResult} onClick={event => openModal(event, () => r.forfeit_team_id != null ? setForfeitFixture(r) : setEditFixture(r))}>
                          {r.forfeit_team_id != null ? 'View forfeit' : 'Edit'}
                        </button>
                        {r.forfeit_team_id == null && <button className={styles.btnInlineResult} onClick={event => openModal(event, () => setForfeitFixture(r))}>Forfeit</button>}
                        {deleteConfirmId === r.id ? (
                          <>
                            <span className={styles.deleteConfirmText}>Delete?</span>
                            <button className={styles.btnInlineDeleteConfirm} onClick={() => handleDelete(r.id)}>Yes</button>
                            <button className={styles.btnInlineGhost} onClick={() => setDeleteConfirmId(null)}>No</button>
                          </>
                        ) : (
                          <button className={styles.btnInlineDelete} onClick={() => setDeleteConfirmId(r.id)}>Delete</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

      </div>

      {showFixtureModal && (
        <AddFixtureModal origin={modalOrigin} onClose={() => setShowFixtureModal(false)} onSuccess={() => { setShowFixtureModal(false); loadFixtures() }} />
      )}
      {showResultModal && (
        <AddResultModal origin={modalOrigin} onClose={() => setShowResultModal(false)} onSuccess={() => { setShowResultModal(false); loadFixtures() }} />
      )}
      {forfeitFixture && <ForfeitModal fixture={forfeitFixture} origin={modalOrigin} onClose={() => setForfeitFixture(null)} onSuccess={() => { setForfeitFixture(null); loadFixtures() }} />}
      {editFixture && (
        <EditResultModal origin={modalOrigin}
          fixture={editFixture}
          onClose={() => setEditFixture(null)}
          onSuccess={() => { setEditFixture(null); loadFixtures() }}
        />
      )}

    </>
  )
}
