import { getSession } from './session'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export { getSession, saveSession, clearSession } from './session'

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const session = getSession()
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(session?.role === 'admin' && session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(session?.role === 'admin' && session.leagueId ? { 'X-League-Id': String(session.leagueId) } : {}),
    ...options.headers,
  }

  const res  = await fetch(`${BASE}${path}`, { ...options, headers })
  const json = await res.json()
  const current = getSession()
  // Never let a response or a multi-step write continue into a different league.
  if (current?.token !== session?.token || current?.leagueId !== session?.leagueId || current?.role !== session?.role) {
    throw new Error('The active league or session changed. Please try again.')
  }

  if (!res.ok) {
    throw new Error(json.error || json.message || 'Request failed')
  }

  return json
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  // Returns { token, admin, league }
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function register(email, password, leagueName) {
  // Returns { token, admin, league }
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, leagueName }),
  })
}

export async function verifyCode(accessCode) {
  // Returns { leagueId, leagueName }
  return apiFetch('/api/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  })
}

export async function getLeague() {
  const body = await apiFetch('/api/auth/league')
  return body.data
}

export async function forgotPassword(email) {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getStandings(leagueId) {
  const body = await apiFetch(`/api/standings/${leagueId}`)
  return body.data
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export async function getFixtures(leagueId) {
  const body = await apiFetch(`/api/fixtures/${leagueId}`)
  return body.data  // { upcoming: [...], past: [...] }
}

export async function addFixture(data) {
  const body = await apiFetch('/api/fixtures', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return body.data
}

export async function deleteFixture(id) {
  return apiFetch(`/api/fixtures/${id}`, { method: 'DELETE' })
}

export async function addResult(fixtureId, homeScore, awayScore, scorers) {
  const body = await apiFetch(`/api/fixtures/${fixtureId}/result`, {
    method: 'PUT',
    body: JSON.stringify({ home_score: homeScore, away_score: awayScore, ...(scorers === undefined ? {} : { scorers }) }),
  })
  return body.data
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function getTopScorers(leagueId) {
  const body = await apiFetch(`/api/players/${leagueId}/top-scorers`)
  return body.data
}

export async function getPlayersByTeam(teamId) {
  const body = await apiFetch(`/api/players/team/${teamId}`)
  return body.data
}

export async function addPlayer(name, teamId) {
  const body = await apiFetch('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name, team_id: teamId }),
  })
  return body.data
}

export async function deletePlayer(id) {
  return apiFetch(`/api/players/${id}`, { method: 'DELETE' })
}

export async function addGoal(matchId, playerId, teamId) {
  const body = await apiFetch('/api/goals', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId, player_id: playerId, team_id: teamId }),
  })
  return body.data
}

export async function getGoalsByMatch(matchId) {
  const body = await apiFetch(`/api/goals/match/${matchId}`)
  return body.data
}

export async function deleteGoalsByMatch(matchId) {
  return apiFetch(`/api/goals/match/${matchId}`, { method: 'DELETE' })
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function getTeams() {
  const body = await apiFetch('/api/teams')
  return body.data
}

export async function addTeam(name) {
  const body = await apiFetch('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return body.data
}

export async function renameTeam(id, name) {
  const body = await apiFetch(`/api/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
  return body.data
}

export async function deleteTeam(id) {
  return apiFetch(`/api/teams/${id}`, { method: 'DELETE' })
}

// Account-level league management. Ownership is verified by the API.
export async function getLeagues() { return (await apiFetch('/api/leagues')).data }
export async function getOwnedLeague(id) { return (await apiFetch(`/api/leagues/${id}`)).data }
export async function createLeague(name) {
  return (await apiFetch('/api/leagues', { method: 'POST', body: JSON.stringify({ name }) })).data
}
export async function renameLeague(id, name) {
  return (await apiFetch(`/api/leagues/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })).data
}

export async function getLeagueRules() { return (await apiFetch('/api/rules')).data }
export async function saveLeagueRules(rules) { return (await apiFetch('/api/rules', { method: 'PUT', body: JSON.stringify(rules) })).data }
export async function getPointsAdjustments() { return (await apiFetch('/api/rules/adjustments')).data }
export async function savePointsAdjustment(id, data) {
  return (await apiFetch(`/api/rules/adjustments${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) })).data
}
export async function deletePointsAdjustment(id) { return apiFetch(`/api/rules/adjustments/${id}`, { method: 'DELETE' }) }
export async function markForfeit(id, teamId) {
  return (await apiFetch(`/api/fixtures/${id}/forfeit`, { method: 'PUT', body: JSON.stringify({ forfeiting_team_id: teamId }) })).data
}
export async function clearForfeit(id) { return (await apiFetch(`/api/fixtures/${id}/forfeit`, { method: 'DELETE' })).data }

export async function renamePlayer(id, name) { return (await apiFetch(`/api/players/${id}`, { method:'PUT', body:JSON.stringify({name}) })).data }
export async function getRosterSettings() { return (await apiFetch('/api/teams/roster-settings')).data }
export async function saveRosterSettings(limit) { return (await apiFetch('/api/teams/roster-settings', {method:'PUT',body:JSON.stringify({max_roster_size:limit})})).data }
export async function uploadTeamLogo(id, file) { const body=new FormData();body.append('logo',file);return (await apiFetch(`/api/teams/${id}/logo`,{method:'PUT',body})).data }
export async function removeTeamLogo(id) { return (await apiFetch(`/api/teams/${id}/logo`,{method:'DELETE'})).data }
export function teamLogoUrl(key) { return /^[a-f0-9]{32}\.webp$/.test(key || '') ? `${BASE}/api/team-logos/${key}` : null }
