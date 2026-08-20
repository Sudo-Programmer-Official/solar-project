import type { SqlClient } from "./repository";

export interface PostgresPoolLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end?: () => Promise<void>;
}

export async function createPostgresClient(dsn: string): Promise<PostgresPoolLike> {
  const pg = await import("pg");
  const Pool = (pg as any).Pool;
  const normalizedDsn = normalizeConnectionString(dsn);
  const pool = new Pool({
    connectionString: normalizedDsn,
    ssl: shouldUseSsl(normalizedDsn) ? { rejectUnauthorized: false } : undefined,
  });
  return pool as PostgresPoolLike;
}

export function wrapPool(pool: PostgresPoolLike): SqlClient {
  return {
    query(sql: string, params?: unknown[]) {
      return pool.query(sql, params);
    },
  };
}

function shouldUseSsl(dsn: string): boolean {
  return /sslmode=require/i.test(dsn) || /amazonaws\.com/i.test(dsn);
}

function normalizeConnectionString(dsn: string): string {
  try {
    const url = new URL(dsn.replace("postgresql+asyncpg://", "postgresql://"));
    url.searchParams.delete("ssl");
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return dsn
      .replace(/[?&]ssl=require\b/i, "")
      .replace(/[?&]sslmode=require\b/i, "")
      .replace(/[?&]sslmode=prefer\b/i, "")
      .replace(/[?&]sslmode=disable\b/i, "");
  }
}
