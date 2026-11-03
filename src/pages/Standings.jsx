import TeamLogo from '../components/TeamLogo'
import { flushSync } from 'react-dom'
import StatsMenu from '../components/StatsMenu'
import { QUICK_OPTIONS, LEAGUE_OPTIONS, quickStat, leagueStats, readStatsPreferences } from './standingsStats'
import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './Standings.module.css'
import AddResultModal from '../components/AddResultModal'
import { getStandings, getSession } from '../api'
import { Link } from 'react-router-dom'

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

  const leagueId = session?.leagueId
  const preferenceKey = `pitchsync:stats:${leagueId}`
  const [preferences, setPreferences] = useState(() => readStatsPreferences(preferenceKey))
  const statsGridRef = useRef(null)
  const animations = useRef([])
  const latestPreferences = useRef(preferences)
  useEffect(() => {
    const saved = readStatsPreferences(preferenceKey)
    latestPreferences.current = saved
    setPreferences(saved)
  }, [preferenceKey])
  useEffect(() => () => { animations.current.forEach(animation => animation.cancel()) }, [])

  function changePreferences(next) {
    // Save locally even when the browser cannot animate snapshots.
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)) } catch { /* Session-only preferences when storage is unavailable. */ }
    latestPreferences.current = next
    animations.current.forEach(animation => animation.cancel())
    animations.current = []
    const grid = statsGridRef.current
    const before = new Map([...grid?.children || []].map(card => [card.dataset.statId, { rect: card.getBoundingClientRect(), clone: card.cloneNode(true) }]))
    const oldHeight = grid?.getBoundingClientRect().height
    flushSync(() => setPreferences(next))
    if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timing = { duration: 220, easing: 'cubic-bezier(.2,.65,.3,1)' }
    const animate = (element, frames) => {
      const animation = element.animate(frames, timing)
      animations.current.push(animation)
      return animation
    }
    const after = new Set()
    for (const card of grid.children) {
      const id = card.dataset.statId
      after.add(id)
      const previous = before.get(id)
      const rect = card.getBoundingClientRect()
      if (previous) {
        animate(card, [
          { transform: `translate(${previous.rect.left - rect.left}px, ${previous.rect.top - rect.top}px)`, width: `${previous.rect.width}px` },
          { transform: 'translate(0, 0)', width: `${rect.width}px` },
        ])
      } else {
        animate(card, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }])
      }
    }
    for (const [id, { rect, clone }] of before) {
      if (after.has(id)) continue
      Object.assign(clone.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', viewTransitionName: 'none', pointerEvents: 'none', zIndex: '55', background: '#171614' })
      clone.setAttribute('aria-hidden', 'true')
      document.body.appendChild(clone)
      animate(clone, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-5px)' }]).finished.catch(() => {}).finally(() => clone.remove())
    }
    const newHeight = grid.getBoundingClientRect().height
    if (Math.abs(oldHeight - newHeight) > 1) animate(grid, [{ height: `${oldHeight}px` }, { height: `${newHeight}px` }])
    if (next.league.some((id, index) => id !== preferences.league[index])) {
      document.querySelectorAll('[data-league-stat] > span, [data-league-stat] > strong, [data-league-stat] > small').forEach(element => {
        animate(element, [{ opacity: .2, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }])
      })
    }
  }

  function toggleQuickStat(id) {
    const preferences = latestPreferences.current
    const selected = preferences.quick.includes(id)
    if ((selected && preferences.quick.length === 1) || (!selected && preferences.quick.length === 4)) return
    changePreferences({ ...preferences, quick: selected ? preferences.quick.filter(value => value !== id) : [...preferences.quick, id] })
  }

  function setLeagueStat(index, id) {
    const preferences = latestPreferences.current
    if (preferences.league[1 - index] === id || preferences.league[index] === id) return
    changePreferences({ ...preferences, league: preferences.league.map((value, i) => i === index ? id : value) })
  }

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

  const quickStats = preferences.quick.map(id => quickStat(id, standings))
  const league = leagueStats(standings)

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
            {preferences.league.map((id, index) => (
              <div key={index} data-stat-editable data-league-stat className={styles.leagueStat} style={{ viewTransitionName: `league-stat-${index}` }}>
                <StatsMenu label={`Change league stat ${index + 1}`} options={LEAGUE_OPTIONS} selected={[id]} unavailable={[preferences.league[1 - index]]} onToggle={id => setLeagueStat(index, id)} />
                <span className={styles.metricLabel}>{LEAGUE_OPTIONS.find(option => option.id === id).label}</span>
                <strong key={id}>{league[id].value}</strong><small>{league[id].sub}</small>
              </div>
            ))}
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
                      className={`${styles.tableRow} ${t.inQualificationZone ? styles.tableRowQual : ''}`}
                      data-qualification-zone={t.inQualificationZone || undefined}
                    >
                      <span className={styles.cPos}>{t.position}</span>

                      <span className={styles.cTeam}>
                        <TeamLogo name={t.teamName} logoKey={t.teamLogo} />
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
                      <span className={styles.cPts} title={`Match points: ${t.basePts}; manual adjustment: ${t.manualAdjustment}; forfeit deduction: ${t.forfeitPenalty}`}>
                        {t.pts}{(t.manualAdjustment !== 0 || t.forfeitPenalty !== 0) && <small className={styles.pointsAdjustment}>{t.netAdjustment > 0 ? '+' : ''}{t.netAdjustment} adj.</small>}
                      </span>

                      <span className={styles.cForm}>
                        {t.form.map((r, i) => (
                          <span key={i} className={styles[`badge${r}`]}>{r}</span>
                        ))}
                      </span>
                    </div>
                  ))}

                </div>
              </div>
              {standings.some(team => team.inQualificationZone) && <p className={styles.pointsNote}><span style={{color:'var(--color-gold)'}}>▎</span> Playoff qualification zone · based on the current standings. <Link to="/playoffs" viewTransition style={{color:'var(--color-gold)'}}>View playoffs →</Link></p>}
              {standings.some(team => team.manualAdjustment !== 0 || team.forfeitPenalty !== 0) && <p className={styles.pointsNote}>Points include manual adjustments and recorded forfeit deductions. Hover over a points total for the breakdown.</p>}
              {standings.some(team => team.forfeits > 0) && <p className={styles.pointsNote}>Team goal totals include awarded forfeit scores. Player goal tallies exclude forfeited matches.</p>}
            </section>

            <aside className={styles.side}>
              <div className={styles.sideCard} data-stat-editable>
                <StatsMenu label="Customize Quick Stats" options={QUICK_OPTIONS} selected={preferences.quick} multiple onToggle={toggleQuickStat} />
                <h3 className={styles.sideTitle}>Quick Stats</h3>
                <div ref={statsGridRef} className={styles.statsGrid} style={{ '--stat-count': quickStats.length }} aria-label="Selected quick stats">
                  {quickStats.map(s => (
                    <div key={s.id} data-stat-id={s.id} className={styles.statBox} style={{ viewTransitionName: `quick-${s.id}` }}>
                      <span className={styles.statLabel}>{s.label}</span>
                      <span className={styles.statValue} title={s.title}>{s.value}{s.tied && <small className={styles.tied}>{s.tied}</small>}</span>
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
