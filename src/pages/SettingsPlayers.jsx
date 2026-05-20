import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import styles from './SettingsPlayers.module.css'
import { getTopScorers, getTeams, addPlayer as apiAddPlayer, deletePlayer as apiDeletePlayer } from '../api'

export default function SettingsPlayers() {
  const [players,    setPlayers]    = useState([])
  const [teams,      setTeams]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [newName,    setNewName]    = useState('')
  const [newTeamId,  setNewTeamId]  = useState('')
  const [adding,     setAdding]     = useState(false)
  const [confirmId,  setConfirmId]  = useState(null)

  const leagueId = JSON.parse(localStorage.getItem('pitchsync') || 'null')?.LeagueId

  useEffect(() => {
    if (!leagueId) {
      setError('No league found.')
      setLoading(false)
      return
    }
    Promise.all([getTopScorers(leagueId), getTeams()])
      .then(([scorers, teamList]) => {
        setPlayers(scorers)
        setTeams(teamList)
        if (teamList.length > 0) setNewTeamId(String(teamList[0].id))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [leagueId])

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed || !newTeamId) return
    setAdding(true)
    setError('')
    try {
      await apiAddPlayer(trimmed, Number(newTeamId))
      const scorers = await getTopScorers(leagueId)
      setPlayers(scorers)
      setNewName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await apiDeletePlayer(id)
      setPlayers(prev => prev.filter(p => p.playerId !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <Link to="/settings" className={styles.backLink}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M10 7H4M7 4L4 7l3 3"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
            </svg>
            Back to Settings
          </Link>
          <h1 className={styles.pageTitle}>Manage Players</h1>
        </div>

        {/* Add Player */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Add Player
        </div>
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Player name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={newTeamId}
              onChange={e => setNewTeamId(e.target.value)}
              disabled={loading || teams.length === 0}
            >
              {teams.map(t => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
          </div>
          <button
            className={styles.btnPrimary}
            onClick={handleAdd}
            disabled={adding || loading || !newName.trim() || !newTeamId}
          >
            {adding ? '…' : '+ Add Player'}
          </button>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        {/* Delete Player */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Delete Player
        </div>

        {loading ? (
          <p className={styles.emptyText}>Loading players…</p>
        ) : players.length === 0 ? (
          <p className={styles.emptyText}>No players yet.</p>
        ) : (
          <div className={styles.list}>
            {players.map(p => (
              <div key={p.playerId} className={styles.row}>
                <div className={styles.playerInfo}>
                  <span className={styles.playerName}>{p.playerName}</span>
                  <span className={styles.playerTeam}>{p.teamName}</span>
                </div>
                {confirmId === p.playerId ? (
                  <div className={styles.rowActions}>
                    <span className={styles.confirmText}>Confirm delete?</span>
                    <button className={styles.btnDelete} onClick={() => handleDelete(p.playerId)}>Delete</button>
                    <button className={styles.btnGhost} onClick={() => setConfirmId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className={styles.btnDeleteOutline} onClick={() => setConfirmId(p.playerId)}>Delete</button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
