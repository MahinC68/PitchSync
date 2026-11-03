import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectPicker } from '../components/FilterPicker'
import { getLeagueRules, saveLeagueRules, getPointsAdjustments, savePointsAdjustment, deletePointsAdjustment, getTeams } from '../api'
import styles from './LeagueRules.module.css'

const TIE_LABELS = { goal_difference: 'Goal difference', goals_scored: 'Goals scored', total_wins: 'Total wins', head_to_head: 'Head-to-head record' }
function NumberField({ label, value, onChange, min, max }) {
  return <label className={styles.field}>{label}<input aria-label={label} type="number" step="1" min={min} max={max} required value={value} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} /></label>
}
export default function LeagueRules() {
  const [rules, setRules] = useState(null)
  const [teams, setTeams] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [editor, setEditor] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all([getLeagueRules(), getTeams(), getPointsAdjustments()]).then(([rules, teams, adjustments]) => {
      if (!live) return
      setRules(rules); setTeams(teams); setAdjustments(adjustments)
      setCustomDuration(![30, 45, 60, 90].includes(rules.match_duration))
    }).catch(error => { if (live) setError(error.message) })
    return () => { live = false }
  }, [])
  function field(key, value) { setNotice(''); setRules(current => ({ ...current, [key]: value })) }
  function move(index, direction) {
    const order = [...rules.tiebreakers]
    const next = index + direction
    ;[order[index], order[next]] = [order[next], order[index]]
    field('tiebreakers', order)
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try { setRules(await saveLeagueRules(rules)); setNotice('League rules saved. Standings now use these rules.') }
    catch (error) { setError(error.message) } finally { setSaving(false) }
  }
  async function saveAdjustment(event) {
    event.preventDefault(); setAdjusting(true); setError(''); setNotice('')
    try {
      await savePointsAdjustment(editor.id, { team_id: Number(editor.team_id), points: Number(editor.points), reason: editor.reason })
      setAdjustments(await getPointsAdjustments()); setEditor(null); setNotice('Points adjustment saved.')
    } catch (error) { setError(error.message) } finally { setAdjusting(false) }
  }
  async function removeAdjustment(id) {
    setAdjusting(true); setError('')
    try { await deletePointsAdjustment(id); setAdjustments(current => current.filter(item => item.id !== id)); setDeleteId(null); setNotice('Points adjustment removed.') }
    catch (error) { setError(error.message) } finally { setAdjusting(false) }
  }
  return <div className={styles.page}>
    <Link to="/settings" className={styles.back}>← Back to Settings</Link>
    <div className={styles.pageHead}><p className={styles.eyebrow}>League settings</p><h1>League Rules</h1></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!rules && !error && <p className={styles.hint}>Loading rules…</p>}
    {rules && <>
      <form onSubmit={save}>
        <fieldset disabled={saving} className={styles.ruleFields}>
          <section className={styles.section} aria-labelledby="points-title">
            <h2 id="points-title">Points System</h2><p className={styles.hint}>Applies to every completed result, including existing matches. Match scores stay unchanged.</p>
            <div className={styles.fields}>
              {[['win_points', 'Win points'], ['draw_points', 'Draw points'], ['loss_points', 'Loss points']].map(([key, label]) => <NumberField key={key} label={label} value={rules[key]} onChange={value => field(key, value)} min={-100} max={100} />)}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="tie-title">
            <h2 id="tie-title">Standings Tiebreakers</h2><p className={styles.hint}>Applied in this order after total points. Use the arrows to reorder.</p>
            <ol className={styles.order}>
              {rules.tiebreakers.map((id, index) => <li key={id}><span className={styles.priority}>{index + 1}</span><strong>{TIE_LABELS[id]}</strong><div className={styles.actions}><button type="button" aria-label={`Move ${TIE_LABELS[id]} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move ${TIE_LABELS[id]} down`} disabled={index === 3} onClick={() => move(index, 1)}>↓</button></div></li>)}
            </ol>
            <p className={styles.hint}>Head-to-head uses points, goal difference, then goals scored in matches between the tied teams. Smaller remaining ties are compared again. Teams still equal after all rules use their team ID for a stable order.</p>
          </section>
          <section className={styles.section} aria-labelledby="duration-title">
            <h2 id="duration-title">Match Duration</h2><p className={styles.hint}>Default match length for this league, in minutes.</p>
            <div className={styles.fields}><div className={styles.field}><span>Duration</span><SelectPicker label="Match duration" value={customDuration ? 'custom' : rules.match_duration} options={[30,45,60,90].map(value => ({ value, label: `${value} minutes` })).concat({ value: 'custom', label: 'Custom duration' })} onChange={value => { setCustomDuration(value === 'custom'); if (value !== 'custom') field('match_duration', Number(value)) }} /></div>
              {customDuration && <NumberField label="Custom minutes" min={1} max={300} value={rules.match_duration} onChange={value => field('match_duration', value)} />}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="forfeit-title">
            <h2 id="forfeit-title">Forfeit Rules</h2><p className={styles.hint}>Award the non-forfeiting team a win and optionally deduct points from the forfeiting team.</p>
            <div className={styles.fields}><NumberField label="Winner goals" min={1} max={99} value={rules.forfeit_winner_score} onChange={value => field('forfeit_winner_score', value)} /><NumberField label="Forfeiting team goals" min={0} max={98} value={rules.forfeit_loser_score} onChange={value => field('forfeit_loser_score', value)} /><NumberField label="Additional points deducted" min={0} max={100} value={rules.forfeit_penalty} onChange={value => field('forfeit_penalty', value)} /></div>
            <p className={styles.hint}>These defaults apply when a forfeit is recorded. Existing forfeits keep their awarded score and deduction. Awarded goals count in the team table, never toward a player's goal tally. Enter a positive deduction; it is applied once per forfeited match.</p>
          </section>
          <div className={styles.saveRow}><button type="submit" className={styles.primary}>{saving ? 'Saving…' : 'Save league rules'}</button><Link to="/standings" className={styles.back}>View standings →</Link></div>
        </fieldset>
      </form>
      <section className={styles.section} aria-labelledby="adjustments-title">
        <div className={styles.sectionHead}><h2 id="adjustments-title">Points Adjustments</h2><button type="button" className={styles.secondary} disabled={!teams.length || adjusting} onClick={() => { setEditor({ team_id: teams[0]?.id, points: '', reason: '' }); setDeleteId(null) }}>+ Add adjustment</button></div>
        <p className={styles.hint}>Bonuses and deductions are separate from results and automatic forfeit deductions. Record a reason for every change.</p>
        {!teams.length && <p className={styles.hint}>Add a team before creating an adjustment.</p>}
        {editor && <form aria-label={editor.id ? 'Edit points adjustment' : 'Add points adjustment'} className={styles.editor} onSubmit={saveAdjustment}>
          <div className={styles.fields}><div className={styles.field}><span>Team</span><SelectPicker label="Adjustment team" disabled={adjusting} value={editor.team_id} onChange={value => setEditor(current => ({ ...current, team_id: value }))} options={teams.map(team => ({ value: team.id, label: team.name }))} /></div><NumberField label="Points adjustment" min={-1000} max={1000} value={editor.points} onChange={value => setEditor(current => ({ ...current, points: value }))} /></div>
          <label className={styles.field}>Reason<input aria-label="Adjustment reason" maxLength={250} required value={editor.reason} onChange={event => setEditor(current => ({ ...current, reason: event.target.value }))} /></label>
          <div className={styles.actions}><button type="submit" className={styles.primary} disabled={adjusting || !Number(editor.points) || !editor.reason.trim()}>{adjusting ? 'Saving…' : 'Save adjustment'}</button><button type="button" className={styles.secondary} disabled={adjusting} onClick={() => setEditor(null)}>Cancel</button></div>
        </form>}
        <div className={styles.adjustments}>
          {!adjustments.length && <p className={styles.hint}>No manual points adjustments.</p>}
          {adjustments.map(item => <div className={styles.adjustment} key={item.id}><div><strong>{item.team_name}</strong><p>{item.reason}</p></div><span className={styles.points}>{item.points > 0 ? '+' : ''}{item.points}</span><div className={styles.actions}>{deleteId === item.id ? <><span className={styles.hint}>Remove?</span><button disabled={adjusting} className={styles.danger} onClick={() => removeAdjustment(item.id)}>Confirm remove</button><button className={styles.secondary} onClick={() => setDeleteId(null)}>Cancel</button></> : <><button className={styles.secondary} disabled={adjusting} onClick={() => { setEditor(item); setDeleteId(null) }}>Edit</button><button className={styles.danger} disabled={adjusting} onClick={() => setDeleteId(item.id)}>Delete</button></>}</div></div>)}
        </div>
      </section>
    </>}
  </div>
}
