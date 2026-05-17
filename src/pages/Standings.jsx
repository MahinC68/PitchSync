import AppLayout from '../components/AppLayout'
import styles from './Standings.module.css'

const TEAMS = [
  { pos: 1, name: 'Falcons FC',  div: 'Division A', mp: 10, w: 8, d: 1, l: 1, gf: 26, ga: 9,  pts: 25, form: ['W','W','D','W','W'], qual: true },
  { pos: 2, name: 'City Rovers', div: 'Division A', mp: 10, w: 7, d: 2, l: 1, gf: 21, ga: 10, pts: 23, form: ['W','L','W','W','D'], qual: true },
  { pos: 3, name: 'Kings FC',    div: 'Division B', mp: 10, w: 6, d: 2, l: 2, gf: 18, ga: 12, pts: 20, form: ['W','W','W','L','D'] },
  { pos: 4, name: 'United SC',   div: 'Division B', mp: 10, w: 4, d: 3, l: 3, gf: 14, ga: 13, pts: 15, form: ['D','W','L','D','W'] },
  { pos: 5, name: 'Strikers',    div: 'Division A', mp: 10, w: 3, d: 2, l: 5, gf: 11, ga: 18, pts: 11, form: ['L','L','W','D','L'] },
  { pos: 6, name: 'City FC',     div: 'Division B', mp: 10, w: 2, d: 1, l: 7, gf: 9,  ga: 22, pts: 7,  form: ['L','D','L','L','L'] },
]

const QUICK_STATS = [
  { label: 'Most Goals',    value: 'Falcons FC', sub: '26 GF' },
  { label: 'Best Defense',  value: 'Falcons FC', sub: '9 GA'  },
  { label: 'Top GD',        value: 'Falcons FC', sub: '+17'   },
  { label: 'In Form',       value: 'Kings FC',   sub: 'WWWLD' },
]

export default function Standings() {
  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Standings</h1>
            <p className={styles.pageSubtitle}>Live table, points, and recent form</p>
          </div>
          <button className={styles.btnAddResult}>+ Add Result</button>
        </div>

        <div className={styles.body}>

          {/* main column */}
          <section className={styles.main}>

            {/* table */}
            <div className={styles.tableWrap}>
              <div className={styles.tableScroll}>

                <div className={`${styles.tableRow} ${styles.tableHead}`}>
                  <span className={styles.cPos}>#</span>
                  <span className={styles.cTeam}>Team</span>
                  <span className={styles.cNum}>MP</span>
                  <span className={styles.cNum}>W</span>
                  <span className={styles.cNum}>D</span>
                  <span className={styles.cNum}>L</span>
                  <span className={styles.cNum}>GF</span>
                  <span className={styles.cNum}>GA</span>
                  <span className={styles.cNum}>GD</span>
                  <span className={styles.cPts}>PTS</span>
                  <span className={styles.cForm}>Form</span>
                </div>

                {TEAMS.map(t => {
                  const gd = t.gf - t.ga
                  return (
                    <div
                      key={t.pos}
                      className={`${styles.tableRow} ${t.qual ? styles.tableRowQual : ''}`}
                    >
                      <span className={styles.cPos}>{t.pos}</span>

                      <span className={styles.cTeam}>
                        <span className={styles.teamName}>{t.name}</span>
                      </span>

                      <span className={styles.cNum}>{t.mp}</span>
                      <span className={styles.cNum}>{t.w}</span>
                      <span className={styles.cNum}>{t.d}</span>
                      <span className={styles.cNum}>{t.l}</span>
                      <span className={styles.cNum}>{t.gf}</span>
                      <span className={styles.cNum}>{t.ga}</span>
                      <span className={`${styles.cNum} ${gd > 0 ? styles.gdPlus : gd < 0 ? styles.gdMinus : ''}`}>
                        {gd > 0 ? `+${gd}` : gd}
                      </span>
                      <span className={styles.cPts}>{t.pts}</span>

                      <span className={styles.cForm}>
                        {t.form.map((r, i) => (
                          <span key={i} className={styles[`badge${r}`]}>{r}</span>
                        ))}
                      </span>
                    </div>
                  )
                })}

              </div>
            </div>

          </section>

          {/* right sidebar */}
          <aside className={styles.side}>

            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Quick Stats</h3>
              <div className={styles.statsGrid}>
                {QUICK_STATS.map(s => (
                  <div key={s.label} className={styles.statBox}>
                    <span className={styles.statLabel}>{s.label}</span>
                    <span className={styles.statValue}>{s.value}</span>
                    <span className={styles.statSub}>{s.sub}</span>
                  </div>
                ))}
              </div>
            </div>

          </aside>

        </div>
      </div>
    </AppLayout>
  )
}
