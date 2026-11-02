import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './StatsMenu.module.css'

export default function StatsMenu({ label, options, selected, onToggle, multiple = false, unavailable = [] }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  useLayoutEffect(() => {
    if (!open) return
    panel.current.showPopover?.()
    function position() {
      const rect = trigger.current.getBoundingClientRect()
      const popup = panel.current
      popup.style.left = `${Math.max(12, Math.min(rect.right - popup.offsetWidth, innerWidth - popup.offsetWidth - 12))}px`
      popup.style.top = `${Math.max(12, Math.min(rect.bottom + 8, innerHeight - popup.offsetHeight - 12))}px`
    }
    position()
    panel.current.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    function escape(event) { if (event.key === 'Escape') { event.preventDefault(); close() } }
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('keydown', escape) }
  }, [open])
  function keys(event) {
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
    const index = buttons.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    if (next !== undefined) { event.preventDefault(); buttons[next]?.focus() }
  }
  return <div ref={root} className={styles.root}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>•••</button>
    {open && <div ref={panel} popover="manual" role="dialog" aria-label={label} className={styles.panel} onKeyDown={keys}>
      <div className={styles.heading}><strong>{multiple ? 'Your quick stats' : 'Choose a league stat'}</strong><button type="button" aria-label="Close stat options" onClick={close}>×</button></div>
      <p className={styles.hint} aria-live="polite">{multiple ? `${selected.length} of 4 selected · keep at least 1` : 'League Leader always stays. Each card shows a different stat.'}</p>
      <div role={multiple ? 'group' : 'radiogroup'} aria-label="Available stats" className={styles.options}>
        {options.map(option => {
          const checked = selected.includes(option.id)
          const disabled = unavailable.includes(option.id) || (multiple && (checked ? selected.length === 1 : selected.length === 4))
          return <button key={option.id} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={checked} disabled={disabled} className={styles.option} onClick={() => onToggle(option.id)}>
            <span className={styles.check} aria-hidden="true">{checked ? '✓' : ''}</span><span><strong>{option.label}</strong><small>{option.description}</small></span>
          </button>
        })}
      </div>
    </div>}
  </div>
}
