-- Market Intelligence V2 keeps discovery honest and resumable. A scan records
-- its last checkpoint and market funnel separately from canonical lead data.
CREATE TABLE IF NOT EXISTS discovery_scan_runs (
  scan_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  stage TEXT,
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_miles NUMERIC NOT NULL,
  checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  funnel_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_discovery_scan_runs_status_updated
  ON discovery_scan_runs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS discovery_scan_cells (
  id UUID PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES discovery_scan_runs(scan_id) ON DELETE CASCADE,
  cell_key TEXT NOT NULL,
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_miles NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNSCANNED'
    CHECK (status IN ('UNSCANNED', 'DISCOVERED', 'VERIFIED', 'SOLAR_ANALYZED', 'COMPLETE')),
  discovered_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  solar_analyzed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scan_id, cell_key)
);

CREATE INDEX IF NOT EXISTS idx_discovery_scan_cells_scan_status
  ON discovery_scan_cells (scan_id, status);

CREATE TABLE IF NOT EXISTS property_verifications (
  id UUID PRIMARY KEY,
  scan_id TEXT REFERENCES discovery_scan_runs(scan_id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('VERIFIED', 'REVIEW', 'REJECTED', 'UNKNOWN')),
  verification_score NUMERIC NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  checks_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_provider TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_verifications_property_time
  ON property_verifications (property_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS market_exclusions (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  exclusion_state TEXT NOT NULL
    CHECK (exclusion_state IN ('NO_KNOWN_SOLAR', 'SOLAR_DETECTED', 'KNOWN_INSTALL', 'PARTNER_INELIGIBLE', 'MANUAL_EXCLUSION', 'UNKNOWN')),
  exclusion_type TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC NOT NULL DEFAULT 0,
  installer_name TEXT,
  system_size_kw NUMERIC,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_exclusions_property_state
  ON market_exclusions (property_id, exclusion_state, observed_at DESC);

CREATE TABLE IF NOT EXISTS partner_eligibility_rules (
  id UUID PRIMARY KEY,
  partner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_eligibility_rules_key
  ON partner_eligibility_rules (partner_key);

CREATE TABLE IF NOT EXISTS property_partner_eligibility (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  partner_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ELIGIBLE', 'INELIGIBLE', 'REQUIRES_REVIEW')),
  reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (property_id, partner_key)
);

CREATE TABLE IF NOT EXISTS field_learning_events (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  scan_id TEXT REFERENCES discovery_scan_runs(scan_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID,
  notes TEXT,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_learning_events_property_time
  ON field_learning_events (property_id, occurred_at DESC);
