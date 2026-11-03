import { useMemo, useSyncExternalStore } from 'react'

const KEY = 'pitchsync'
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!session) return null
    const leagueId = session.leagueId ?? session.LeagueId ?? null
    const leagueName = session.leagueName ?? session.LeagueName ?? ''
    return { ...session, leagueId, leagueName, LeagueId: leagueId, LeagueName: leagueName }
  } catch { return null }
}
export function saveSession(session) {
  const leagueId = session.leagueId ?? session.LeagueId ?? null
  const leagueName = session.leagueName ?? session.LeagueName ?? ''
  localStorage.setItem(KEY, JSON.stringify({ ...session, leagueId, leagueName, LeagueId: leagueId, LeagueName: leagueName }))
  window.dispatchEvent(new Event('pitchsync-session'))
}
export function clearSession() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('pitchsync-session'))
}
export function setActiveLeague(league) {
  const session = getSession()
  saveSession({ ...session, leagueId: league?.id ?? null, leagueName: league?.name ?? '', leagueLogo: league?.logo_key ?? null })
}
function subscribe(callback) {
  window.addEventListener('pitchsync-session', callback)
  window.addEventListener('storage', callback)
  return () => { window.removeEventListener('pitchsync-session', callback); window.removeEventListener('storage', callback) }
}
export function useSession() {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null)
  return useMemo(() => getSession(), [raw])
}
