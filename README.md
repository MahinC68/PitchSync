# PitchSync

> Full stack soccer league management platform

## Overview

PitchSync is a full stack web application for managing recreational soccer leagues. Admins create a league, manage teams, players, and fixtures, and record match results with goal scorers. Players join via a unique access code to view live standings, the match schedule, and the top scorer leaderboard — no account required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, CSS Modules |
| Backend | Node.js, Express |
| Database | PostgreSQL (Railway) |
| Auth | JWT (admins), access code (players) |
| Testing | Jest, Supertest, Playwright |
| Deployment | Vercel (frontend), Railway (backend) |

---

## Features

- **Role-based access** — admins get full CRUD, players get read-only view
- **Live standings** — W/D/L form badges with tiebreaker logic (GD, GF)
- **Fixture management** — schedule matches and record results with goal scorer tracking
- **Top scorer leaderboard** — updated in real time as results are entered
- **Team & player management** — via the admin Settings panel
- **JWT-protected admin routes** — all write operations require authentication
- **Player access via league code** — no account needed

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Backend

```bash
cd server
npm install
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, PORT
node index.js
```

### Frontend

```bash
npm install
npm run dev
```

---

## Testing

### Backend — Jest + Supertest

```bash
cd server
npm test
# 56 tests · 4 suites · 83% line coverage
```

### E2E — Playwright

```bash
# Requires the dev server and API to be running
npm run test:e2e
# 5 critical user flows · Chromium
```

---

## API Reference

### Auth
| Method | Endpoint | Auth |
|---|---|---|
| `POST` | `/api/auth/register` | — |
| `POST` | `/api/auth/login` | — |
| `POST` | `/api/auth/verify-code` | — |
| `GET` | `/api/auth/league` | Admin |

### Standings
| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/standings/:league_id` | — |

### Fixtures
| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/fixtures/:league_id` | — |
| `POST` | `/api/fixtures` | Admin |
| `PUT` | `/api/fixtures/:id/result` | Admin |
| `DELETE` | `/api/fixtures/:id` | Admin |

### Players & Goals
| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/players/:league_id/top-scorers` | — |
| `GET` | `/api/players/team/:team_id` | Admin |
| `POST` | `/api/players` | Admin |
| `DELETE` | `/api/players/:id` | Admin |
| `POST` | `/api/goals` | Admin |
| `GET` | `/api/goals/match/:match_id` | Admin |
| `DELETE` | `/api/goals/match/:match_id` | Admin |

### Teams
| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/teams` | Admin |
| `POST` | `/api/teams` | Admin |
| `PUT` | `/api/teams/:id` | Admin |
| `DELETE` | `/api/teams/:id` | Admin |

---

## Database Schema

Six tables linked by foreign keys, with cascade deletes where appropriate.

```
leagues
  └── admins
  └── teams
        └── players
  └── matches
        └── goals
```

---

## Project Structure

```
PitchSync/
├── src/                    # React frontend
│   ├── components/         # AppLayout, modals
│   ├── pages/              # Route-level page components
│   ├── api.js              # Fetch wrapper + API calls
│   └── App.jsx             # Router
├── server/                 # Express backend
│   ├── routes/             # auth, fixtures, standings, players, teams, goals
│   ├── middleware/         # JWT auth middleware
│   ├── db/                 # pg Pool
│   └── tests/              # Jest + Supertest integration tests
├── tests/
│   └── e2e.spec.js         # Playwright E2E tests
├── playwright.config.js
└── README.md
```

---

## Deployment

**Frontend:** [pitch-sync-ochre.vercel.app](https://pitch-sync-ochre.vercel.app)

**Backend:** Deployed on Railway alongside the PostgreSQL instance. Currently experiencing downtime due to an ongoing Railway platform outage — the backend URL will be re-linked here once service is restored. Everything runs as expected locally and was previously live.
