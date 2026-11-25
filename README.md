# Hostel Booking & Management System

Full-stack MERN (**MongoDB, Express, React + Vite, Node.js**) web application for campus hostel discovery, booking requests, Warden approval and atomic bed allocation, check-in/check-out tracking, complaint resolution, visitor registration, payment ledger management, audit logging, and operational reporting.

## Core Features

- **Student Portal:** Search hostels and date-range bed availability, submit booking requests, track booking status, cancel reservations before check-in, submit complaints, register visitors, view payment status, and manage profile/password.
- **Warden Operations:** Review and approve/reject pending booking requests with concurrency-safe bed allocation, record resident check-in/check-out, release beds, manage complaints and visitor gate check-in/out, and search historical records.
- **Administrator Console:** Manage hostels, rooms, beds, and maintenance statuses; provision and manage user accounts and roles; review audit logs; and generate reports.
- **Accounts & Management:** Maintain payment records (`INR`), view financial and occupancy snapshots, export CSV reports, and inspect historical records.

## Prerequisites

- **Node.js:** `>= 20.11.0` (LTS)
- **MongoDB:** MongoDB Atlas URI, Docker Compose replica set (`compose.yaml`), or local MongoDB Community Server

## Quick Start (Local Development)

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Create `.env` from `.env.example`:**
   ```powershell
   Copy-Item .env.example .env
   ```
   Generate a secure `JWT_SECRET`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Start MongoDB:**
   - Using Docker Compose (replica set `rs0`):
     ```powershell
     docker compose up -d
     ```
   - Or using local `mongod` helper (writes persistent data to `.local/mongodb-data`):
     ```powershell
     npm run db:start
     ```
   - Or set `MONGODB_URI` in `.env` to your MongoDB Atlas / existing MongoDB URI.

4. **Seed initial accounts and hostel inventory (idempotent):**
   ```powershell
   npm run seed
   ```
   See [docs/CREDENTIALS.md](docs/CREDENTIALS.md) for the list of temporary seeded IDs and passwords.

5. **Run development server (`:5000`) and Vite client (`:5173`):**
   ```powershell
   npm run dev
   ```
   Open `http://localhost:5173`.

## Production Deployment

The Express server automatically serves the compiled Vite frontend (`client/dist/`) when `NODE_ENV=production`:

1. Set production environment variables:
   - `NODE_ENV=production`
   - `PORT=5000` (or platform-provided `PORT`)
   - `MONGODB_URI=<your-mongodb-atlas-or-replica-set-uri>`
   - `MONGODB_DB_NAME=hostel_booking`
   - `JWT_SECRET=<64-char-random-hex>`
   - `CLIENT_ORIGIN=<https://your-domain>`
   - `COOKIE_SECURE=true` (when served over HTTPS)
2. Build and start:
   ```powershell
   npm install
   npm run build
   npm start
   ```
3. Health checks:
   - `GET /api/v1/health`
   - `GET /api/v1/ready`

## Verification

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

## Documentation

- [docs/CREDENTIALS.md](docs/CREDENTIALS.md) — Temporary seeded account IDs and passwords
- [docs/API.md](docs/API.md) — REST API endpoints (`/api/v1`)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture and concurrency design
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — Automated test and browser verification report
