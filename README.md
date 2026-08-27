# Solar Territory Intelligence Platform

TypeScript monorepo for the SolarScout lead-discovery, field-operations, and territory-intelligence platform.

Current contents:
- Workspace layout for apps and packages
- Shared contracts for permits, properties, scoring, and compliance
- Transparent opportunity scoring logic
- Connector interface and metadata model
- Initial docs for architecture, data sources, compliance, and connector development

The production boundary is one user-facing `apps/web` application and one `apps/api` server backed by PostgreSQL. Territory intelligence is integrated into the API and the web app's Insights page; no worker process or second API is required. See [docs/territory-intelligence.md](docs/territory-intelligence.md) for data boundaries, metric semantics, and API import instructions.
