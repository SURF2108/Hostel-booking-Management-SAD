# Software Requirements Specification

Derived exclusively from the audited SAD artifacts in `diagrams/` and engineered per `antigravity-setup/ARCHITECTURE.md` and `antigravity-setup/DESIGN_SYSTEM.md`.

---

## 1. Roles and Actors
1. **`Student`**: Prospective or resident student searching hostels/beds, managing profile, submitting/viewing/cancelling bookings, submitting complaints, and registering visitors.
2. **`Warden`**: Hostel operational manager (optionally scoped by `assignedHostelId`) checking availability, reviewing/approving/rejecting bookings, allocating beds, recording check-in/check-out, managing complaints and visitors, and searching historical records.
3. **`Administrator`**: System administrator managing hostels, rooms, beds, users, and roles, reviewing audit logs, generating reports, and searching historical records.
4. **`AccountsPersonnel`**: Finance staff creating, updating, and viewing `PaymentRecord` entries linked to bookings, and generating reports.
5. **`HostelManagement`**: Executive/oversight role viewing and generating operational reports, reviewing audit logs, and searching historical records.

---

## 2. Functional Requirements

- **FR-01 Authentication and Session Management (`Log in` / `logout`):**
  - Users authenticate via username/email and password (`bcrypt` hash comparison) and receive an HTTP-only, `SameSite=Lax` cookie storing a signed JWT session, plus CSRF origin/token protection on mutations.
  - `POST /api/v1/auth/logout` clears the session cookie and records an audit event.
  - `POST /api/v1/auth/register` supports public registration strictly for the `Student` role (`accountStatus: 'Active'`); staff roles (`Warden`, `Administrator`, `AccountsPersonnel`, `HostelManagement`) cannot be self-registered.
  - Suspended or inactive accounts (`accountStatus !== 'Active'`) are denied login with `403`.
- **FR-02 Student Profile Management (`Manage profile`):**
  - Authenticated students can view and update `fullName`, `contactNumber`, and `email` (and optionally change password with current password verification). `role`, `studentId`, and `accountStatus` cannot be escalated by self-service.
- **FR-03 Hostel, Room, and Bed Discovery & Availability (`Search hostel / bed availability`, `Check bed availability`):**
  - Authenticated users (`Student`, `Warden`, `Administrator`, `AccountsPersonnel`, `HostelManagement`) can browse/filter hostels (`hostelType`, `search`), rooms (`roomStatus`), and beds (`bedStatus`, `maintenanceStatus`) and query date-range availability (`startDate`, `endDate`) to see real-time availability computed server-side from bed status, maintenance state, and overlapping active/approved bookings or allocations.
- **FR-04 Submit Booking Request (`Submit booking request`):**
  - `Student` selects a `bedId`, `startDate`, and `endDate` (with `endDate > startDate`).
  - Server re-validates student active status, bed existence, `maintenanceStatus === 'Operational'`, no overlapping `Approved` booking or `Active`/`CheckedIn` allocation on that bed, and prevents duplicate/overlapping `Pending`/`Approved` bookings by the same student under concurrency.
  - Saves `Booking` in `Pending` status and writes an `AuditLog`.
- **FR-05 View and Cancel Booking (`View/Manage Booking`, `Cancel booking`):**
  - `Student` views their own bookings (with status timeline, hostel/room/bed info, allocation info, and associated payment records).
  - `Student` can cancel their own `Pending` or `Approved` booking (as long as not yet `CheckedIn` / `CheckedOut`). Cancelling an `Approved` booking atomically transitions any linked `Active` `Allocation` to `Released` and updates `Bed.bedStatus` back to `Available` if no other active allocation holds it.
- **FR-06 Review, Approve/Reject Booking, and Allocate Bed (`Review / approve booking`, `Allocate bed`):**
  - `Warden` (scoped to `assignedHostelId` when assigned, or all hostels if `assignedHostelId` is null) reviews `Pending` bookings.
  - Rejecting transitions `Pending -> Rejected` with optional `decisionNote` and audit record.
  - Approving (`approveAndAllocate`) runs inside an atomic MongoDB transaction (with fallback atomic bed-lock guard on standalone MongoDB) that:
    1. Re-verifies `Booking` is still `Pending` and `Bed` is operational.
    2. Re-checks bed availability for `[startDate, endDate]` against all `Active`/`CheckedIn` allocations and `Approved` bookings.
    3. Transitions `Booking` to `Approved`, creates `Allocation` (`allocationStatus: 'Active'`), updates `Bed.bedStatus` to `'Occupied'` (or `'Reserved'` if future startDate, becoming `'Occupied'` at check-in — simplified cleanly to `'Reserved'` on allocation and `'Occupied'` on check-in, both treated as unavailable for overlapping dates), and writes `AuditLog`.
    4. Parallel conflicting approvals for overlapping dates on the same bed fail safely with `409 Conflict`.
