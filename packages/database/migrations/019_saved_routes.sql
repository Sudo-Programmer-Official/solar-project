-- Persist the properties a field rep has added to their current working route.
-- A team route is shared by everyone on that team; users without a team get
-- their own route. The route optimizer tables remain separate from this
-- lightweight saved selection workspace.
CREATE TABLE IF NOT EXISTS field_ops.routes (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES field_ops.teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE')),
  starting_latitude DOUBLE PRECISION,
  starting_longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starting_latitude IS NULL OR starting_latitude BETWEEN -90 AND 90),
  CHECK (starting_longitude IS NULL OR starting_longitude BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_routes_active_team
  ON field_ops.routes (team_id)
  WHERE status = 'ACTIVE' AND team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_routes_active_owner
  ON field_ops.routes (owner_user_id)
  WHERE status = 'ACTIVE' AND team_id IS NULL;

CREATE TABLE IF NOT EXISTS field_ops.route_items (
  id UUID PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES field_ops.routes(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  status TEXT NOT NULL DEFAULT 'ADDED' CHECK (status IN ('ADDED', 'VISITED', 'SKIPPED')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_route_items_route_position
  ON field_ops.route_items (route_id, position);

CREATE INDEX IF NOT EXISTS idx_field_ops_route_items_property
  ON field_ops.route_items (property_id);
