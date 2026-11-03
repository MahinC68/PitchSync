import { useEffect, useRef, useState } from 'react'
import { saveAnnouncement } from '../api'
import useModalMotion from './useModalMotion'
import styles from './Modal.module.css'
import pageStyles from '../pages/Announcements.module.css'

export default function AnnouncementModal({config,onClose,onSaved}){
  const [title,setTitle]=useState(config.item?.title||''),[message,setMessage]=useState(config.item?.message||'')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const input=useRef(null),{closing,close,modalRef}=useModalMotion(onClose,config.origin)
  useEffect(()=>{input.current?.focus({preventScroll:true});return()=>{if(config.trigger?.isConnected)config.trigger.focus({preventScroll:true})}},[config])
  async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{await saveAnnouncement(config.item?.id,{title:title.trim(),message:message.trim()});onSaved();onClose()}catch(error){setError(error.message);setBusy(false)}}
  function keys(event){if(event.key==='Escape'&&!busy){event.preventDefault();close()}if(event.key==='Tab'){const controls=[...modalRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')];const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}
  return <div className={styles.overlay} data-closing={closing||undefined} onClick={()=>!busy&&close()} onKeyDown={keys}><div ref={modalRef} className={`${styles.modal} ${pageStyles.modal}`} role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title" onClick={event=>event.stopPropagation()}>
    <div className={styles.modalHead}><h2 id="announcement-modal-title" className={styles.modalTitle}>{config.item?'Edit announcement':'New announcement'}</h2><button className={styles.closeBtn} aria-label="Close announcement dialog" disabled={busy} onClick={close}>×</button></div>
    <form className={styles.modalBody} onSubmit={save}>
      <label className={styles.field}><span className={styles.fieldLabel}>Title</span><input ref={input} className={styles.input} aria-label="Announcement title" maxLength={120} required disabled={busy} value={title} onChange={event=>setTitle(event.target.value)}/></label>
      <label className={styles.field}><span className={styles.fieldLabel}>Message</span><textarea className={`${styles.input} ${pageStyles.textarea}`} aria-label="Announcement message" maxLength={5000} rows={7} required disabled={busy} value={message} onChange={event=>setMessage(event.target.value)}/></label>
      <p className={pageStyles.hint}>{config.item?'The original publication date is kept when editing.':'Published immediately to this league’s dashboard with today’s publication date.'}</p>
      {error&&<p role="alert" className={styles.modalError}>{error}</p>}
      <div className={styles.modalActions}><button type="button" className={styles.btnGhost} disabled={busy} onClick={close}>Cancel</button><button className={styles.btnPrimary} disabled={busy||!title.trim()||!message.trim()}>{busy?'Saving…':config.item?'Save announcement':'Publish announcement'}</button></div>
    </form>
  </div></div>
}
