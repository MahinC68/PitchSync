import { useEffect, useRef, useState } from 'react'
import useModalMotion from './useModalMotion'
import styles from './Modal.module.css'

export default function LeagueModal({ config, onClose, onSubmit }) {
  const [name, setName] = useState(config.league?.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { closing, close, modalRef } = useModalMotion(onClose, config.origin)
  const input = useRef(null)
  const title = config.league ? 'Rename league' : 'Create league'
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
    const previous = config.trigger
    return () => (previous?.isConnected ? previous : document.querySelector('button[aria-label="Switch league"]'))?.focus({ preventScroll: true })
  }, [config])
  async function submit(event) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true); setError('')
    try { await onSubmit(name.trim()); onClose() } catch (error) { setError(error.message); setSaving(false) }
  }
  function keys(event) {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); close() }
    if (event.key === 'Tab') {
      const controls = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  return <div className={styles.overlay} data-closing={closing || undefined} onClick={() => !saving && close()} onKeyDown={keys}>
    <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="league-modal-title" onClick={event => event.stopPropagation()}>
      <div className={styles.modalHead}><h2 id="league-modal-title" className={styles.modalTitle}>{title}</h2><button className={styles.closeBtn} aria-label="Close league dialog" disabled={saving} onClick={close}>×</button></div>
      <form className={styles.modalBody} onSubmit={submit}>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="league-name">League name</label><input ref={input} id="league-name" className={styles.input} maxLength={100} value={name} onChange={event => setName(event.target.value)} required disabled={saving} /></div>
        {!config.league && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>Your new league gets its own player access code and starts with no teams or fixtures.</p>}
        {error && <p className={styles.modalError} role="alert">{error}</p>}
        <div className={styles.modalActions}><button type="button" className={styles.btnGhost} disabled={saving} onClick={close}>Cancel</button><button type="submit" className={styles.btnPrimary} disabled={saving || !name.trim()}>{saving ? 'Saving…' : title}</button></div>
      </form>
    </div>
  </div>
}
