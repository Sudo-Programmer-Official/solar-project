declare module "pg" {
  export class Pool {
    constructor(config: Record<string, unknown>);
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  }
}
