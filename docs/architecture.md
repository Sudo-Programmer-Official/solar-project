# Architecture

The system is organized as a TypeScript monorepo with separate apps for web, API, worker, and admin surfaces.

Core principles:
- Keep connector logic isolated per municipality or source type
- Preserve raw source data alongside normalized fields
- Distinguish confirmed records from model-derived or user-entered information
- Use transparent rules before any machine-learning layer
- Treat compliance as a first-class product constraint

Initial implementation targets West Newton, Pennsylvania and Westmoreland County, but connectors must be pluggable for future municipalities.
