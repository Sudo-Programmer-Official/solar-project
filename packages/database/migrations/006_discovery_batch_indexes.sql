CREATE INDEX IF NOT EXISTS idx_solar_assessments_property_assessed_at
  ON solar_assessments (property_id, assessed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_signals_property_observed_at
  ON property_signals (property_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_profiles_property_created_at
  ON usage_profiles (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_permit_records_property_date
  ON permit_records (property_id, issued_date DESC, application_date DESC, retrieved_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_assessments_property_created_at
  ON opportunity_assessments (property_id, created_at DESC);
