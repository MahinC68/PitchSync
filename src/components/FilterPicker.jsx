import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './FilterPicker.module.css'

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function Picker({ label, display, children, disabled = false }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  useLayoutEffect(() => {
    if (!open || !panel.current) return
    const popup = panel.current
    popup.showPopover?.()
    function position() {
      const rect = trigger.current.getBoundingClientRect()
      const height = popup.offsetHeight
      popup.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - popup.offsetWidth - 12))}px`
      popup.style.top = `${Math.max(12, rect.bottom + height + 8 < innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`
    }
    position()
    popup.querySelector('[aria-pressed="true"], button')?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false) }
    function escape(event) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  function close() { setOpen(false); trigger.current?.focus() }
  return <div className={styles.root} ref={root} onClick={event => event.stopPropagation()} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} disabled={disabled} type="button" className={styles.trigger} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{display}<span aria-hidden="true">⌄</span></button>
    {open && <div ref={panel} popover="manual" className={styles.panel} role="dialog" aria-label={`${label} picker`}>{children(close)}</div>}
  </div>
}

export function TeamPicker({ value, options, onChange }) {
  return <SelectPicker label="Team" value={value} onChange={onChange} options={[{ value: '', label: 'All teams' }, ...options.map(team => ({ value: team, label: team }))]} />
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


export function SelectPicker({ label, value, options, onChange, disabled }) {
  const current = options.find(option => String(option.value) === String(value))
  function move(event) {
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    if (next !== undefined) { event.preventDefault(); buttons[next]?.focus() }
  }
  return <Picker label={label} display={current?.label || 'Select…'} disabled={disabled}>{close => <div className={styles.options} onKeyDown={move}>{options.map(option => <button type="button" key={option.value} className={`${styles.option} ${String(option.value) === String(value) ? styles.selected : ''}`} aria-pressed={String(option.value) === String(value)} onClick={() => { onChange(String(option.value)); close() }}>{option.label}<span aria-hidden="true">{String(option.value) === String(value) ? '✓' : ''}</span></button>)}</div>}</Picker>
}

export function TimePicker({ label, value, onChange }) {
  const [hours, setHours] = useState('15')
  const [minutes, setMinutes] = useState('00')
  useEffect(() => { if (value) { const [h, m] = value.split(':'); setHours(h); setMinutes(m) } }, [value])
  return <Picker label={label} display={value || 'Select time'}>{close => <>
    <p className={styles.timeLabel}>Match time · 24 hour</p>
    <div className={styles.timeFields}>
      <label>Hour<input aria-label="Hour" type="number" min="0" max="23" value={hours} onChange={e => setHours(e.target.value)} /></label>
      <span>:</span>
      <label>Minute<input aria-label="Minute" type="number" min="0" max="59" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
    </div>
    <div className={styles.footer}><button type="button" onClick={() => { onChange(''); close() }}>Clear</button><button type="button" disabled={hours === '' || minutes === '' || +hours < 0 || +hours > 23 || +minutes < 0 || +minutes > 59 || !Number.isInteger(+hours) || !Number.isInteger(+minutes)} onClick={() => { onChange(`${String(+hours).padStart(2, '0')}:${String(+minutes).padStart(2, '0')}`); close() }}>Set time</button></div>
  </>}</Picker>
}
