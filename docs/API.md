# REST API Reference (`/api/v1`)

All endpoints (except `/health`, `/ready`, `/auth/login`, and `/auth/register`) require an active authenticated session cookie (`hostel_session`) or Bearer JWT and return standard JSON error envelopes on failure:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable description",
  "fieldErrors": { "field": "Validation error" }
}
```

## Health & Readiness
- `GET /api/v1/health` — Returns `{ status: "ok", service, timestamp }`.
- `GET /api/v1/ready` — Returns `200` `{ status: "ready", database: "connected", transactionsSupported }` or `503` if MongoDB is disconnected.

## Authentication & Profile
- `POST /api/v1/auth/login` — Body: `{ identifier, password }`. Sets HTTP-only cookie (`SameSite=Lax`). Rate-limited. Returns `200 { user }` (`401` invalid credentials, `403` inactive/suspended).
- `POST /api/v1/auth/register` — Body: `{ username, password, fullName, email, contactNumber }`. Public student-only registration (`role` forced to `Student`). Returns `201 { user }`.
- `POST /api/v1/auth/logout` — Clears session cookie and writes `AuditLog`. Returns `200 { ok: true }`.
- `GET /api/v1/auth/me` — Returns authenticated user profile (`passwordHash` omitted).
- `PATCH /api/v1/auth/profile` — Body: `{ fullName?, email?, contactNumber?, currentPassword?, newPassword? }`. Returns `200 { user }`.

## Hostels, Rooms, Beds & Availability
- `GET /api/v1/hostels` — Query: `search`, `hostelType`, `includeInactive`, `startDate`, `endDate`. Returns `{ hostels }`.
- `GET /api/v1/hostels/:id` — Query: `startDate`, `endDate`. Returns `{ hostel }` with nested `rooms` and `beds` plus `isAvailableForQuery`.
- `GET /api/v1/beds/availability` — Query: `hostelId`, `roomId`, `bedId`, `startDate`, `endDate`. Returns `{ available, reason, bed }` when `bedId` is passed, or `{ beds }` list.
- `POST /api/v1/hostels` (`Administrator`) — Body: `{ hostelId?, hostelName, address, hostelType, isActive? }`. Returns `201 { hostel }`.
- `PATCH /api/v1/hostels/:id` (`Administrator`) — Updates hostel details/status.
- `DELETE /api/v1/hostels/:id` (`Administrator`) — Deletes empty hostel (`409` if rooms/allocations exist).
- `POST /api/v1/hostels/:hostelId/rooms` (`Administrator`) — Body: `{ roomNumber, capacity, roomStatus? }`.
- `PATCH /api/v1/rooms/:roomId` (`Administrator`) — Updates room fields/capacity.
- `DELETE /api/v1/rooms/:roomId` (`Administrator`) — Deletes empty room.
- `POST /api/v1/rooms/:roomId/beds` (`Administrator`) — Body: `{ bedNumber, bedStatus?, maintenanceStatus? }` (`409` if room capacity reached).
- `PATCH /api/v1/beds/:bedId` (`Administrator`) — Updates bed status or maintenance state.
- `DELETE /api/v1/beds/:bedId` (`Administrator`) — Deletes unallocated bed.

## Bookings & Allocations
- `GET /api/v1/bookings` — Role-scoped list (`Student` own only; `Warden` assigned hostel; Staff global). Query: `status`, `search`, `hostelId`, `page`, `limit`.
- `POST /api/v1/bookings` (`Student`) — Body: `{ bedId, startDate, endDate, notes? }`. Validates availability and creates `Pending` booking (`201 { booking }`).
- `GET /api/v1/bookings/:id` — Detailed booking with linked `allocation` and `payments`.
- `GET /api/v1/bookings/:id/status` — Returns `{ bookingId, bookingStatus, allocationStatus }`.
- `POST /api/v1/bookings/:id/cancel` (`Student` owner) — Body: `{ reason? }`. Cancels `Pending`/`Approved` booking before check-in and releases active allocation.
- `POST /api/v1/bookings/:id/approve` (`Warden`) — Body: `{ decisionNote? }`. Transactionally rechecks bed availability, sets `Approved`, creates `Allocation(Active)`, updates `Bed` to `Reserved` (`409` on race/conflict).
- `POST /api/v1/bookings/:id/reject` (`Warden`) — Body: `{ decisionNote? }`. Transitions `Pending -> Rejected`.
- `GET /api/v1/allocations` (`Warden`, `Administrator`, `HostelManagement`) — Query: `status`, `hostelId`, `page`, `limit`.
- `POST /api/v1/allocations/:id/check-in` (`Warden`) — `Active -> CheckedIn`, `Bed -> Occupied`.
- `POST /api/v1/allocations/:id/check-out` (`Warden`) — `CheckedIn -> CheckedOut`, `Booking -> Completed`, `Bed -> Available`.
- `POST /api/v1/allocations/:id/release` (`Warden`) — Body: `{ reason? }`. `Active -> Released`, `Booking -> Cancelled`, `Bed -> Available`.

## Complaints, Visitors & Payments
- `GET /api/v1/complaints` (`Student`, `Warden`, `Administrator`, `HostelManagement`) — Query: `status`, `category`, `page`, `limit`.
- `POST /api/v1/complaints` (`Student`) — Body: `{ hostelId?, bookingId?, category?, description }`.
- `PATCH /api/v1/complaints/:id` (`Warden`) — Body: `{ complaintStatus, resolutionDetails? }` (`resolutionDetails` required for `Resolved`/`Closed`).
- `GET /api/v1/visitors` (`Student`, `Warden`, `Administrator`, `HostelManagement`) — Query: `status`, `page`, `limit`.
- `POST /api/v1/visitors` (`Student`, `Warden`) — Body: `{ visitorName, contactNumber, identificationDetails, hostelId, studentId?, visitDate, purpose? }`.
- `PATCH /api/v1/visitors/:id` (`Warden`) — Body: `{ visitStatus, visitorName?, contactNumber?, identificationDetails? }`.
- `GET /api/v1/payments` (`AccountsPersonnel`, `Student` own only, `HostelManagement`) — Query: `status`, `search`, `page`, `limit`.
- `POST /api/v1/payments` (`AccountsPersonnel`) — Body: `{ bookingId, amountMinor, paymentReference, paymentStatus?, paymentDate?, notes? }`.
- `PATCH /api/v1/payments/:id` (`AccountsPersonnel`) — Body: `{ paymentStatus?, amountMinor?, paymentReference?, notes? }`.

## Administration, Audit, Reports & History
- `GET /api/v1/dashboard` — Role-specific live metrics and summary queues.
- `GET /api/v1/users` (`Administrator`, `Warden`) — Query: `role`, `accountStatus`, `search`, `page`, `limit`.
- `POST /api/v1/users` (`Administrator`) — Body: `{ username, password, role, fullName, email?, contactNumber?, accountStatus?, assignedHostelId? }`.
- `PATCH /api/v1/users/:id` (`Administrator`) — Updates `role`, `accountStatus`, `assignedHostelId`, profile fields.
- `GET /api/v1/audit-logs` (`Administrator`, `HostelManagement`) — Query: `action`, `affectedModel`, `actorRole`, `search`, `startDate`, `endDate`, `page`, `limit`.
- `GET /api/v1/reports` (`Administrator`, `AccountsPersonnel`, `HostelManagement`) — Query: `reportType`, `page`, `limit`.
- `POST /api/v1/reports` (`Administrator`, `AccountsPersonnel`, `HostelManagement`) — Body: `{ reportType, reportPeriod, hostelId?, startDate?, endDate? }`.
- `GET /api/v1/reports/:id` (`Administrator`, `AccountsPersonnel`, `HostelManagement`).
- `GET /api/v1/history` (`Warden`, `Administrator`, `HostelManagement`) — Query: `category`, `search`, `startDate`, `endDate`, `page`, `limit`.
