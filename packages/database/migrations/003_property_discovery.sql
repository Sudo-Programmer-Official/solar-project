CREATE TABLE IF NOT EXISTS property_discoveries (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC NOT NULL DEFAULT 0,
  discovery_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_discoveries_property_id ON property_discoveries (property_id);
CREATE INDEX IF NOT EXISTS idx_property_discoveries_provider ON property_discoveries (provider);
