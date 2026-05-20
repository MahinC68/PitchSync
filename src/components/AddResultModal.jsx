import { useState, useEffect } from 'react'
import styles from './Modal.module.css'
import { getFixtures, getPlayersByTeam, addResult, addPlayer, addGoal } from '../api'

const UNKNOWN    = 'unknown'
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

export default function AddResultModal({ onClose, onSuccess }) {
  const [upcoming,       setUpcoming]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [fixtureId,      setFixtureId]      = useState('')
  const [homeScore,      setHomeScore]      = useState('')
  const [awayScore,      setAwayScore]      = useState('')
  const [homeScorers,    setHomeScorers]    = useState([])
  const [awayScorers,    setAwayScorers]    = useState([])
  const [players,        setPlayers]        = useState({})   // { [teamId]: [{id, name}] }
  const [playersLoading, setPlayersLoading] = useState(false)
  const [confirming,     setConfirming]     = useState(null) // 'home:0', 'away:2', etc.
  const [error,          setError]          = useState('')
  const [saving,         setSaving]         = useState(false)

  // Load upcoming fixtures on mount
  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem('pitchsync'))
    const leagueId = auth?.LeagueId
    if (!leagueId) {
      setError('No league found.')
      setLoading(false)
      return
    }
    getFixtures(leagueId)
      .then(({ upcoming }) => {
        setUpcoming(upcoming)
        if (upcoming.length > 0) setFixtureId(String(upcoming[0].id))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Fetch players for both teams whenever the selected fixture changes
  useEffect(() => {
    if (!fixtureId || !upcoming.length) return
    const fix = upcoming.find(f => String(f.id) === fixtureId)
    if (!fix) return

    setPlayersLoading(true)
    Promise.all([
      getPlayersByTeam(fix.home_team_id),
      getPlayersByTeam(fix.away_team_id),
    ])
      .then(([homePlayers, awayPlayers]) => {
        setPlayers({
          [fix.home_team_id]: homePlayers,
          [fix.away_team_id]: awayPlayers,
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setPlayersLoading(false))
  }, [fixtureId, upcoming])

  const fixture = upcoming.find(f => String(f.id) === fixtureId)

  function handleFixtureChange(id) {
    setFixtureId(id)
    setHomeScore('')
    setAwayScore('')
    setHomeScorers([])
    setAwayScorers([])
  }

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

  // Called when admin clicks "Add" next to the new-player text input.
  // Creates the player immediately (or reuses existing), updates the local
  // dropdown, and switches the slot to the confirmed player.
  async function handleConfirmNewPlayer(side, index) {
    if (!fixture || confirming) return
    const scorer = (side === 'home' ? homeScorers : awayScorers)[index]
    const name   = scorer?.newName.trim()
    if (!name) return

    const teamId = side === 'home' ? fixture.home_team_id : fixture.away_team_id
    setConfirming(`${side}:${index}`)
    setError('')

    try {
      // Reuse if already in the local list (case-insensitive)
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

      // Re-fetch the full list so every scorer slot sees the new player immediately
      const freshPlayers = await getPlayersByTeam(teamId)
      setPlayers(prev => ({ ...prev, [teamId]: freshPlayers }))

      // Switch this slot from "new player" mode to the confirmed player
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
    if (!fixtureId || homeScore === '' || awayScore === '') {
      setError('Please select a fixture and enter scores.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addResult(Number(fixtureId), Number(homeScore), Number(awayScore))

      const allScorers = [
        ...homeScorers.map(s => ({ ...s, teamId: fixture.home_team_id })),
        ...awayScorers.map(s => ({ ...s, teamId: fixture.away_team_id })),
      ]

      // Per-submit cache to prevent duplicate creates if admin left a slot in
      // "new player" mode without clicking "Add" first.
      const sessionCreated = {}

      for (const scorer of allScorers) {
        if (scorer.value === UNKNOWN) continue

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

        await addGoal(Number(fixtureId), playerId, Number(scorer.teamId))
      }

      onSuccess()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const noFixtures      = !loading && upcoming.length === 0 && !error
  const scoresReady     = homeScore !== '' && awayScore !== ''
  const homeTeamPlayers = fixture ? (players[fixture.home_team_id] ?? []) : []
  const awayTeamPlayers = fixture ? (players[fixture.away_team_id] ?? []) : []

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalScrollable}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add Result</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className={styles.modalBodyScroll}>

            {loading ? (
              <p className={styles.modalLoading}>Loading fixtures…</p>
            ) : noFixtures ? (
              <p className={styles.modalLoading}>No upcoming fixtures to add results for.</p>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Fixture</label>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={fixtureId}
                      onChange={e => handleFixtureChange(e.target.value)}
                    >
                      {upcoming.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.home_team_name} vs {f.away_team_name} · {f.date}
                        </option>
                      ))}
                    </select>
                  </div>
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
                        <span className={styles.scorerGroupLabel}>
                          {fixture?.home_team_name}
                        </span>
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
                        <span className={styles.scorerGroupLabel}>
                          {fixture?.away_team_name}
                        </span>
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
              <button type="button" className={styles.btnGhost} onClick={onClose}>
                {noFixtures ? 'Close' : 'Cancel'}
              </button>
              {!noFixtures && (
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={saving || loading}
                >
                  {saving ? 'Saving…' : 'Save Result'}
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
