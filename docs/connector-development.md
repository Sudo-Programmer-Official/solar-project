# Connector Development

Every connector must implement a shared interface with:
- Metadata
- Discovery
- Page fetching
- Normalization
- Health checks
- Rate limiting

Connector development should start with:
1. Identify the official source
2. Confirm access and terms
3. Test a small record sample
4. Validate addresses
5. Enable scheduled ingestion
