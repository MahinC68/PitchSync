import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import styles from './SettingsPlayers.module.css'

const TEAMS = ['Falcons FC', 'City Rovers', 'Kings FC', 'United SC', 'Strikers', 'City FC']

const INITIAL_PLAYERS = [
  { id: 1,  name: 'Marcus Webb',    team: 'Falcons FC' },
  { id: 2,  name: 'Jordan Cole',    team: 'City Rovers' },
  { id: 3,  name: 'Theo Nkosi',     team: 'Kings FC' },
  { id: 4,  name: 'Sam Okafor',     team: 'Falcons FC' },
  { id: 5,  name: 'Liam Brennan',   team: 'United SC' },
  { id: 6,  name: 'Dylan Marsh',    team: 'City Rovers' },
  { id: 7,  name: 'Aiden Torres',   team: 'Kings FC' },
  { id: 8,  name: 'Ryan Fowler',    team: 'Strikers' },
  { id: 9,  name: 'Callum Reid',    team: 'United SC' },
  { id: 10, name: 'Jamie Sinclair', team: 'City FC' },
]

let _nextId = 11

export default function SettingsPlayers() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS)
  const [newName, setNewName] = useState('')
  const [newTeam, setNewTeam] = useState(TEAMS[0])
  const [confirmId, setConfirmId] = useState(null)

  function addPlayer() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setPlayers(prev => [...prev, { id: _nextId++, name: trimmed, team: newTeam }])
    setNewName('')
  }

  function deletePlayer(id) {
    setPlayers(prev => prev.filter(p => p.id !== id))
    setConfirmId(null)
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
            onKeyDown={e => e.key === 'Enter' && addPlayer()}
          />
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
            >
              {TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button className={styles.btnPrimary} onClick={addPlayer}>+ Add Player</button>
        </div>

        {/* Delete Player */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Delete Player
        </div>
        <div className={styles.list}>
          {players.map(p => (
            <div key={p.id} className={styles.row}>
              <div className={styles.playerInfo}>
                <span className={styles.playerName}>{p.name}</span>
                <span className={styles.playerTeam}>{p.team}</span>
              </div>
              {confirmId === p.id ? (
                <div className={styles.rowActions}>
                  <span className={styles.confirmText}>Confirm delete?</span>
                  <button className={styles.btnDelete} onClick={() => deletePlayer(p.id)}>Delete</button>
                  <button className={styles.btnGhost} onClick={() => setConfirmId(null)}>Cancel</button>
                </div>
              ) : (
                <button className={styles.btnDeleteOutline} onClick={() => setConfirmId(p.id)}>Delete</button>
              )}
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