- **FR-07 Check-in and Check-out Recording (`Record Check in / Check out`):**
  - `Warden` records check-in for an `Active` allocation (`Active -> CheckedIn`, `Bed.bedStatus -> 'Occupied'`, `checkInAt` timestamp) and check-out (`CheckedIn -> CheckedOut`, `Bed.bedStatus -> 'Available'`, `checkOutAt` timestamp, `Booking.bookingStatus -> 'Completed'`), or manually releases an unused `Active` allocation (`Active -> Released`, `Bed.bedStatus -> 'Available'`).
- **FR-08 Hostel, Room, and Bed Administration (`Manage hostels, rooms and beds`):**
  - `Administrator` creates and updates `Hostel` (`hostelId`, `hostelName`, `address`, `hostelType`), `Room` (`roomId`, `roomNumber`, `capacity`, `roomStatus`), and `Bed` (`bedId`, `bedNumber`, `bedStatus`, `maintenanceStatus`).
  - Room `capacity` and bed additions/deletions remain consistent; beds with `Active`/`CheckedIn` allocations cannot be deleted or deactivated silently.
- **FR-09 User and Role Administration (`Manage users and roles`):**
  - `Administrator` lists/searches users, creates accounts (any of the 5 roles), updates roles, toggles `accountStatus` (`Active`/`Inactive`/`Suspended`), and assigns `Warden.assignedHostelId`.
  - Self-deactivation or removing the last active `Administrator` is prevented.
- **FR-10 Complaints Workflow (`Submit complaints`, `Manage complaints`):**
  - `Student` submits a complaint (`description`, optional `hostelId`/`bookingId`) initialized as `Open`.
  - `Student` views their own complaints and resolution updates.
  - `Warden` (scoped to assigned hostel when applicable) views complaints and updates status (`Open -> InProgress -> Resolved -> Closed`) with `resolutionDetails`.
- **FR-11 Visitor Registration and Management (`Register visitors`, `Manage visitors`):**
  - `Student` registers a `Visitor` (`visitorName`, `contactNumber`, `identificationDetails`) and creates a `VisitorRecord` (`visitDate`, `hostelId`, `visitStatus: 'Registered'`).
  - `Warden` views visitor records, registers walk-in/student visits, records `checkInTime` (`Registered -> CheckedIn`), records `checkOutTime` (`CheckedIn -> CheckedOut`), or cancels (`Registered -> Cancelled`).
- **FR-12 Payment Records (`Maintain payment records`, `View payment records`):**
  - `AccountsPersonnel` views all `PaymentRecord` entries (filterable by `paymentStatus`, `bookingId`, date range), creates new payment records linked to valid `Booking` records (`amountMinor` > 0 in `INR` minor units, `paymentReference`, `paymentStatus`), and updates status (`Pending`, `Paid`, `Failed`, `Refunded`).
  - `Student` can view read-only payment records belonging to their own bookings.
- **FR-13 Audit Logs (`Review audit logs`):**
  - `Administrator` and `HostelManagement` view paginated, filterable `AuditLog` entries (`action`, `actorRole`, `affectedModel`, `dateRange`). All critical mutations append immutable `AuditLog` entries automatically.
- **FR-14 Reports (`Generate reports`):**
  - `Administrator`, `AccountsPersonnel`, and `HostelManagement` generate and persist `Report` snapshots (`Occupancy`, `Bookings`, `Payments`, `Complaints`, `AuditSummary`) over a chosen `reportPeriod` and filter criteria, computed from live MongoDB aggregations, and view historical generated reports.
- **FR-15 Historical Record Search (`Search historical records`):**
  - `Warden` (hostel-scoped if assigned), `Administrator`, and `HostelManagement` search across historical `Bookings`, `Allocations`, `Complaints`, `VisitorRecords`, and `PaymentRecords` using keyword, entity type, status, and date-range filters with pagination.

---

## 3. Non-Functional Requirements

- **NFR-01 Persistent Storage:** Real MongoDB database via Mongoose; zero in-memory fallback for runtime storage.
- **NFR-02 Concurrency & Data Integrity:** Transactional + unique-key / atomic-guard protection preventing double allocation of the same bed for overlapping periods under parallel requests.
- **NFR-03 Security:** `bcrypt` password hashing (cost >= 10), rate-limited login, HTTP-only cookies, CSRF origin/header verification on state-changing routes, Joi/Zod/express validation on all payloads, strict role & ownership authorization on every endpoint, zero exposed secrets or stack traces.
- **NFR-04 UI Design System:** Strict Neo-brutalism + Bauhaus aesthetic (`#F5F1E8` canvas, `#FFFDF7` surface, `#171717` ink, `#E94235` red, `#2454D8` blue, `#F4C542` yellow, `#226344` success, 2px/3px black borders, `5px 5px 0 #171717` hard offset shadows, geometric sans headings, Lucide SVG icons, **zero emojis anywhere**).
- **NFR-05 Accessibility & Responsiveness:** Functional at 360px, 768px, and 1440px widths; keyboard navigable dialogs, focus outlines, semantic labels, ARIA live errors, loading/empty/error/success states on all screens.

