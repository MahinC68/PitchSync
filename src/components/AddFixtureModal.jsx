import { SelectPicker, DatePicker, TimePicker } from './FilterPicker'
import useModalMotion from './useModalMotion'
import { useState, useEffect } from 'react'
import styles from './Modal.module.css'
import { getTeams, addFixture } from '../api'

export default function AddFixtureModal({ onClose, onSuccess, origin }) {
  const { closing, close, modalRef } = useModalMotion(onClose, origin)
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
    if (!date || !time) { setError('Please select a date and time.'); return }
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
    <div className={styles.overlay} data-closing={closing || undefined} onClick={close}>
      <div ref={modalRef} className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add Fixture</h2>
          <button className={styles.closeBtn} onClick={close} aria-label="Close">×</button>
        </div>

        <form className={styles.modalBody} onSubmit={handleSubmit}>
          {loading ? (
            <p className={styles.modalLoading}>Loading teams…</p>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Home Team</label>
                <div className={styles.selectWrap}>
                  <SelectPicker label="Home Team" value={homeId} onChange={setHomeId} options={teams.map(t => ({ value: t.id, label: t.name }))} />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Away Team</label>
                <div className={styles.selectWrap}>
                  <SelectPicker label="Away Team" value={awayId} onChange={setAwayId} options={teams.map(t => ({ value: t.id, label: t.name }))} />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Date</label>
                  <DatePicker label="Date" value={date} onChange={setDate} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Time</label>
                  <TimePicker label="Time" value={time} onChange={setTime} />
                </div>
              </div>
            </>
          )}

          {error && <p className={styles.modalError}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnGhost} onClick={close}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving || loading}>
              {saving ? 'Adding…' : '+ Add Fixture'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
