# Google Solar API Policy

This project uses Google Solar API and Google Geocoding only on the server.

Official references:
- [Google Solar API reference](https://developers.google.com/maps/documentation/solar/reference/rest)
- [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms)

## A. Data We Receive From Google

- Geocoded coordinates and formatted addresses
- Solar building metadata
- Imagery metadata
- Detected-array status and capture dates
- Solar potential and production estimates
- Roof segment statistics and modeled configurations

## B. Permitted Identifiers

- Google `buildingId` values
- Google `place_id` values
- Google-derived coordinates
- Request coordinates used for server-side analysis

## C. Our Own Independently-Created Business Data

- Property records
- Territory and jurisdiction records
- Lead outcomes
- Permit records
- Usage profiles
- Opportunity assessments
- Audit notes and operational warnings

## D. Derived Scores / Evaluations

- Solar fit score
- Solar score confidence
- Roof complexity evaluation
- Usable roof evaluation
- System size evaluation
- Existing-solar evaluation
- Whale score
- Opportunity score

Derived fields are our own internal analytics and may be stored independently from the Google payload that produced them.

## E. Field Observations

- Manual verification notes
- Field rep notes
- Roof condition observations
- Customer-provided usage notes
- Inspection outcomes

## Storage and Caching

Google Solar content is not cached permanently as raw provider responses.

Allowed:
- Persist normalized business records
- Persist derived scores and audit summaries
- Persist Google identifiers required to link a property back to its analysis

Restricted:
- Do not retain raw Google response bodies indefinitely
- Do not treat raw provider payloads as a durable source of truth
- Do not use Google content outside the intended server-side analysis flow

## AssessmentRefreshPolicy

When a property is re-analyzed:

1. Reuse our own persisted property, score, and audit records.
2. Refresh Google-backed fields only when the cached assessment is stale or the input identity materially changes.
3. Re-run Google Geocoding when the address identity is uncertain or missing coordinates.
4. Re-run Google Solar when the location changes, the audit is incomplete, or a refresh is explicitly requested.
5. Keep our derived score history and field observations permanent unless corrected by a later internal record.

## Uncertain Policy Handling

If a field’s retention status is unclear, mark it:

`LEGAL/POLICY REVIEW REQUIRED`

Do not silently keep it in durable storage without review.

## Operational Notes

- `GOOGLE_GEOCODING_API_KEY` and `GOOGLE_SOLAR_API_KEY` must remain server-side only.
- The debug endpoint is development/admin only.
- Permit connectors remain out of scope for this slice.
