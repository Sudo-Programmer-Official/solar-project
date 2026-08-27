ALTER TABLE sales.appointments ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE sales.appointments ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE sales.appointments ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_sales_appointments_coordinates
  ON sales.appointments (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_appointments_street
  ON sales.appointments (region, city, hood, street);

CREATE TABLE IF NOT EXISTS analytics.territory_inventory (
  territory_key TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  hood TEXT,
  total_inventory INTEGER NOT NULL DEFAULT 0,
  worked_inventory INTEGER NOT NULL DEFAULT 0,
  available_inventory INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'PROPERTY_INTELLIGENCE',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
