import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import logo from '../../icons/PitchSync-new-gold.png'

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
        {/* arc origin is penalty box edge at x=183; intersects at y=270 and y=411 */}
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

// id must be unique per instance — both sides share the same component
function DotGrid({ id }) {
  return (
    <svg width="110" height="360" viewBox="0 0 110 360" fill="none" aria-hidden="true">
      <defs>
        <pattern id={id} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.5" fill="#b4975a" fillOpacity="0.45" />
        </pattern>
      </defs>
      <rect width="110" height="360" fill={`url(#${id})`} />
    </svg>
  )
}

const TEAMS = [
  { pos: 1, name: 'Falcons FC',   mp: 12, w: 9, d: 2, l: 1, pts: 29, form: ['W','W','W'] },
  { pos: 2, name: 'City Rovers',  mp: 12, w: 8, d: 1, l: 3, pts: 25, form: ['W','D','W'] },
  { pos: 3, name: 'United SC',    mp: 12, w: 6, d: 3, l: 3, pts: 21, form: ['L','W','W'] },
  { pos: 4, name: 'Kings FC',     mp: 12, w: 5, d: 2, l: 5, pts: 17, form: ['L','D','L'] },
  { pos: 5, name: 'Strikers',     mp: 12, w: 3, d: 1, l: 8, pts: 10, form: ['L','L','W'] },
]

function StandingsPreview() {
  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewCard}>

        <div className={styles.previewHead}>
          <span className={styles.previewTitle}>League Standings</span>
          <span className={styles.previewSeason}>Season 2025</span>
        </div>

        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span className={styles.cPos}>#</span>
          <span className={styles.cTeam}>Team</span>
          <span className={styles.cNum}>MP</span>
          <span className={styles.cNum}>W</span>
          <span className={styles.cNum}>L</span>
          <span className={styles.cPts}>Pts</span>
          <span className={styles.cForm}>Form</span>
        </div>

        {TEAMS.map((t) => (
          <div
            key={t.pos}
            className={`${styles.tableRow} ${t.pos === 1 ? styles.tableRowTop : ''}`}
          >
            <span className={t.pos === 1 ? `${styles.cPos} ${styles.textGold}` : styles.cPos}>
              {t.pos}
            </span>
            <span className={styles.cTeam}>{t.name}</span>
            <span className={styles.cNum}>{t.mp}</span>
            <span className={styles.cNum}>{t.w}</span>
            <span className={styles.cNum}>{t.l}</span>
            <span className={t.pos === 1 ? `${styles.cPts} ${styles.textGold}` : styles.cPts}>
              {t.pts}
            </span>
            <span className={styles.cForm}>
              {t.form.map((r, i) => (
                <span key={i} className={styles[`badge${r}`]}>{r}</span>
              ))}
            </span>
          </div>
        ))}

        <div className={styles.previewFoot}>
          <span className={styles.previewUpdated}>Updated just now</span>
          <span className={styles.previewLive}>● Live</span>
        </div>

      </div>
    </div>
  )
}

const FEATURES = [
  {
    title: 'Live Standings',
    desc: 'Real-time league tables updated after every match.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2"  y="13" width="3" height="5"  fill="#b4975a" fillOpacity="0.9" />
        <rect x="7"  y="9"  width="3" height="9"  fill="#b4975a" fillOpacity="0.65" />
        <rect x="12" y="5"  width="3" height="13" fill="#b4975a" fillOpacity="0.45" />
        <rect x="17" y="2"  width="3" height="16" fill="#b4975a" fillOpacity="0.25" />
      </svg>
    ),
  },
  {
    title: 'Match Schedule',
    desc: 'Browse upcoming fixtures and past results by division.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="1.5" y="3.5" width="17" height="14" stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" />
        <line x1="1.5" y1="7.5" x2="18.5" y2="7.5" stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" />
        <line x1="6"   y1="1"   x2="6"    y2="5"    stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" />
        <line x1="14"  y1="1"   x2="14"   y2="5"    stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" />
        <rect x="4"    y="10"   width="2.5" height="2.5" fill="#b4975a" fillOpacity="0.5" />
        <rect x="8.75" y="10"   width="2.5" height="2.5" fill="#b4975a" fillOpacity="0.5" />
        <rect x="13.5" y="10"   width="2.5" height="2.5" fill="#b4975a" fillOpacity="0.3" />
      </svg>
    ),
  },
  {
    title: 'Player Stats',
    desc: 'Track goals, assists, cards, and form across the season.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="6.5" r="3.5" stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" />
        <path d="M3 18.5c0-3.866 3.134-7 7-7s7 3.134 7 7"
          stroke="#b4975a" strokeWidth="1" strokeOpacity="0.9" strokeLinecap="square" />
      </svg>
    ),
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Admin sets up the league',
    desc: 'Create divisions, add teams, and configure your season schedule in minutes.',
  },
  {
    n: '02',
    title: 'Players join with a code',
    desc: 'Share a unique invite code. Players join instantly — no downloads required.',
  },
  {
    n: '03',
    title: 'Track everything live',
    desc: 'Standings, results, and stats update automatically after every match.',
  },
]

export default function Home() {
  return (
    <div className={styles.root}>

      <nav className={styles.nav}>
        <img src={logo} alt="PitchSync" className={styles.logo} />
        <Link to="/login" className={styles.loginBtn}>Login</Link>
      </nav>

      <section className={styles.hero}>

        <div className={styles.geomLeft} aria-hidden="true"><DotGrid id="dotsL" /></div>
        <div className={styles.geomRight} aria-hidden="true"><DotGrid id="dotsR" /></div>

        <div className={styles.heroFrame}>
          {/* overflow:hidden is on pitchClip, not heroFrame, so the 3D card isn't clipped */}
          <div className={styles.pitchClip}>
            <SoccerPitch />
          </div>

          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <div className={styles.heroGlow} aria-hidden="true" />

              <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                <span className={styles.eyebrowLabel}>PitchSync</span>
              </div>

              <h1 className={styles.title}>
                Welcome to{' '}
                <span className={styles.gold}>PitchSync</span>:{' '}
                <br />
                League Management Made Easy
              </h1>

              <div className={styles.actions}>
                <Link to="/login?tab=player" className={styles.btnPlayer}>Player</Link>
                <Link to="/login?tab=admin" className={styles.btnAdmin}>Admin</Link>
              </div>
            </div>

            <div className={styles.heroGraphic}>
              <StandingsPreview />
            </div>
          </div>
        </div>

      </section>

      <section className={styles.features}>
        <div className={styles.featuresHeader}>
          <span className={styles.sectionEyebrow}>
            <span className={styles.eyebrowLine} />
            Features
          </span>
        </div>
        <div className={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <span className={styles.cardIcon}>{f.icon}</span>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.howItWorks}>
        <div className={styles.howHeader}>
          <span className={styles.sectionEyebrow}>
            <span className={styles.eyebrowLine} />
            How It Works
          </span>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.step}>
              <p className={styles.stepNum}>{s.n}</p>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <img src={logo} alt="PitchSync" className={styles.footerLogo} />
            <p className={styles.footerTagline}>League Management Made Easy</p>
          </div>
          <p className={styles.copyright}>© 2025 PitchSync. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
