ALTER TABLE solar_assessments
  ADD COLUMN IF NOT EXISTS imagery_processed_date DATE;

CREATE TABLE IF NOT EXISTS solar_assessment_audits (
  solar_assessment_id UUID PRIMARY KEY REFERENCES solar_assessments(id) ON DELETE CASCADE,
  audit_json JSONB NOT NULL,
  score_breakdown_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
