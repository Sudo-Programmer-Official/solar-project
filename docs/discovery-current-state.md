# Discovery Current State

## What `POST /api/v1/discovery/scan` used to do

Before the area-discovery refactor, the scan path only queried the existing `properties` table through `repository.listProperties()`.

The scan flow:

1. loaded known properties already stored in the database
2. filtered them by distance from the requested center
3. ranked the surviving rows
4. optionally analyzed the top rows with Google Solar

That meant discovery never expanded the property graph.

## Why West Newton worked

West Newton already had persisted property rows and cached solar assessments in the database, so the old scan path had something to rank.

## Why Altoona returned zero

`3312 Pleasant Valley Blvd, Altoona, PA 16602` resolved correctly, but the database did not contain nearby residential properties for that area.

Because the old scan path only looked at stored rows, Altoona produced:

- `candidateCount: 0`
- `analyzedCount: 0`
- `googleSolarCalls: 0`

That was not a real coverage signal. It was a database coverage gap.

## New discovery model

The updated scan flow is staged:

1. rank known local properties already in the database
2. expand using a provider-neutral property discovery provider
3. persist new residential properties into the graph
4. run Google Solar only on the highest-value candidates
5. return scan progress and final ranked leads

## Important separation

Property discovery is not the same thing as solar analysis.

- discovery finds candidate residential buildings/parcels
- Google Solar enriches known candidates
- ranking and whale scoring happen after discovery

## Current limitations

- discovery coverage depends on configured external providers
- if no provider has coverage for a requested area, the API returns `DATA_COVERAGE_UNAVAILABLE`
- Google Solar is never used to enumerate houses
