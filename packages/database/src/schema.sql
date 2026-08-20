CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY,
  normalized_address TEXT NOT NULL,
  street TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  parcel_id TEXT,
  municipality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_normalized_address ON properties (normalized_address);
CREATE INDEX IF NOT EXISTS idx_properties_postal_code ON properties (postal_code);
CREATE INDEX IF NOT EXISTS idx_properties_municipality ON properties (municipality);
CREATE INDEX IF NOT EXISTS idx_properties_county ON properties (county);

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

CREATE TABLE IF NOT EXISTS solar_assessments (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_building_id TEXT,
  imagery_date DATE,
  imagery_processed_date DATE,
  imagery_quality TEXT,
  roof_area_meters2 NUMERIC,
  ground_area_meters2 NUMERIC,
  max_array_area_meters2 NUMERIC,
  max_array_panels_count INTEGER,
  panel_capacity_watts INTEGER,
  max_sunshine_hours_per_year NUMERIC,
  estimated_max_system_kw NUMERIC,
  estimated_annual_production_kwh NUMERIC,
  existing_solar_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  existing_solar_confidence NUMERIC,
  roof_complexity_score NUMERIC,
  shade_score NUMERIC,
  orientation_score NUMERIC,
  solar_fit_score NUMERIC NOT NULL DEFAULT 0,
  solar_fit_confidence NUMERIC NOT NULL DEFAULT 0,
  assessment_version TEXT NOT NULL,
  provider_payload_reference TEXT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solar_assessments_score ON solar_assessments (solar_fit_score);
CREATE INDEX IF NOT EXISTS idx_solar_assessments_property_assessed_at ON solar_assessments (property_id, assessed_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS solar_assessment_audits (
  solar_assessment_id UUID PRIMARY KEY REFERENCES solar_assessments(id) ON DELETE CASCADE,
  audit_json JSONB NOT NULL,
  score_breakdown_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roof_segments (
  id UUID PRIMARY KEY,
  solar_assessment_id UUID NOT NULL REFERENCES solar_assessments(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  area_meters2 NUMERIC,
  pitch_degrees NUMERIC,
  azimuth_degrees NUMERIC,
  sunshine_hours NUMERIC,
  panels_count INTEGER,
  yearly_energy_dc_kwh NUMERIC
);

CREATE TABLE IF NOT EXISTS property_signals (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  source TEXT NOT NULL,
  value_json JSONB NOT NULL,
  confidence NUMERIC NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_property_signals_property_observed_at ON property_signals (property_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS usage_profiles (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  annual_usage_kwh NUMERIC,
  monthly_average_kwh NUMERIC,
  peak_month_kwh NUMERIC,
  monthly_bill_average NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_profiles_property_created_at ON usage_profiles (property_id, created_at DESC);

CREATE TABLE IF NOT EXISTS permit_records (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  municipality TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  permit_number TEXT,
  permit_type TEXT NOT NULL,
  status TEXT NOT NULL,
  application_date DATE,
  issued_date DATE,
  contractor_name TEXT,
  source_provider TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permit_records_type_status ON permit_records (permit_type, status);
CREATE INDEX IF NOT EXISTS idx_permit_records_property_date ON permit_records (property_id, issued_date DESC, application_date DESC, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS market_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  label TEXT NOT NULL,
  current_location_label TEXT NOT NULL,
  center_location GEOGRAPHY(POINT, 4326),
  center_latitude DOUBLE PRECISION,
  center_longitude DOUBLE PRECISION,
  radius_miles NUMERIC,
  coverage_level TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  market_score NUMERIC NOT NULL DEFAULT 0,
  score_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_areas_location ON market_areas USING GIST (center_location);
CREATE INDEX IF NOT EXISTS idx_market_areas_geography_type ON market_areas (geography_type);

CREATE TABLE IF NOT EXISTS market_area_scores (
  id UUID PRIMARY KEY,
  market_area_id TEXT NOT NULL REFERENCES market_areas(id) ON DELETE CASCADE,
  roof_activity NUMERIC NOT NULL DEFAULT 0,
  construction_activity NUMERIC NOT NULL DEFAULT 0,
  solar_momentum NUMERIC NOT NULL DEFAULT 0,
  solar_saturation NUMERIC NOT NULL DEFAULT 0,
  large_property_density NUMERIC NOT NULL DEFAULT 0,
  high_capacity_roof_density NUMERIC NOT NULL DEFAULT 0,
  property_value_signal NUMERIC NOT NULL DEFAULT 0,
  electrical_upgrade_activity NUMERIC NOT NULL DEFAULT 0,
  data_confidence NUMERIC NOT NULL DEFAULT 0,
  market_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_area_scores_market_area_id ON market_area_scores (market_area_id);

CREATE TABLE IF NOT EXISTS market_events (
  id TEXT PRIMARY KEY,
  market_area_id TEXT NOT NULL REFERENCES market_areas(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  address TEXT,
  municipality TEXT,
  county TEXT,
  state TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  issued_date DATE,
  status TEXT,
  estimated_value NUMERIC,
  source TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC NOT NULL DEFAULT 0,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_events_issued_date ON market_events (issued_date);
CREATE INDEX IF NOT EXISTS idx_market_events_location ON market_events USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_market_events_type ON market_events (type);
CREATE INDEX IF NOT EXISTS idx_market_events_source_record_id ON market_events (source_record_id);

CREATE TABLE IF NOT EXISTS market_event_sources (
  id UUID PRIMARY KEY,
  market_area_id TEXT REFERENCES market_areas(id) ON DELETE SET NULL,
  provider_id TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC NOT NULL DEFAULT 0,
  source_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_event_sources_provider_id ON market_event_sources (provider_id);
CREATE INDEX IF NOT EXISTS idx_market_event_sources_source_record_id ON market_event_sources (source_record_id);

CREATE TABLE IF NOT EXISTS market_ingestion_runs (
  id UUID PRIMARY KEY,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL,
  center_latitude DOUBLE PRECISION,
  center_longitude DOUBLE PRECISION,
  radius_miles NUMERIC,
  date_from DATE,
  date_to DATE,
  events_ingested INTEGER NOT NULL DEFAULT 0,
  areas_touched INTEGER NOT NULL DEFAULT 0,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_ingestion_runs_provider_id ON market_ingestion_runs (provider_id);
CREATE INDEX IF NOT EXISTS idx_market_ingestion_runs_started_at ON market_ingestion_runs (started_at);

CREATE TABLE IF NOT EXISTS lead_outcomes (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rep_id TEXT,
  outcome TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_outcomes_outcome ON lead_outcomes (outcome);

CREATE TABLE IF NOT EXISTS opportunity_assessments (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  solar_fit_score NUMERIC NOT NULL DEFAULT 0,
  usage_opportunity_score NUMERIC NOT NULL DEFAULT 0,
  system_size_score NUMERIC NOT NULL DEFAULT 0,
  permit_signal_score NUMERIC NOT NULL DEFAULT 0,
  field_priority_score NUMERIC NOT NULL DEFAULT 0,
  whale_score NUMERIC NOT NULL DEFAULT 0,
  overall_opportunity_score NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  score_version TEXT NOT NULL,
  explanation_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_assessments_score ON opportunity_assessments (overall_opportunity_score);
CREATE INDEX IF NOT EXISTS idx_opportunity_assessments_whale_score ON opportunity_assessments (whale_score);
CREATE INDEX IF NOT EXISTS idx_opportunity_assessments_property_created_at ON opportunity_assessments (property_id, created_at DESC);
