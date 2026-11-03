import { Navigate } from 'react-router-dom'

// Keep existing bookmarks/settings navigation while sharing one roster CRUD interface.
export default function SettingsPlayers(){return <Navigate to="/settings/teams?view=roster" replace />}
