import { useEffect, useState } from 'react'
import { SelectPicker } from './FilterPicker'
import useModalMotion from './useModalMotion'
import { getLeagueRules, markForfeit, clearForfeit } from '../api'
import styles from './Modal.module.css'

export default function ForfeitModal({ fixture, origin, onClose, onSuccess }) {
  const { closing, close, modalRef } = useModalMotion(onClose, origin)
  const [rules, setRules] = useState(null)
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const recorded = fixture.forfeit_team_id != null
  useEffect(() => { let live = true; getLeagueRules().then(rules => { if (live) setRules(rules) }).catch(error => { if (live) setError(error.message) }); return () => { live = false } }, [])
  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true)
    try { if (recorded) await clearForfeit(fixture.id); else await markForfeit(fixture.id, Number(teamId)); onSuccess() }
    catch (error) { setError(error.message); setSaving(false) }
  }
  const loser = recorded ? fixture.forfeit_team_id : Number(teamId)
  const score = recorded ? `${fixture.home_score} – ${fixture.away_score}` : rules && teamId ? `${loser === fixture.home_team_id ? rules.forfeit_loser_score : rules.forfeit_winner_score} – ${loser === fixture.away_team_id ? rules.forfeit_loser_score : rules.forfeit_winner_score}` : '—'
  const penalty = recorded ? fixture.forfeit_penalty : rules?.forfeit_penalty
  return <div className={styles.overlay} data-closing={closing || undefined} onClick={() => !saving && close()} onKeyDown={event => { if (event.key === 'Escape' && !saving) close() }}>
    <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="forfeit-title" onClick={event => event.stopPropagation()}>
      <div className={styles.modalHead}><h2 id="forfeit-title" className={styles.modalTitle}>{recorded ? 'Recorded forfeit' : 'Record forfeit'}</h2><button className={styles.closeBtn} disabled={saving} aria-label="Close forfeit dialog" onClick={close}>×</button></div>
      <form className={styles.modalBody} onSubmit={submit}>
        <p className={styles.forfeitText}>{fixture.home_team_name} vs {fixture.away_team_name}</p>
        {!recorded && <div className={styles.field}><label className={styles.fieldLabel}>Forfeiting team</label><SelectPicker label="Forfeiting team" value={teamId} disabled={saving || !rules} options={[{ value: '', label: 'Choose forfeiting team' }, { value: fixture.home_team_id, label: fixture.home_team_name }, { value: fixture.away_team_id, label: fixture.away_team_name }]} onChange={setTeamId} /></div>}
        {recorded && <p className={styles.forfeitText}>{fixture.forfeit_team_id === fixture.home_team_id ? fixture.home_team_name : fixture.away_team_name} forfeited this match.</p>}
        <div className={styles.forfeitPreview}><span>{recorded ? 'Recorded award' : 'Awarded score'}</span><strong>{score}</strong></div>
        {rules && <p className={styles.forfeitText}>{penalty ? `${penalty} additional points deducted from the forfeiting team, once.` : 'No additional forfeit deduction.'} No player goals are awarded.</p>}
        <p className={styles.forfeitText}>{recorded ? fixture.pre_forfeit_status === 'completed' ? `Clearing this forfeit restores the original ${fixture.recorded_home_score}–${fixture.recorded_away_score} result and original scorer records.` : 'Clearing this forfeit returns the fixture to Upcoming Fixtures.' : 'The awarded score and deduction are saved with this fixture. Any original score and scorer records are preserved.'}</p>
        {error && <p className={styles.modalError} role="alert">{error}</p>}
        <div className={styles.modalActions}><button type="button" className={styles.btnGhost} disabled={saving} onClick={close}>Cancel</button><button type="submit" className={styles.btnPrimary} disabled={saving || (!recorded && (!teamId || !rules))}>{saving ? 'Saving…' : recorded ? 'Clear forfeit' : 'Record forfeit'}</button></div>
      </form>
    </div>
  </div>
}
