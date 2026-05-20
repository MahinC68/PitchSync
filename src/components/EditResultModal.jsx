import { useState, useEffect } from 'react'
import styles from './Modal.module.css'
import {
  getPlayersByTeam, addResult, addPlayer, addGoal,
  getGoalsByMatch, deleteGoalsByMatch,
} from '../api'

const UNKNOWN    = 'unknown'
const OWN_GOAL   = 'own_goal'
const NEW_PLAYER = 'new'

function emptyScorer() {
  return { value: UNKNOWN, newName: '' }
}

function resizeScorers(prev, n) {
  if (prev.length === n) return prev
  if (n > prev.length) {
    return [...prev, ...Array.from({ length: n - prev.length }, emptyScorer)]
  }
  return prev.slice(0, n)
}

function ScorerSlot({ label, players, playersLoading, scorer, onChange, onConfirmNew, confirming }) {
  return (
    <div className={styles.scorerSlot}>
      <span className={styles.scorerSlotLabel}>{label}</span>
      <div className={styles.scorerSlotInputs}>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={scorer.value}
            disabled={playersLoading}
            onChange={e => onChange({ ...scorer, value: e.target.value, newName: '' })}
          >
            <option value={UNKNOWN}>Unknown / No scorer</option>
            {players.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
            <option value={OWN_GOAL}>Own Goal</option>
            <option value={NEW_PLAYER}>+ Add new player…</option>
          </select>
        </div>

        {scorer.value === NEW_PLAYER && (
          <div className={styles.newPlayerRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter player name"
              value={scorer.newName}
              autoFocus
              onChange={e => onChange({ ...scorer, newName: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); onConfirmNew() }
              }}
            />
            <button
              type="button"
              className={styles.btnConfirmPlayer}
              onClick={onConfirmNew}
              disabled={!scorer.newName.trim() || confirming}
            >
              {confirming ? '…' : 'Add'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EditResultModal({ fixture, onClose, onSuccess }) {
  const [homeScore,      setHomeScore]      = useState(String(fixture.home_score ?? ''))
  const [awayScore,      setAwayScore]      = useState(String(fixture.away_score ?? ''))
  const [homeScorers,    setHomeScorers]    = useState([])
  const [awayScorers,    setAwayScorers]    = useState([])
  const [players,        setPlayers]        = useState({})
  const [loading,        setLoading]        = useState(true)
  const [playersLoading, setPlayersLoading] = useState(false)
  const [confirming,     setConfirming]     = useState(null)
  const [error,          setError]          = useState('')
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    Promise.all([
      getPlayersByTeam(fixture.home_team_id),
      getPlayersByTeam(fixture.away_team_id),
      getGoalsByMatch(fixture.id),
    ])
      .then(([homePlayers, awayPlayers, goals]) => {
        setPlayers({
          [fixture.home_team_id]: homePlayers,
          [fixture.away_team_id]: awayPlayers,
        })

        const homeGoals = goals.filter(g => Number(g.team_id) === Number(fixture.home_team_id))
        const awayGoals = goals.filter(g => Number(g.team_id) === Number(fixture.away_team_id))

        const toSlots = (score, matchGoals) =>
          Array.from({ length: Number(score) || 0 }, (_, i) =>
            i < matchGoals.length
              ? { value: String(matchGoals[i].player_id), newName: '' }
              : emptyScorer()
          )

        setHomeScorers(toSlots(fixture.home_score, homeGoals))
        setAwayScorers(toSlots(fixture.away_score, awayGoals))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleHomeScoreChange(val) {
    setHomeScore(val)
    const parsed = parseInt(val, 10)
    const n = Number.isInteger(parsed) && parsed > 0 ? parsed : 0
    setHomeScorers(prev => resizeScorers(prev, n))
  }

  function handleAwayScoreChange(val) {
    setAwayScore(val)
    const parsed = parseInt(val, 10)
    const n = Number.isInteger(parsed) && parsed > 0 ? parsed : 0
    setAwayScorers(prev => resizeScorers(prev, n))
  }

  function updateHomeScorer(i, updated) {
    setHomeScorers(prev => prev.map((s, idx) => idx === i ? updated : s))
  }

  function updateAwayScorer(i, updated) {
    setAwayScorers(prev => prev.map((s, idx) => idx === i ? updated : s))
  }

  async function handleConfirmNewPlayer(side, index) {
    if (confirming) return
    const scorer = (side === 'home' ? homeScorers : awayScorers)[index]
    const name = scorer?.newName.trim()
    if (!name) return

    const teamId = side === 'home' ? fixture.home_team_id : fixture.away_team_id
    setConfirming(`${side}:${index}`)
    setError('')

    try {
      const existing = (players[teamId] ?? []).find(
        p => p.name.toLowerCase() === name.toLowerCase()
      )
      let playerId
      if (existing) {
        playerId = existing.id
      } else {
        const created = await addPlayer(name, teamId)
        playerId = created.id
      }

      const freshPlayers = await getPlayersByTeam(teamId)
      setPlayers(prev => ({ ...prev, [teamId]: freshPlayers }))

      const updater = prev => prev.map((s, i) =>
        i === index ? { value: String(playerId), newName: '' } : s
      )
      if (side === 'home') setHomeScorers(updater)
      else setAwayScorers(updater)
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (homeScore === '' || awayScore === '') {
      setError('Please enter both scores.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await deleteGoalsByMatch(fixture.id)
      await addResult(fixture.id, Number(homeScore), Number(awayScore))

      const allScorers = [
        ...homeScorers.map(s => ({ ...s, teamId: fixture.home_team_id })),
        ...awayScorers.map(s => ({ ...s, teamId: fixture.away_team_id })),
      ]

      const sessionCreated = {}

      for (const scorer of allScorers) {
        if (scorer.value === UNKNOWN || scorer.value === OWN_GOAL) continue

        let playerId
        if (scorer.value === NEW_PLAYER) {
          const name = scorer.newName.trim()
          if (!name) continue
          const cacheKey = `${scorer.teamId}:${name.toLowerCase()}`
          if (sessionCreated[cacheKey]) {
            playerId = sessionCreated[cacheKey]
          } else {
            const existing = (players[scorer.teamId] ?? []).find(
              p => p.name.toLowerCase() === name.toLowerCase()
            )
            if (existing) {
              playerId = existing.id
            } else {
              const player = await addPlayer(name, scorer.teamId)
              playerId = player.id
              sessionCreated[cacheKey] = player.id
            }
          }
        } else {
          playerId = Number(scorer.value)
        }

        await addGoal(fixture.id, playerId, Number(scorer.teamId))
      }

      onSuccess()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const scoresReady     = homeScore !== '' && awayScore !== ''
  const homeTeamPlayers = players[fixture.home_team_id] ?? []
  const awayTeamPlayers = players[fixture.away_team_id] ?? []

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalScrollable}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Edit Result</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className={styles.modalBodyScroll}>

            {loading ? (
              <p className={styles.modalLoading}>Loading…</p>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Fixture</label>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 300, color: 'var(--color-text)' }}>
                    {fixture.home_team_name} vs {fixture.away_team_name}
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>· {fixture.date}</span>
                  </p>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Home Score</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.input}
                      placeholder="0"
                      value={homeScore}
                      onChange={e => handleHomeScoreChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Away Score</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.input}
                      placeholder="0"
                      value={awayScore}
                      onChange={e => handleAwayScoreChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {scoresReady && (homeScorers.length > 0 || awayScorers.length > 0) && (
                  <div className={styles.scorerSection}>
                    <div className={styles.scorerDivider}>Goal Scorers</div>

                    {homeScorers.length > 0 && (
                      <div className={styles.scorerGroup}>
                        <span className={styles.scorerGroupLabel}>{fixture.home_team_name}</span>
                        {homeScorers.map((scorer, i) => (
                          <ScorerSlot
                            key={i}
                            label={`Goal ${i + 1}`}
                            players={homeTeamPlayers}
                            playersLoading={playersLoading}
                            scorer={scorer}
                            onChange={updated => updateHomeScorer(i, updated)}
                            onConfirmNew={() => handleConfirmNewPlayer('home', i)}
                            confirming={confirming === `home:${i}`}
                          />
                        ))}
                      </div>
                    )}

                    {awayScorers.length > 0 && (
                      <div className={styles.scorerGroup}>
                        <span className={styles.scorerGroupLabel}>{fixture.away_team_name}</span>
                        {awayScorers.map((scorer, i) => (
                          <ScorerSlot
                            key={i}
                            label={`Goal ${i + 1}`}
                            players={awayTeamPlayers}
                            playersLoading={playersLoading}
                            scorer={scorer}
                            onChange={updated => updateAwayScorer(i, updated)}
                            onConfirmNew={() => handleConfirmNewPlayer('away', i)}
                            confirming={confirming === `away:${i}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          <div className={styles.modalFooter}>
            {error && <p className={styles.modalError}>{error}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving || loading}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
