ALTER TABLE lead_outcomes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_lead_outcomes_updated_at ON lead_outcomes (updated_at DESC, created_at DESC);
