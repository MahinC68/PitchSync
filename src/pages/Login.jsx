import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import styles from './Login.module.css'
import logo from '../../icons/PitchSync-new-gold.png'
import { login, verifyCode, saveSession } from '../api'

function SoccerPitch() {
  return (
    <svg
      className={styles.pitchSvg}
      viewBox="0 0 1200 680"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="#b4975a" strokeWidth="1.5">
        <rect x="2" y="2" width="1196" height="676" />
        <line x1="600" y1="2" x2="600" y2="678" />
        <circle cx="600" cy="340" r="91" />
        <circle cx="600" cy="340" r="4" fill="#b4975a" stroke="none" />

        <rect x="2" y="140" width="181" height="400" />
        <rect x="2" y="249" width="63" height="182" />
        <circle cx="127" cy="340" r="4" fill="#b4975a" stroke="none" />
        <path d="M 183,270 A 90,90 0 0,1 183,411" />

        <rect x="1017" y="140" width="181" height="400" />
        <rect x="1135" y="249" width="63" height="182" />
        <circle cx="1073" cy="340" r="4" fill="#b4975a" stroke="none" />
        <path d="M 1017,270 A 90,90 0 0,0 1017,411" />

        <path d="M 13,2   A 11,11 0 0,1 2,13" />
        <path d="M 1187,2 A 11,11 0 0,0 1198,13" />
        <path d="M 1198,667 A 11,11 0 0,0 1187,678" />
        <path d="M 2,667   A 11,11 0 0,1 13,678" />
      </g>
    </svg>
  )
}

export default function Login() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const initialTab      = searchParams.get('tab') === 'admin' ? 'admin' : 'player'

  const [tab,        setTab]        = useState(initialTab)
  const [accessCode, setAccessCode] = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  function switchTab(next) {
    setTab(next)
    setError('')
  }

  async function handlePlayerSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { leagueId, leagueName } = await verifyCode(accessCode)
      saveSession({ role: 'player', leagueId, leagueName })
      navigate('/standings')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token, league } = await login(email, password)
      saveSession({ role: 'admin', token, leagueId: league.id, leagueName: league.name })
      navigate('/standings')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>

      <nav className={styles.nav}>
        <Link to="/" className={styles.logoLink}>
          <img src={logo} alt="PitchSync" className={styles.logo} />
        </Link>
      </nav>

      <main className={styles.page}>
        <div className={styles.pitchClip}>
          <SoccerPitch />
        </div>

        <div className={styles.card}>

          <div className={styles.cardHeader}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowLine} />
              <span className={styles.eyebrowLabel}>PitchSync</span>
            </div>
            <h1 className={styles.cardTitle}>
              {tab === 'player' ? 'Join a League' : 'Welcome Back'}
            </h1>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'player' ? styles.tabActive : ''}`}
              onClick={() => switchTab('player')}
            >
              Player
            </button>
            <button
              className={`${styles.tab} ${tab === 'admin' ? styles.tabActive : ''}`}
              onClick={() => switchTab('admin')}
            >
              Admin
            </button>
          </div>

          {error && (
            <p style={{ color: '#c06060', fontSize: '0.75rem', margin: '-16px 0 8px', lineHeight: 1.4 }}>
              {error}
            </p>
          )}

          {tab === 'player' ? (
            <form className={styles.form} onSubmit={handlePlayerSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="accessCode">League Access Code</label>
                <input
                  id="accessCode"
                  type="text"
                  className={styles.input}
                  placeholder="Paste your code here"
                  autoComplete="off"
                  spellCheck="false"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                />
              </div>
              <button type="submit" className={styles.btnSubmit} disabled={loading}>
                {loading ? 'Verifying…' : 'Join League'}
              </button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleAdminSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
              </div>
              <button type="submit" className={styles.btnSubmit} disabled={loading}>
                {loading ? 'Logging in…' : 'Login'}
              </button>
            </form>
          )}

        </div>
      </main>

    </div>
  )
}
