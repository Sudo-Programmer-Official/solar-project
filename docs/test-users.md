# Development test users

These accounts are for local development, staging, and QA only. They must never be seeded into production.

Run the guarded seed command with an explicit opt-in:

```sh
NODE_ENV=development ALLOW_TEST_USERS=true npm run db:seed:test-users
```

`db:seed:test-users` applies the current migrations and creates or updates only the accounts in `field_ops.users`. It replaces their normalized `field_ops.user_roles` membership, assigns the default team, and hashes the password with the same scrypt implementation used by `/auth/login`. It is safe to rerun and does not store plaintext passwords.

To seed the accounts plus linked field-operation QA data, use:

```sh
NODE_ENV=development ALLOW_TEST_USERS=true npm run db:seed:qa
```

The QA seed adds five deterministic leads and four linked appointments: Lead A is an unassigned 6:30 PM appointment, Lead B is a `NO_SHOW`, Lead C is `INTERESTED` with no bill, Lead D is `CLOSED` with bill metadata, and Lead E is `FOLLOW_UP`. It also adds notes, activity records, sheet-sync jobs, and deterministic closer-capacity slots. The bill is metadata only; no file-storage service is required.

| Email | Role(s) | Development password | Primary UI |
| --- | --- | --- | --- |
| `setter@test.local` | `SETTER` | `SolarTest123!` | Home, Leads, Schedule |
| `closer@test.local` | `CLOSER` | `SolarTest123!` | Home, Leads, Appointments, Schedule |
| `settercloser@test.local` | `SETTER`, `CLOSER` | `SolarTest123!` | Union of Setter and Closer access |
| `manager@test.local` | `MANAGER` | `SolarTest123!` | Operations, Team, assignments, Reports, Insights |
| `admin@test.local` | `ADMIN` | `SolarTest123!` | Team, administration, Reports, Insights |
| `superadmin@test.local` | `SUPER_ADMIN` | `SolarTest123!` | Full permitted platform access, Labs, system controls |

Both seed commands refuse to run when `NODE_ENV=production` and require `ALLOW_TEST_USERS=true`. Rerunning either command does not duplicate the seeded users, roles, leads, appointments, notes, or bill metadata; unrelated users and records are left untouched.

To remove only marked QA field-operation records while keeping every user and RBAC record, run:

```sh
NODE_ENV=development ALLOW_TEST_USERS=true npm run db:clean:qa-data
```

The cleanup is production-blocked, idempotent, and deletes only rows with `is_test_data = TRUE` from the field leads, appointments, availability, notes, bill metadata, activity, and Sheet-sync tables. Leads created through the app are not marked as test data and are preserved.

After seeding, use the login screen and log out between each account. The navigation is driven by the authenticated `/auth/me` response, not `VITE_DEMO_ROLE`.
