import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Standings from './pages/Standings'
import Schedule from './pages/Schedule'
import Players from './pages/Players'
import LeagueRules from './pages/LeagueRules'
import Playoffs from './pages/Playoffs'
import PlayoffSettings from './pages/PlayoffSettings'
import Announcements from './pages/Announcements'
import Settings from './pages/Settings'
import SettingsTeams from './pages/SettingsTeams'
import SettingsPlayers from './pages/SettingsPlayers'

const router = createBrowserRouter(createRoutesFromElements(
      <>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
        <Route path="/standings" element={<Standings />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/players" element={<Players />} />
        <Route path="/playoffs" element={<Playoffs />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/rules" element={<LeagueRules />} />
        <Route path="/settings/playoffs" element={<PlayoffSettings />} />
        <Route path="/settings/announcements" element={<Announcements manage />} />
        <Route path="/settings/teams" element={<SettingsTeams />} />
        <Route path="/settings/players" element={<SettingsPlayers />} />
        </Route>
      </>
))

export default function App() {
  return <RouterProvider router={router} />
}
