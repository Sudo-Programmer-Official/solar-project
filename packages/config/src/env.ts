import fs from "node:fs";
import path from "node:path";

export interface AppEnv {
  databaseUrl?: string;
  databaseHost?: string;
  databasePort?: number;
  databaseName?: string;
  databaseUser?: string;
  databasePassword?: string;
  databaseSsl?: boolean;
  googleGeocodingApiKey?: string;
  googleSolarApiKey?: string;
  googleMapsImageryApiKey?: string;
  googleMapsStaticApiKey?: string;
  googleStreetViewApiKey?: string;
  port?: number;
  apiPort?: number;
  corsAllowedOrigins?: string;
  locationMatchThresholdMeters?: number;
}

export function loadAppEnv(
  source: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AppEnv {
  const searchDirs = [cwd];
  const rootDir = path.resolve(cwd, "..", "..");
  if (!searchDirs.includes(rootDir)) {
    searchDirs.push(rootDir);
  }

  const fileEnv = searchDirs.reduce<Record<string, string>>((acc, dir) => {
    return {
      ...acc,
      ...readEnvFile(path.join(dir, ".env")),
      ...readEnvFile(path.join(dir, ".env.local")),
    };
  }, {});
  const merged = {
    ...fileEnv,
    ...source,
  };
  const databasePort = parseOptionalInt(merged.DATABASE_PORT);
  return {
    databaseUrl: merged.DATABASE_URL,
    databaseHost: merged.DATABASE_HOST,
    databasePort,
    databaseName: merged.DATABASE_NAME,
    databaseUser: merged.DATABASE_USER,
    databasePassword: merged.DATABASE_PASSWORD,
    databaseSsl: parseOptionalBoolean(merged.DATABASE_SSL),
    googleGeocodingApiKey: merged.GOOGLE_GEOCODING_API_KEY,
    googleSolarApiKey: merged.GOOGLE_SOLAR_API_KEY,
    googleMapsImageryApiKey: merged.GOOGLE_MAPS_IMAGERY_API_KEY,
    googleMapsStaticApiKey: merged.GOOGLE_MAPS_STATIC_API_KEY,
    googleStreetViewApiKey: merged.GOOGLE_STREET_VIEW_API_KEY,
    port: parseOptionalInt(merged.PORT) ?? parseOptionalInt(merged.API_PORT) ?? 4000,
    apiPort: parseOptionalInt(merged.API_PORT),
    corsAllowedOrigins: merged.CORS_ALLOWED_ORIGINS,
    locationMatchThresholdMeters: parseOptionalInt(merged.LOCATION_MATCH_THRESHOLD_METERS) ?? 10,
  };
}

export function validateRequiredEnv(env: AppEnv): string[] {
  const missing: string[] = [];
  if (!env.databaseUrl && (!env.databaseHost || !env.databaseName || !env.databaseUser)) {
    missing.push("DATABASE_URL or DATABASE_HOST/DATABASE_NAME/DATABASE_USER");
  }
  if (!env.googleSolarApiKey) {
    missing.push("GOOGLE_SOLAR_API_KEY");
  }
  if (!env.googleGeocodingApiKey) {
    missing.push("GOOGLE_GEOCODING_API_KEY");
  }
  return missing;
}

export function validateSolarApiEnv(env: AppEnv): string[] {
  const missing: string[] = [];
  if (!env.googleSolarApiKey) {
    missing.push("GOOGLE_SOLAR_API_KEY");
  }
  return missing;
}

export function validateGeocodingEnv(env: AppEnv): string[] {
  const missing: string[] = [];
  if (!env.googleGeocodingApiKey) {
    missing.push("GOOGLE_GEOCODING_API_KEY");
  }
  return missing;
}

export function buildDatabaseUrl(env: AppEnv): string | null {
  if (env.databaseUrl) return env.databaseUrl;
  if (!env.databaseHost || !env.databaseName || !env.databaseUser) return null;

  const port = env.databasePort ?? 5432;
  const password = env.databasePassword ? encodeURIComponent(env.databasePassword) : "";
  const user = encodeURIComponent(env.databaseUser);
  const sslmode = env.databaseSsl === false ? "disable" : "require";

  return `postgresql://${user}:${password}@${env.databaseHost}:${port}/${env.databaseName}?sslmode=${sslmode}`;
}

export function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).replace(/^export\s+/, "").trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.length === 0) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  return undefined;
}