---

## 4. Authorization Matrix

| Capability / Endpoint Group | Student | Warden | Administrator | AccountsPersonnel | HostelManagement |
|---|---|---|---|---|---|
| Auth (`login`, `logout`, `me`) | Own | Own | Own | Own | Own |
| Public Self-Register (`Student` only) | Yes | No | No | No | No |
| Profile (`GET/PATCH /profile`) | Own | Own (basic) | Own (basic) | Own (basic) | Own (basic) |
| Hostels / Rooms / Beds Read & Availability | All active | All | All | All | All |
| Hostels / Rooms / Beds Create & Update | No | No | Yes | No | No |
| Users & Roles Management | No | No | Yes | No | No |
| Submit Booking (`POST /bookings`) | Own | No | No | No | No |
| View Bookings (`GET /bookings`) | Own only | Assigned hostel (or all if unassigned) | All | Summary/read for payment linking | All |
| Cancel Booking (`POST /bookings/:id/cancel`) | Own (`Pending`/`Approved`) | No (uses reject/release) | No | No | No |
| Review / Approve / Reject Booking & Allocate Bed | No | Assigned hostel (or all if unassigned) | No | No | No |
| Check-in / Check-out / Release Allocation | No | Assigned hostel (or all if unassigned) | No | No | No |
| Submit Complaint (`POST /complaints`) | Own | No | No | No | No |
| View Complaints (`GET /complaints`) | Own only | Assigned hostel / all | All | No | Read (historical) |
| Manage Complaints (`PATCH /complaints/:id`) | No | Assigned hostel / all | No | No | No |
| Register Visitor (`POST /visitors`) | Own | Yes | No | No | No |
| Manage Visitors (`PATCH /visitors/:id/status`) | No | Assigned hostel / all | No | No | No |
| View Visitors (`GET /visitors`) | Own only | Assigned hostel / all | All | No | Read (historical) |
| Maintain Payment Records (`POST/PATCH /payments`) | No | No | No | Yes | No |
| View Payment Records (`GET /payments`) | Own bookings only | No | No | All | Read (historical) |
| Audit Logs (`GET /audit-logs`) | No | No | Yes | No | Yes |
| Generate & View Reports (`GET/POST /reports`) | No | No | Yes | Yes | Yes |
| Search Historical Records (`GET /history`) | No | Assigned hostel / all | Yes | No | Yes |

---

## 5. State Transition Tables

### 5.1 `Booking.bookingStatus`
| Current State | Trigger / Actor | Next State | Side Effects / Guard |
|---|---|---|---|
| `(none)` | `Student` submits booking | `Pending` | Bed must be `Operational` and free of overlapping `Approved`/`Active`/`CheckedIn`; prevents overlapping `Pending` by same student |
| `Pending` | `Warden` approves & allocates | `Approved` | Atomic re-check availability; creates `Allocation(Active)`; updates `Bed.bedStatus = 'Reserved'` |
| `Pending` | `Warden` rejects | `Rejected` | Records `decisionNote` and `reviewedByWardenId` |
| `Pending` | `Student` cancels | `Cancelled` | Records `cancelledAt` |
| `Approved` | `Student` cancels (before check-in) | `Cancelled` | Linked `Allocation` -> `Released`; `Bed.bedStatus` -> `'Available'` |
| `Approved` | `Warden` releases unused allocation | `Cancelled` | Linked `Allocation` -> `Released`; `Bed.bedStatus` -> `'Available'` |
| `Approved` | `Warden` records check-out | `Completed` | Triggered when `Allocation` transitions `CheckedIn -> CheckedOut` |
| `Rejected` / `Cancelled` / `Completed` | Any mutation | `(409 Conflict)` | Terminal states |

### 5.2 `Allocation.allocationStatus` & `Bed.bedStatus`
| Allocation State | Trigger / Actor | Next Allocation State | Bed Status Update |
|---|---|---|---|
| `(none)` | `Warden` approves & allocates | `Active` | `Available` -> `Reserved` |
| `Active` | `Warden` records check-in | `CheckedIn` | `Reserved` -> `Occupied` |
| `CheckedIn` | `Warden` records check-out | `CheckedOut` | `Occupied` -> `Available` |
| `Active` | `Student` cancels booking or `Warden` releases bed | `Released` | `Reserved` -> `Available` |

### 5.3 `Complaint.complaintStatus`
`Open` -> `InProgress` -> `Resolved` -> `Closed` (also `Open` -> `Resolved` directly by Warden with `resolutionDetails`).

### 5.4 `VisitorRecord.visitStatus`
`Registered` -> `CheckedIn` -> `CheckedOut`; `Registered` -> `Cancelled`.

### 5.5 `PaymentRecord.paymentStatus`
`Pending` -> `Paid` | `Failed`; `Paid` -> `Refunded`; `Failed` -> `Pending` | `Paid`.
