import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import styles from './SettingsTeams.module.css'
import { getTeams, addTeam as apiAddTeam, renameTeam as apiRenameTeam, deleteTeam as apiDeleteTeam } from '../api'

export default function SettingsTeams() {
  const [teams,     setTeams]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [newName,   setNewName]   = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function addTeam() {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      const team = await apiAddTeam(trimmed)
      setTeams(prev => [...prev, { id: team.id, name: team.name }])
      setNewName('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(team) {
    setEditingId(team.id)
    setEditValue(team.name)
    setConfirmId(null)
  }

  async function saveEdit(id) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    try {
      const team = await apiRenameTeam(id, trimmed)
      setTeams(prev => prev.map(t => t.id === id ? { id: team.id, name: team.name } : t))
      setEditingId(null)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmDelete(id) {
    try {
      await apiDeleteTeam(id)
      setTeams(prev => prev.filter(t => t.id !== id))
      setConfirmId(null)
      setError('')
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
          <h1 className={styles.pageTitle}>Manage Teams</h1>
        </div>

        {error && (
          <p style={{ color: '#c06060', fontSize: '0.8125rem', marginBottom: '16px' }}>{error}</p>
        )}

        {loading && (
          <p style={{ color: '#888', padding: '32px 0', fontSize: '0.8125rem' }}>Loading…</p>
        )}

        {!loading && (
          <>
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
                      <button className={styles.btnDelete} onClick={() => confirmDelete(t.id)}>Delete</button>
                      <button className={styles.btnGhost} onClick={() => setConfirmId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className={styles.btnDeleteOutline} onClick={() => setConfirmId(t.id)}>Delete</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </AppLayout>
  )
}
