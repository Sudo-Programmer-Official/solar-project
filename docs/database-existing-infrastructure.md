# Existing Database Infrastructure

Reference inspection status:
- The requested `job-hunter-app/backend` directory exists, but it does not contain readable source files in this workspace snapshot.
- The shared RDS target was recovered from `agentic-sdlc-platform`.

Reusable pattern adopted for `solar-project`:
- Keep `DATABASE_URL` as the preferred runtime input
- Support split env vars for host, port, db name, user, password, and SSL
- Keep database credentials server-side only
- Separate schema definition from application logic
- Use Postgres + PostGIS with explicit migrations

Recovered shared instance shape:
- Host: `agentic-lifecycle-dev-db.cormemeo4zhv.us-east-1.rds.amazonaws.com`
- Port: `5432`
- User: `postgres`
- SSL: required (`ssl=require`)
- Current database in that env: `postgres`
- Password: present in the source env file, but redacted here

Solar project reuse plan:
- Point `solar-project` at the same host and user
- Create a new database named `solar_intelligence`
- Keep the password identical to the shared instance secret stored in `agentic-sdlc-platform`

Required changes for the solar project:
- Add a dedicated `solar_intelligence` database
- Enable `postgis`
- Apply the schema in `packages/database/src/schema.sql`
- Wire env loading and validation before database access

CREATE DATABASE permission:
- Could not be determined from the reference backend because no source files or connection scripts were available.

If the operator confirms the RDS user has `CREATE DATABASE`, the safe command is:

```sql
CREATE DATABASE solar_intelligence;
\c solar_intelligence
CREATE EXTENSION IF NOT EXISTS postgis;
```

If the user does not have permission, the operator must run the same SQL as a privileged RDS admin or create the database through the AWS console / managed Postgres admin tool.
