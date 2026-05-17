import AppLayout from '../components/AppLayout'
import styles from './Players.module.css'

const PLAYERS = [
  { rank: 1,  name: 'Marcus Webb',    team: 'Falcons FC',  goals: 12 },
  { rank: 2,  name: 'Jordan Cole',    team: 'City Rovers', goals: 9  },
  { rank: 3,  name: 'Theo Nkosi',     team: 'Kings FC',    goals: 8  },
  { rank: 4,  name: 'Sam Okafor',     team: 'Falcons FC',  goals: 6  },
  { rank: 5,  name: 'Liam Brennan',   team: 'United SC',   goals: 5  },
  { rank: 6,  name: 'Dylan Marsh',    team: 'City Rovers', goals: 5  },
  { rank: 7,  name: 'Aiden Torres',   team: 'Kings FC',    goals: 4  },
  { rank: 8,  name: 'Ryan Fowler',    team: 'Strikers',    goals: 3  },
  { rank: 9,  name: 'Callum Reid',    team: 'United SC',   goals: 2  },
  { rank: 10, name: 'Jamie Sinclair', team: 'City FC',     goals: 2  },
]

export default function Players() {
  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Leaderboard</h1>
            <p className={styles.pageSubtitle}>Top scorers this season</p>
          </div>
          <button className={styles.btnPrimary}>+ Add Goal</button>
        </div>

        <div className={styles.tableWrap}>

          <div className={`${styles.row} ${styles.header}`}>
            <span className={styles.cRank}>Rank</span>
            <span className={styles.cPlayer}>Player</span>
            <span className={styles.cTeam}>Team</span>
            <span className={styles.cGoals}>Goals</span>
          </div>

          {PLAYERS.map(p => (
            <div
              key={p.rank}
              className={`${styles.row} ${p.rank === 1 ? styles.rowFirst : ''}`}
            >
              <span className={`${styles.cRank} ${p.rank <= 3 ? styles.rankGold : styles.rankDim}`}>
                {p.rank}
              </span>
              <span className={styles.cPlayer}>{p.name}</span>
              <span className={styles.cTeam}>{p.team}</span>
              <span className={`${styles.cGoals} ${p.rank === 1 ? styles.goalsFirst : ''}`}>
                {p.goals}
              </span>
            </div>
          ))}

        </div>
      </div>
    </AppLayout>
  )
}
