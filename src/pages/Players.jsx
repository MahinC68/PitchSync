import { useState, useEffect } from 'react'
import styles from './Players.module.css'
import { getTopScorers } from '../api'

export default function Players() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem('pitchsync'))
    const leagueId = auth?.LeagueId
    console.log('leagueId:', leagueId)

    if (!leagueId) {
      setError('No league found. Please log in.')
      setLoading(false)
      return
    }
    getTopScorers(leagueId)
      .then(setPlayers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>Player rankings</p>
            <h1 className={styles.pageTitle}>Leaderboard</h1>
          </div>
        </div>

        {loading && (
          <p style={{ color: '#888', padding: '32px 0', fontSize: '0.8125rem' }}>Loading…</p>
        )}
        {!loading && error && (
          <p style={{ color: '#c06060', padding: '32px 0', fontSize: '0.8125rem' }}>{error}</p>
        )}

        {!loading && !error && (
          <div className={styles.tableWrap}>

            <div className={`${styles.row} ${styles.header}`}>
              <span className={styles.cRank}>Rank</span>
              <span className={styles.cPlayer}>Player</span>
              <span className={styles.cTeam}>Team</span>
              <span className={styles.cGoals}>Goals</span>
            </div>

            {players.map(p => (
              <div
                key={p.playerId}
                className={`${styles.row} ${p.rank === 1 ? styles.rowFirst : ''}`}
              >
                <span className={`${styles.cRank} ${p.rank <= 3 ? styles.rankGold : styles.rankDim}`}>
                  {p.rank}
                </span>
                <span className={styles.cPlayer}>{p.playerName}</span>
                <span className={styles.cTeam}>{p.teamName}</span>
                <span className={`${styles.cGoals} ${p.rank === 1 ? styles.goalsFirst : ''}`}>
                  {p.goals}
                </span>
              </div>
            ))}

          </div>
        )}

      </div>
    </>
  )
}
