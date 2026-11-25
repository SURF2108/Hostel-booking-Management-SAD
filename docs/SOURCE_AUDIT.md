# Source Audit — Hostel Booking and Management System

## 1. Repository Inventory
- **Repository:** `https://github.com/SURF2108/Hostel-booking-Management-SAD`
- **Git Branch & Revision:** `main` at commit `8f35087` (`update of diagrams`), preceded by `e51993a` (`Initial commit`).
- **Original `README.md`:** Single heading `# Hostel-booking-Management-SAD` (1 line, 30 bytes).
- **Inspection Method:** Every PNG diagram was inspected visually at full/tiled resolution, and embedded `mxfile` XML chunks were extracted and parsed from all seven `.drawio.png` files to verify every label, connector, edge source/target, and page.

| File | Resolution / Size | Embedded XML | Diagram Type & Verified Scope |
|---|---|---|---|
| `diagrams/use case.png` | 1926x2021 (304,343 B) | No | UML Use Case Diagram: 5 actors, 21 use-case ovals, `<<include>>` and `<<extend>>` links |
| `diagrams/class.png` | 10143x5481 (1,283,860 B) | No | UML Class Diagram: `User` abstract hierarchy (5 subclasses), 7 domain classes, 7 controller/service/DB classes |
| `diagrams/technical flow.png` | 1511x1761 (109,510 B) | No | Flowchart: login validation, availability check, `Pending` creation, Warden review, `Approved`/`Rejected` + recheck note |
| `diagrams/SAD-activity.drawio.png` | 1452x902 (139,674 B) | Yes (`activity`) | UML Activity Diagram with 3 swimlanes (`Student`, `System`, `Warden`) covering search, validation retry, pending booking, review, bed allocation/rejection, status receipt |
| `diagrams/SAD-interaction overview.drawio.png` | 1492x2235 (184,230 B) | Yes (`interaction overview`) | UML Interaction Overview Diagram referencing `SubmitBooking`, `ReviewBooking`, `AllocateBed`, `Record rejection`, `5. Notify student` |
| `diagrams/SAD-sequence.drawio.png` | 1492x832 (107,743 B) | Yes (`sequence`) | UML Sequence Diagram across `Student`, `BookingController`, `BookingService`, `Bed`, `Warden`, `AllocationService` (12 numbered messages) |
| `diagrams/SAD-communication.drawio.png` | 1380x740 (107,534 B) | Yes (`communication`) | UML Communication Diagram across same 6 objects (13 numbered messages including `13: reservationConfirmed`) |
| `diagrams/SAD-component.drawio (1).png` | 1882x687 (167,700 B) | Yes (`Page-1`) | UML Component Diagram: `Web / Client Interface`, `BookingController`, `ManagementController`, `BookingService`, `HostelService`, `AllocationService`, `MongoDBConnection` |
| `diagrams/SAD-composite.drawio.png` | 1443x602 (115,358 B) | Yes (`Page-1`) | UML Composite / Internal Structure Diagram showing controller -> service -> `Domain Model` -> `MongoDBConnection` -> `MongoDB` |
| `diagrams/SAD-state machine .drawio (2).png` | 2052x2369 (325,264 B) | Yes (`state machine `) | **Discrepancy noted below:** file and page are named `state machine`, but diagram content consists of two duplicate copies of the Component Diagram |

---

## 2. Extracted Domain Elements

### 2.1 Actors (`diagrams/use case.png` and `diagrams/class.png`)
1. **Student** (`Student` subclass of `User`): `studentId: String`, `fullName: String`, `contactNumber: String`, `email: String`; operations `manageProfile()`, `searchAvailability()`, `submitBooking()`, `cancelBooking()`, `submitComplaint()`.
2. **Warden** (`Warden` subclass of `User`): `wardenId: String`, `assignedHostelId: string`; operations `reviewBooking()`, `approveBooking()`, `rejectBooking()`, `allocateBed()`, `recordCheckIn()`, `recordCheckOut()`, `manageComplaints()`, `manageVisitorRecords()`.
3. **Administrator** (`Administrator` subclass of `User`): `adminId: String`; operations `manageHostels()`, `manageRooms()`, `manageBeds()`, `manageUsers()`, `manageRoles()`.
4. **Accounts Personnel** (`AccountsPersonnel` subclass of `User`): `employeeId: String`; operations `createPaymentRecord()`, `updatePaymentRecord()`, `viewPaymentRecords()`.
5. **Hostel Management** (`Hostel Management` subclass of `User`): operation `viewReports()` + use cases `Review audit logs`, `Generate reports`, `Search historical records`.

