import { useEffect, useRef, useState } from 'react'
import styles from './FilterPicker.module.css'

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function Picker({ label, display, children }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    if (!open) return
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false) }
    function escape(event) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  function close() { setOpen(false); trigger.current?.focus() }
  return <div className={styles.root} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{display}<span aria-hidden="true">⌄</span></button>
    {open && <div className={styles.panel} role="dialog" aria-label={`${label} picker`}>{children(close)}</div>}
  </div>
}

export function TeamPicker({ value, options, onChange }) {
  return <Picker label="Team" display={value || 'All teams'}>{close => <div className={styles.options}>{['', ...options].map(team => <button type="button" className={`${styles.option} ${team === value ? styles.selected : ''}`} key={team} aria-pressed={team === value} onClick={() => { onChange(team); close() }}>{team || 'All teams'}<span aria-hidden="true">{team === value ? '✓' : ''}</span></button>)}</div>}</Picker>
}

export function DatePicker({ label, value, onChange }) {
  const [month, setMonth] = useState(() => value ? new Date(`${value}T12:00:00`) : new Date())
  useEffect(() => { if (value) setMonth(new Date(`${value}T12:00:00`)) }, [value])
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first); start.setDate(1 - first.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const today = dateKey(new Date())
  function shift(amount) { setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1)) }
  return <Picker label={label} display={value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}>{close => <>
    <div className={styles.calendarHead}>
      <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
      <strong aria-live="polite">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
      <button type="button" aria-label="Next month" onClick={() => shift(1)}>›</button>
    </div>
    <div className={styles.calendar}>
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
      {days.map(day => { const key = dateKey(day); return <button type="button" key={key} aria-label={day.toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})} aria-pressed={key === value} aria-current={key === today ? 'date' : undefined} className={`${styles.day} ${day.getMonth() !== month.getMonth() ? styles.outside : ''} ${key === value ? styles.selected : ''}`} onClick={() => { onChange(key); close() }}>{day.getDate()}</button> })}
    </div>
    <div className={styles.footer}><button type="button" onClick={() => { onChange(''); close() }}>Clear</button><button type="button" onClick={() => { onChange(today); close() }}>Today</button></div>
  </>}</Picker>
}
