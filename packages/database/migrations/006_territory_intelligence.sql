CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS sales.uploads (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  region TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  parsed_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  diagnostics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_uploads_file_sha256 ON sales.uploads (file_sha256);

CREATE TABLE IF NOT EXISTS sales.appointments (
  id UUID PRIMARY KEY,
  upload_id UUID REFERENCES sales.uploads(id) ON DELETE SET NULL,
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  source_block INTEGER NOT NULL,
  region TEXT NOT NULL,
  appointment_date DATE,
  appointment_time TEXT,
  date_set DATE,
  customer_name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  hood TEXT,
  setter TEXT,
  closer TEXT,
  confirmed BOOLEAN,
  confirmed_raw TEXT,
  result_raw TEXT,
  result_category TEXT NOT NULL,
  setter_notes TEXT,
  closer_notes TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  raw_record JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_appointments_date ON sales.appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_sales_appointments_region_city ON sales.appointments (region, city);
CREATE INDEX IF NOT EXISTS idx_sales_appointments_setter ON sales.appointments (setter);
CREATE INDEX IF NOT EXISTS idx_sales_appointments_closer ON sales.appointments (closer);
CREATE INDEX IF NOT EXISTS idx_sales_appointments_result ON sales.appointments (result_category);
CREATE INDEX IF NOT EXISTS idx_sales_appointments_upload ON sales.appointments (upload_id);

CREATE TABLE IF NOT EXISTS analytics.territory_daily (
  territory_key TEXT NOT NULL,
  territory_date DATE NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  hood TEXT,
  total_sets INTEGER NOT NULL DEFAULT 0,
  confirmed INTEGER NOT NULL DEFAULT 0,
  sits INTEGER NOT NULL DEFAULT 0,
  closes INTEGER NOT NULL DEFAULT 0,
  cancellation_dq INTEGER NOT NULL DEFAULT 0,
  did_not_close INTEGER NOT NULL DEFAULT 0,
  credit_fails INTEGER NOT NULL DEFAULT 0,
  rescheduled INTEGER NOT NULL DEFAULT 0,
  appointment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (territory_key, territory_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_territory_daily_region_date ON analytics.territory_daily (region, territory_date);
CREATE INDEX IF NOT EXISTS idx_analytics_territory_daily_city ON analytics.territory_daily (city);

CREATE TABLE IF NOT EXISTS analytics.rep_daily (
  role TEXT NOT NULL,
  rep_name TEXT NOT NULL,
  territory_date DATE NOT NULL,
  region TEXT NOT NULL,
  total_sets INTEGER NOT NULL DEFAULT 0,
  confirmed INTEGER NOT NULL DEFAULT 0,
  sits INTEGER NOT NULL DEFAULT 0,
  closes INTEGER NOT NULL DEFAULT 0,
  cancellation_dq INTEGER NOT NULL DEFAULT 0,
  did_not_close INTEGER NOT NULL DEFAULT 0,
  credit_fails INTEGER NOT NULL DEFAULT 0,
  rescheduled INTEGER NOT NULL DEFAULT 0,
  appointment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, rep_name, territory_date, region)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rep_daily_date ON analytics.rep_daily (territory_date);
CREATE INDEX IF NOT EXISTS idx_analytics_rep_daily_role ON analytics.rep_daily (role);

CREATE TABLE IF NOT EXISTS analytics.result_daily (
  result_category TEXT NOT NULL,
  territory_date DATE NOT NULL,
  region TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  appointment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (result_category, territory_date, region)
);

CREATE INDEX IF NOT EXISTS idx_analytics_result_daily_date ON analytics.result_daily (territory_date);
