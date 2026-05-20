import { useState, useEffect } from 'react'
import styles from './Modal.module.css'
import { getTeams, addFixture } from '../api'

export default function AddFixtureModal({ onClose, onSuccess }) {
  const [teams,   setTeams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [homeId,  setHomeId]  = useState('')
  const [awayId,  setAwayId]  = useState('')
  const [date,    setDate]    = useState('')
  const [time,    setTime]    = useState('')
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    getTeams()
      .then(data => {
        setTeams(data)
        if (data.length > 0) setHomeId(String(data[0].id))
        if (data.length > 1) setAwayId(String(data[1].id))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (homeId === awayId) {
      setError('Home and away teams must be different.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addFixture({
        home_team_id: Number(homeId),
        away_team_id: Number(awayId),
        date,
        time,
      })
      onSuccess()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add Fixture</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className={styles.modalBody} onSubmit={handleSubmit}>
          {loading ? (
            <p className={styles.modalLoading}>Loading teams…</p>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Home Team</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={homeId}
                    onChange={e => setHomeId(e.target.value)}
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Away Team</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={awayId}
                    onChange={e => setAwayId(e.target.value)}
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Date</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Time</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className={styles.modalError}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving || loading}>
              {saving ? 'Adding…' : '+ Add Fixture'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
