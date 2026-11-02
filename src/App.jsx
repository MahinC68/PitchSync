import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Standings from './pages/Standings'
import Schedule from './pages/Schedule'
import Players from './pages/Players'
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
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/teams" element={<SettingsTeams />} />
        <Route path="/settings/players" element={<SettingsPlayers />} />
        </Route>
      </>
))

export default function App() {
  return <RouterProvider router={router} />
}
