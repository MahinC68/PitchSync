import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function useModalMotion(onClose, origin) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  const modalRef = useRef(null)
  useLayoutEffect(() => {
    const modal = modalRef.current
    if (!modal || !origin) return
    modal.style.setProperty('--dialog-x', `${origin.x - window.innerWidth / 2}px`)
    modal.style.setProperty('--dialog-y', `${origin.y - window.innerHeight / 2}px`)
    modal.style.setProperty('--dialog-scale', String(Math.max(.15, Math.min(.35, origin.width / modal.offsetWidth))))
  }, [origin])
  useEffect(() => () => clearTimeout(timer.current), [])
  function close() {
    if (timer.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    timer.current = setTimeout(onClose, 220)
  }
  return { closing, close, modalRef }
}
