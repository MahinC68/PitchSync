import { useState, useEffect, useCallback } from 'react'
import styles from './Standings.module.css'
import AddResultModal from '../components/AddResultModal'
import { getStandings, getSession } from '../api'

function computeQuickStats(standings) {
  if (!standings.length) return []
  const byGf   = [...standings].sort((a, b) => b.gf - a.gf)[0]
  const byGa   = [...standings].sort((a, b) => a.ga - b.ga)[0]
  const byGd   = [...standings].sort((a, b) => b.gd - a.gd)[0]
  const byForm = [...standings].sort((a, b) => {
    const aW = a.form.filter(r => r === 'W').length
    const bW = b.form.filter(r => r === 'W').length
    return bW - aW
  })[0]
  return [
    { label: 'Most Goals',   value: byGf.teamName,   sub: `${byGf.gf} GF` },
    { label: 'Best Defense', value: byGa.teamName,   sub: `${byGa.ga} GA` },
    { label: 'Top GD',       value: byGd.teamName,   sub: byGd.gd >= 0 ? `+${byGd.gd}` : `${byGd.gd}` },
    { label: 'In Form',      value: byForm.teamName,  sub: byForm.form.join('') || '—' },
  ]
}

export default function Standings() {
  const [standings,       setStandings]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [showResultModal, setShowResultModal] = useState(false)
  const [modalOrigin, setModalOrigin] = useState(null)

  function openModal(event, open) {
    const rect = event.currentTarget.getBoundingClientRect()
    setModalOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width })
    open()
  }


  const session = getSession()
  const isAdmin = session?.role === 'admin'

  const leagueId = JSON.parse(localStorage.getItem('pitchsync'))?.LeagueId

  const loadStandings = useCallback(() => {
    if (!leagueId) {
      setError('No league found. Please log in.')
      setLoading(false)
      return
    }
    setLoading(true)
    getStandings(leagueId)
      .then(data => { setStandings(data); setError('') })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [leagueId])

  useEffect(() => {
    loadStandings()
  }, [loadStandings])

  function handleResultSuccess() {
    setShowResultModal(false)
    loadStandings()
  }

  const quickStats = computeQuickStats(standings)

  return (
    <>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>League overview</p>
            <h1 className={styles.pageTitle}>Standings</h1>
          </div>
          {isAdmin && (
            <button
              className={styles.btnAddResult}
              onClick={event => openModal(event, () => setShowResultModal(true))}
            >
              + Add Result
            </button>
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
          <div className={styles.overview}>
            <div><span>League leader</span><strong>{standings[0]?.teamName || 'No results yet'}</strong><small>{standings[0] ? `${standings[0].pts} points at the top` : 'Awaiting the first result'}</small></div>
            <div><span>Teams competing</span><strong>{standings.length.toString().padStart(2, '0')}</strong><small>Registered in this league</small></div>
            <div><span>Goals scored</span><strong>{standings.reduce((sum, t) => sum + Number(t.gf), 0)}</strong><small>Across all completed matches</small></div>
          </div>
          <div className={styles.body}>

            <section className={styles.main}>
              <div className={styles.tableWrap}>
                <div className={styles.tableScroll}>

                  <div className={`${styles.tableRow} ${styles.tableHead}`}>
                    <span className={styles.cPos}>#</span>
                    <span className={styles.cTeam}>Team</span>
                    <span className={styles.cNum}>MP</span>
                    <span className={styles.cNum}>W</span>
                    <span className={styles.cNum}>D</span>
                    <span className={styles.cNum}>L</span>
                    <span className={styles.cNum}>GF</span>
                    <span className={styles.cNum}>GA</span>
                    <span className={styles.cNum}>GD</span>
                    <span className={styles.cPts}>PTS</span>
                    <span className={styles.cForm}>Form</span>
                  </div>

                  {standings.map(t => (
                    <div
                      key={t.teamId}
                      className={`${styles.tableRow} ${t.position <= 2 ? styles.tableRowQual : ''}`}
                    >
                      <span className={styles.cPos}>{t.position}</span>

                      <span className={styles.cTeam}>
                        <span className={styles.teamCrest} aria-hidden="true">{t.teamName.split(' ').map(word => word[0]).slice(0, 2).join('')}</span>
                        <span className={styles.teamName}>{t.teamName}</span>
                      </span>

                      <span className={styles.cNum}>{t.mp}</span>
                      <span className={styles.cNum}>{t.w}</span>
                      <span className={styles.cNum}>{t.d}</span>
                      <span className={styles.cNum}>{t.l}</span>
                      <span className={styles.cNum}>{t.gf}</span>
                      <span className={styles.cNum}>{t.ga}</span>
                      <span className={`${styles.cNum} ${t.gd > 0 ? styles.gdPlus : t.gd < 0 ? styles.gdMinus : ''}`}>
                        {t.gd > 0 ? `+${t.gd}` : t.gd}
                      </span>
                      <span className={styles.cPts}>{t.pts}</span>

                      <span className={styles.cForm}>
                        {t.form.map((r, i) => (
                          <span key={i} className={styles[`badge${r}`]}>{r}</span>
                        ))}
                      </span>
                    </div>
                  ))}

                </div>
              </div>
            </section>

            <aside className={styles.side}>
              <div className={styles.sideCard}>
                <h3 className={styles.sideTitle}>Quick Stats</h3>
                <div className={styles.statsGrid}>
                  {quickStats.map(s => (
                    <div key={s.label} className={styles.statBox}>
                      <span className={styles.statLabel}>{s.label}</span>
                      <span className={styles.statValue}>{s.value}</span>
                      <span className={styles.statSub}>{s.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

          </div>
          </>
        )}

      </div>
      {showResultModal && (
        <AddResultModal origin={modalOrigin}
          onClose={() => setShowResultModal(false)}
          onSuccess={handleResultSuccess}
        />
      )}

    </>
  )
}
