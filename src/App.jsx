import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Standings from './pages/Standings'
import Schedule from './pages/Schedule'
import Players from './pages/Players'
import Settings from './pages/Settings'
import SettingsTeams from './pages/SettingsTeams'
import SettingsPlayers from './pages/SettingsPlayers'
import ForgotPassword from './pages/ForgotPassword'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/players" element={<Players />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/teams" element={<SettingsTeams />} />
        <Route path="/settings/players" element={<SettingsPlayers />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </BrowserRouter>
  )
}