### 2.2 Use Cases and Actor Associations (`diagrams/use case.png`)
- **Student:** `Log in`, `Manage profile`, `Submit booking request` (`<<include>> Check bed availability`), `View/Manage Booking`, `Cancel booking` (`<<extend>> View/Manage Booking`), `Submit complaints`, `Register visitors`, `Search hostel / bed availability`.
- **Warden:** `Log in`, `Check bed availability`, `Review / approve booking` (`<<include>> Check bed availability`), `Allocate bed` (`<<include>> Check bed availability`), `Record Check in / Check out`, `Search historical records`, `Manage complaints`, `Manage visitors`.
- **Administrator:** `Log in`, `Manage hostels, rooms and beds`, `Manage users and roles`, `Review audit logs`, `Generate reports`, `Search historical records`.
- **Accounts Personnel:** `Log in`, `Generate reports`, `Maintain payment records`, `View payment records`.
- **Hostel Management:** `Review audit logs`, `Generate reports`, `Search historical records` (plus authentication inherited via `User` in `class.png`).

### 2.3 Domain Entities (`diagrams/class.png`)
- **`User` (abstract):** `userId: int`, `username: String`, `passwordHash: String`, `role: String`, `accountStatus: String`, `login(): boolean`, `logout(): void`.
- **`Hostel`:** `hostelId: string`, `hostelName: String`, `address: String`, `hostelType: String`; `1` ◆— `1..*` `Room`.
- **`Room`:** `roomId: string`, `roomNumber: String`, `capacity: int`, `roomStatus: String`; `1` ◆— `1..*` `Bed`.
- **`Bed`:** `bedId: int`, `bedNumber: String`, `bedStatus: String`, `maintenanceStatus: String`; `checkAvailability()`, `updateStatus()`.
- **`Booking`:** `bookingId: string`, `requestDate: Date`, `startDate: Date`, `endDate: Date`, `bookingStatus: String`; `submitRequest()`, `viewStatus()`, `updateStatus()`, `cancelBooking()`. Linked to `Student` (`1` to `0..*`), `Warden` (`1` to `0..*`), `Allocation` (`1` to `0..1`), `PaymentRecord` (`1` to `0..*`).
- **`Allocation`:** `allocationId: string`, `allocationDate: Date`, `startDate: Date`, `endDate: Date`, `allocationStatus: String`; `allocateBed()`, `releaseBed()`. Linked to `Bed` (`0..1` to `1`), `Booking` (`0..1` to `1`), `Warden` (`0..*` to `1`).
- **`PaymentRecord`:** `paymentId: int`, `amount: Decimal`, `paymentDate: Date`, `paymentReference: String`, `paymentStatus: String`; `createRecord()`, `updateRecord()`, `viewRecord()`.
- **`Complaint`:** `complaintId: string`, `description: String`, `submissionDate: Date`, `complaintStatus: String`, `resolutionDetails: String`; `submit()`, `updateStatus()`, `resolve()`. Linked to `Student` (`0..*` to `1`).
- **`Visitor`:** `visitorId: int`, `visitorName: String`, `contactNumber: String`, `identificationDetails: String`; `updateDetails()`. Linked `1` to `0..*` `VisitorRecord`.
- **`VisitorRecord`:** `visitRecordId: int`, `visitDate: Date`, `checkInTime: DateTime`, `checkOutTime: DateTime`, `visitStatus: String`; `registerVisit()`, `updateVisit()`. Linked `0..*` to `1` `Warden`.
- **`AuditLog`:** `logId: int`, `action: String`, `timestamp: DateTime`, `affectedRecord: String`, `recordedBy: Administrator`; `recordActivity()`, `viewLogs()`.
- **`Report`:** `reportId: int`, `reportType: String`, `generatedAt: DateTime`, `reportPeriod: String`; `generateReport()`, `applyFilters()`. Linked `0..*` to `Administrator`, `AccountsPersonnel`, `Hostel Management`.

### 2.4 Application / Service / Persistence Components (`diagrams/class.png`, `SAD-component`, `SAD-composite`)
- `Web / Client Interface`
- `Application` (`database: MongoDBConnection`, `start()`, `initialize()`)
- `BookingController` (`submitBooking`, `cancelBooking`, `getStatus`)
- `ManagementController` (`searchHostels`, `manageHostel`, `allocateBed`)
- `BookingService` (`createBooking`, `validateBooking`, `cancelBooking`)
- `HostelService` (`searchHostels`, `checkAvailability`, `updateHostel`)
- `AllocationService` (`allocateBed`, `releaseBed`, `recordCheckInOut`)
- `MongoDBConnection` (`connectionString`, `databaseName`, `connect`, `getDatabase`, `close`)

