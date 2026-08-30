# Territory intelligence bounded context

Territory intelligence is integrated into the existing lead-discovery and field-operations platform. It owns Excel sales ingestion, normalized appointment facts, deterministic rollups, territory scoring, and the web app's Insights page.

## Runtime surfaces

- `apps/web` — the single Vite/Vue product shell and Insights page.
- `apps/api` — the single API server for upload, dashboard, filters, drill-down, and trace endpoints.
- `packages/analytics-contracts` — shared appointment and dashboard contracts.
- `packages/territory-scoring` — Excel block detection, normalization, deduplication, aggregation, and opportunity scoring.
- `packages/geo-core` — territory labels, region normalization, coordinate validation, city centroids, stable fallback offsets, and future geocoding boundaries.

## Data boundaries

The existing public-schema lead/property tables remain unchanged. Migrations `006_territory_intelligence.sql` and `007_territory_coordinates_and_inventory.sql` create:

- `sales.uploads` and `sales.appointments` as the traceable source-of-truth facts.
- `analytics.territory_daily`, `analytics.rep_daily`, and `analytics.result_daily` as rebuildable rollups.
- Optional `street`, `latitude`, and `longitude` fields on appointments, plus coordinate/street indexes. Exact property coordinates are used when supplied; current schedule files fall back to a labeled city-centroid point.

Every rollup stores the appointment UUIDs that contributed to it. The API also exposes `GET /api/v1/intelligence/appointments` so a dashboard filter can be drilled back to the normalized rows and their original file/sheet/row/block coordinates.

## Importing schedules

The API imports `.xlsx` files through `POST /api/v1/intelligence/uploads` as multipart field `file` with `?region=EAST|WEST`. Parsing, deduplication, persistence, and analytics rebuild run inline in the single API process; there is no worker deployment.

The parser detects repeated `Time` / `Customer Name` blocks rather than assuming a fixed 7-day width. It handles overflow rows, inherits a time across blank continuation rows in the same block, handles `Bill?` column variants, text and Excel-date headers, template sheets, and workbook week labels. West sheets with weekday-only headers inherit their week date from an explicit dated week in the same workbook.

The source workbooks do not contain dedicated street, hood/neighborhood, or coordinate fields. Those fields stay nullable until a trusted address/property source is introduced; city remains the first-level territory key rather than inventing a neighborhood from free-text notes. The dashboard supports the full city → hood → street hierarchy as soon as those fields arrive.

## Metric semantics

- Total sets: one normalized appointment row.
- Confirmed: `Confirmed?` explicitly parses as yes/confirmed/triple.
- Sits: `CLOSED`, `DID_NOT_CLOSE`, or `CREDIT_FAIL`.
- Closes: normalized result `CLOSED`.
- Cancellation/DQ: `CANCELLED_DQ` or `RESCHEDULED`.
- Set-to-close: closes ÷ total sets.
- Close rate: Bayesian-smoothed closes ÷ sits; the API also exposes the observed rate.
- Sit rate: Bayesian-smoothed sits ÷ sets.
- Momentum: smoothed recent 7-day close performance compared with smoothed recent 30-day close performance, anchored to the latest dated appointment in the selected view.
- Saturation: recent 7-day set pace compared with the expected 7-day pace implied by the recent 30-day window.
- Opportunity score: a transparent weighted score with component contributions for recent performance, sample sufficiency, close rate, sit rate, set density, 7-day momentum, cancellation/DQ rate, days since worked, saturation, and available/unworked capacity.
- Confidence: `LOW` below 10 sets, `MEDIUM` from 10–29 sets, and `HIGH` at 30+ sets. Deployment recommendations only use territories meeting the minimum sample threshold.
- Available/unworked capacity: currently an observed-capacity proxy because the uploaded schedules contain no property inventory. It is explicitly labeled in the score breakdown so a later Solaris property inventory can replace it.

## Prescriptive surfaces

- `GET /api/v1/intelligence/dashboard` returns map layers, traceable score breakdowns, and `deploymentPlan` with up to three recommendations, suggested reps, reasons, confidence, avoid areas, trend, and unworked capacity.
- `GET /api/v1/intelligence/territories` returns the next hierarchy level: cities by default, hoods when `city` is supplied, and streets when both `city` and `hood` are supplied.
- The map uses OpenStreetMap tiles in the browser and exact appointment/property coordinates when available. Point color/size can switch between sets, sits, closes, cancellation/DQ, close rate, 7-day momentum, saturation, and final opportunity.

No AI step is required for ingestion, scoring, deployment planning, or drill-down. Solaris property intelligence can later attach property coordinates and known inventory to `sales.appointments` or territory keys without changing the lead-discovery tables.

## Local development fallback

`npm run dev` starts only `apps/api` and `apps/web`. PostgreSQL is the production source of truth; schedule imports are submitted to the API endpoint rather than processed by a worker.
