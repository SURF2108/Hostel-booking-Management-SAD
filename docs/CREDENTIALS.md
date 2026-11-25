# Temporary Account Credentials

These initial accounts are created when running the database seed (`npm run seed`). They are intended for initial deployment setup, verification, and testing. Rotate passwords after first sign-in or override `SEED_DEMO_PASSWORD` in `.env` before seeding.

**Default Temporary Password (all seeded accounts):** `HostelDemo#2026`

## Seeded Accounts by Role

| Role | Role Code | Username | Email | Full Name | Assigned Scope |
|---|---|---|---|---|---|
| `Student` | `STU-0001` | `aarav.student` | `aarav.kulkarni@demo-hostel.edu` | Aarav Kulkarni | Active resident (`North Crest Hall`, Room 101, Bed B1) |
| `Student` | `STU-0002` | `meera.student` | `meera.deshmukh@demo-hostel.edu` | Meera Deshmukh | Approved stay (`South Pavilion`, Room 101, Bed B1) + pending booking |
| `Student` | `STU-0003` | `rohan.student` | `rohan.iyer@demo-hostel.edu` | Rohan Iyer | Pending booking (`North Crest Hall`, Room 102, Bed B1) |
| `Warden` | `WRD-0004` | `warden.north` | `devika.nair@demo-hostel.edu` | Devika Nair | Assigned to `HST-01` (`North Crest Hall`) |
| `Warden` | `WRD-0005` | `warden.south` | `vikram.joshi@demo-hostel.edu` | Vikram Joshi | Assigned to `HST-02` (`South Pavilion`) |
| `Administrator` | `ADM-0006` | `admin.hostel` | `kavita.menon@demo-hostel.edu` | Kavita Menon | Global inventory, users, roles, audit logs, and reports |
| `AccountsPersonnel` | `ACC-0007` | `accounts.desk` | `rajesh.verma@demo-hostel.edu` | Rajesh Verma | Payment records and reports |
| `HostelManagement` | `EXEC` | `management.exec` | `priya.subramanian@demo-hostel.edu` | Priya Subramanian | Executive reports, audit logs, and historical search |

## Changing Passwords

1. Sign in with any temporary account above.
2. Open **Profile** (`/profile`) in the sidebar.
3. Enter the current temporary password and your new password (minimum 8 characters), then click **Save Profile**.
4. Administrators can suspend or deactivate unused temporary accounts under **Users & Roles** (`/admin/users`).