---

## 3. Source Discrepancies, Gaps, and Engineering Resolutions

| ID | Observation in Source Artifact | Resolution Adopted |
|---|---|---|
| `GAP-01` | `SAD-state machine .drawio (2).png` (page `state machine `) actually contains two duplicate copies of the Component diagram instead of a statechart. | Explicit gap documented. Booking, Allocation, Bed, Complaint, PaymentRecord, VisitorRecord, and User state machines are derived strictly from confirmed steps in `technical flow.png`, `SAD-activity.drawio.png`, `SAD-interaction overview.drawio.png`, `SAD-sequence.drawio.png`, `SAD-communication.drawio.png`, and `class.png`. |
| `GAP-02` | In `class.png`, `BookingService` lists `Complaint`'s 5 private attributes (`complaintId`, `description`, `submissionDate`, `complaintStatus`, `resolutionDetails`) due to a Figma copy-paste error, while its methods are booking operations. | `Complaint` retains those 5 fields as modeled in the `Complaint` class; `BookingService` operates on `Booking`, `Bed`, and `Allocation` repositories/models. |
| `GAP-03` | In `use case.png`, `Hostel Management` has no line to `Log in`, while `class.png` models `Hostel Management` as a concrete subclass of `User` (which owns `login()` and `logout()`). | `Hostel Management` authenticates through the unified `User.login()` / `User.logout()` endpoint (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`). |
| `GAP-04` | `use case.png` shows a stray connector line near the top-right outside the system boundary. | Ignored as a diagram drawing artifact. |
| `GAP-05` | `PaymentRecord.amount` is typed `Decimal` without a specified currency, and `Hostel`/`Room` do not specify fee fields in `class.png`. | Following `ARCHITECTURE.md` and `REQUIREMENTS.md`, store `PaymentRecord.amountMinor` (integer minor units / paise) alongside formatted `amount` display, using documented demo currency `INR` (fitting university hostel + Warden domain terminology). Payments are tracked as administrative records by `AccountsPersonnel` with no live payment gateway or card entry. |
| `GAP-06` | `use case.png` allows `Student` to `Register visitors` and `Warden` to `Manage visitors`, while `class.png` draws the `0..*` line from `VisitorRecord` toward `Warden`. | `VisitorRecord` references both `visitorId` (linking to `Visitor`), `studentId` (the registering student or visited resident), `hostelId` (for warden scoping), and `managedByWardenId`. Students can register visitors and view their own visitor requests; Wardens can register/manage/check-in/check-out/cancel visitor records. |
| `GAP-07` | `SAD-component.drawio (1).png` draws `BookingController -> ManagementController` and `HostelService -> AllocationService`, while `SAD-state machine .drawio (2).png` (duplicate component view) and `SAD-composite.drawio.png` draw controllers calling their respective services (`BookingController -> BookingService`, `ManagementController -> HostelService & AllocationService`) and all services calling `MongoDBConnection`. | Adopt the cleaner modular separation from `SAD-composite.drawio.png` and `SAD-sequence.drawio.png`: dedicated Express controllers (`auth`, `hostels`, `bookings`, `allocations`, `complaints`, `visitors`, `payments`, `users`, `auditLogs`, `reports`) backed by clean domain services (`BookingService`, `HostelService`, `AllocationService`, plus domain services for Auth/User, Complaint, Visitor, Payment, Audit, Report) sharing `MongoDBConnection`. |
| `GAP-08` | `Allocation` in `class.png` shows `Bed (1) -- (0..1) Allocation -- (0..1) Booking (1)` while also tracking `startDate`, `endDate`, `allocationStatus`. | Enforce at most one `Allocation` per `Booking` (`bookingId` unique) and at most one non-released (`Active` / `CheckedIn`) `Allocation` per `Bed` for any overlapping `[startDate, endDate]` interval, preserving historical `CheckedOut` / `Released` allocations for auditability and historical search. |
| `GAP-09` | `AuditLog` in `class.png` has `recordedBy: Administrator`, whereas mutations happen across all roles (e.g., Warden approvals, Student cancellations, Accounts payment updates). | Store `actorUserId`, `actorRole`, and `actorUsername` on `AuditLog` (plus optional `recordedBy` compatibility field) for every critical domain event, viewable by `Administrator` and `HostelManagement` per `use case.png`. |
