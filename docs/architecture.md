# Architecture

The system is a TypeScript monorepo with one user-facing web app and one API server backed by one PostgreSQL database. A shared database does not mean shared tables: each bounded context owns a schema and its migrations.

## Database boundary

```text
PostgreSQL / solar_intelligence
├── public      lead discovery, property, solar, permit, and existing whale-lead data
├── sales       imported schedule facts used by territory intelligence
├── analytics   rebuildable territory, rep, and result rollups
└── field_ops   setter/closer users, leads, appointments, availability, notes, bills, activity, sync jobs
```

`public` remains the source for property and solar discovery. `sales.appointments` is the traceable source for the existing insights dashboard. `field_ops` is the operational system for the new setter/closer workflow. Cross-context links are explicit (`field_ops.leads.property_id` and copied appointment facts); no context reaches into another context's implementation tables for normal writes.

The web shell uses one role/permission contract for `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SETTER`, and `CLOSER`. A user can hold multiple roles; permissions are the union of those roles. Roles change data scope and actions, while feature flags control Labs modules such as lead finding, route optimization, installation signals, and experimental AI scoring. The current demo roles can be selected with `VITE_DEMO_ROLES` only for an explicitly local demo; production authentication supplies this context from the API and enforces the same permissions server-side.

Team administration follows a strict hierarchy: `MANAGER` may create and manage `SETTER`/`CLOSER` users; `ADMIN` may manage `MANAGER`/`SETTER`/`CLOSER` users; and `SUPER_ADMIN` may manage `ADMIN`/`MANAGER`/`SETTER`/`CLOSER` users and system-level permissions. Super Admin assignment remains restricted to a Super Admin.

Google Sheets is an asynchronous reporting projection. A lead or appointment mutation is saved to PostgreSQL first, then represented by a `field_ops.sheet_sync_jobs` row; the canonical appointment status remains PostgreSQL until the projection succeeds. The MVP does not deploy a worker: the API owns the queue state and can process synchronization in a later inline/server-scheduled slice.

## Deployment topology

The MVP runs one backend process and one web application:

```text
browser ── HTTPS ── apps/web ── /api ── apps/api ── PostgreSQL
                                             ├── public
                                             ├── sales
                                             ├── analytics
                                             └── field_ops
```

`apps/api` serves lead discovery, authentication, Team CRUD, field operations, Excel intelligence import, territory analytics, and reports. `apps/web` renders the complete product, including Insights. The intelligence API, intelligence web app, and worker are not part of the deployed runtime.

Production should use a database credential with access to the four application schemas. Local development can use the existing single `DATABASE_URL`; migrations are idempotent and create all schemas together.

## Core principles

- Keep connector logic isolated per municipality or source type.
- Preserve raw source data alongside normalized fields.
- Distinguish confirmed records from model-derived or user-entered information.
- Use transparent rules before any machine-learning layer.
- Treat compliance and role enforcement as first-class product constraints.
