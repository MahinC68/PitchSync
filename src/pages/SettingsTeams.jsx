import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import styles from './SettingsTeams.module.css'

const INITIAL_TEAMS = [
  { id: 1, name: 'Falcons FC' },
  { id: 2, name: 'City Rovers' },
  { id: 3, name: 'Kings FC' },
  { id: 4, name: 'United SC' },
  { id: 5, name: 'Strikers' },
  { id: 6, name: 'City FC' },
]

let _nextId = 7

export default function SettingsTeams() {
  const [teams, setTeams] = useState(INITIAL_TEAMS)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  function addTeam() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setTeams(prev => [...prev, { id: _nextId++, name: trimmed }])
    setNewName('')
  }

  function startEdit(team) {
    setEditingId(team.id)
    setEditValue(team.name)
    setConfirmId(null)
  }

  function saveEdit(id) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name: trimmed } : t))
    setEditingId(null)
  }

  function deleteTeam(id) {
    setTeams(prev => prev.filter(t => t.id !== id))
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
          <h1 className={styles.pageTitle}>Manage Teams</h1>
        </div>

        {/* Add Team */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Add Team
        </div>
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Team name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTeam()}
          />
          <button className={styles.btnPrimary} onClick={addTeam}>+ Add Team</button>
        </div>

        {/* Rename Teams */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Rename Teams
        </div>
        <div className={styles.list}>
          {teams.map(t => (
            <div key={t.id} className={styles.row}>
              {editingId === t.id ? (
                <div className={styles.editRow}>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.rowInput}`}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(t.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <div className={styles.rowActions}>
                    <button className={styles.btnSave} onClick={() => saveEdit(t.id)}>Save</button>
                    <button className={styles.btnGhost} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.teamName}>{t.name}</span>
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit(t)}
                    aria-label={`Rename ${t.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M8.5 1.5L10.5 3.5L3.5 10.5H1.5V8.5L8.5 1.5Z"
                        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Delete Team */}
        <div className={styles.sectionLabel}>
          <span className={styles.labelLine} />
          Delete Team
        </div>
        <div className={styles.list}>
          {teams.map(t => (
            <div key={t.id} className={styles.row}>
              <span className={styles.teamName}>{t.name}</span>
              {confirmId === t.id ? (
                <div className={styles.rowActions}>
                  <span className={styles.confirmText}>Confirm delete?</span>
                  <button className={styles.btnDelete} onClick={() => deleteTeam(t.id)}>Delete</button>
                  <button className={styles.btnGhost} onClick={() => setConfirmId(null)}>Cancel</button>
                </div>
              ) : (
                <button className={styles.btnDeleteOutline} onClick={() => setConfirmId(t.id)}>Delete</button>
              )}
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
