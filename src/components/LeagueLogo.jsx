import TeamLogo from './TeamLogo'
import { leagueLogoUrl } from '../api'

// Share the existing secure-image rendering and initials fallback with teams.
export default function LeagueLogo({league,size='small'}) {
  return <TeamLogo name={league?.name||'League'} logoKey={league?.logo_key} size={size} imageUrl={leagueLogoUrl(league?.logo_key)}/>
}
