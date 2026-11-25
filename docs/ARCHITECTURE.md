# System Architecture

## 1. Architectural Pattern
The system is structured as a modular MERN monolith directly implementing the components from `diagrams/SAD-component.drawio (1).png`, `diagrams/SAD-composite.drawio.png`, and `diagrams/class.png`:

- **Web / Client Interface (`client/`):** React 18 + Vite SPA with React Router and a custom Neo-brutalism + Bauhaus CSS token design system (`client/src/styles/tokens.css`, `global.css`), communicating with the API through a centralized native `fetch` client (`client/src/lib/api.js`) via same-origin `/api` proxy in development or static serving in production.
- **Application & Transport (`server/src/index.js`, `server/src/app.js`):** `Application` encapsulates `MongoDBConnection`, initializes Express middleware (`helmet`, `cors`, `cookie-parser`, `csrfOriginCheck`, `express-rate-limit`, centralized Zod validation & error mapping), and cleanly separates app construction (`createApp`) from HTTP server binding (`start()`).
- **Controllers (`server/src/controllers/`):**
  - `bookingController` (`BookingController`: `submitBooking`, `cancelBooking`, `getStatus`, `listBookings`, `getBookingById`)
  - `managementController` (`ManagementController`: `searchHostels`, `getHostelDetail`, `checkAvailability`, hostel/room/bed CRUD, `approveAndAllocate`, `rejectBooking`, `listAllocations`, `recordCheckIn`, `recordCheckOut`, `releaseBed`)
  - `authController`, `operationsController`, `adminController`
- **Services (`server/src/services/`):**
  - `BookingService`, `HostelService`, `AllocationService`, `AuthService`, `UserService`, `ComplaintService`, `VisitorService`, `PaymentService`, `AuditService`, `ReportService`, `HistoryService`, `DashboardService`.
- **Persistence (`server/src/config/db.js`, `server/src/models/`):**
  - `MongoDBConnection` manages Mongoose connection state and inspects replica-set capability (`hello.setName`).
  - Domain collections: `User`, `Hostel`, `Room`, `Bed`, `Booking`, `Allocation`, `PaymentRecord`, `Complaint`, `Visitor`, `VisitorRecord`, `AuditLog`, `Report`, `Counter`.

## 2. Concurrency-Safe Bed Allocation
Per `diagrams/technical flow.png` (*"Bed availability is checked again before allocation. A bed is allocated only after approval, helping prevent conflicting active allocations."*), booking creation and bed allocation execute inside `runWithBedLockAndTx(bedObjectId, fn)`:
1. When connected to a MongoDB replica set (local `rs0` or Atlas), operations execute inside `session.withTransaction(...)` with `WriteConflict` retries and an atomic `Bed.findOneAndUpdate(..., { $inc: { allocationVersion: 1 } }, { session })` write lock on the target `Bed`.
2. When connected to a standalone MongoDB instance, `Bed.findOneAndUpdate({ _id, allocationLock: null }, { $set: { allocationLock: token } })` acquires an exclusive per-bed mutex released in a `finally` block.
3. `Allocation` enforces a unique index on `booking`, and `getUnavailableBedIdsForPeriod` checks overlapping `[startDate, endDate)` intervals across `Active`/`CheckedIn` allocations and `Approved` bookings before any write commits.

## 3. Security Controls
- Passwords hashed with `bcryptjs` (cost 10); `passwordHash` has `select: false` and is stripped in `toJSON` / `toObject`.
- Sessions stored in HTTP-only `SameSite=Lax` JWT cookies (`Secure` when `NODE_ENV=production`).
- Login and registration endpoints protected by `express-rate-limit`.
- Mutations guarded by `csrfOriginCheck` + CORS allowlist.
- Every protected endpoint enforces role checks (`requireRoles`) and record ownership / Warden `assignedHostelId` scoping.
