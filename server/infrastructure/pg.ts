/**
 * PostgreSQL connection pool (node-postgres / pg).
 *
 * ARCHITECTURE: infrastructure adapter detail — only database adapters in
 * `server/infrastructure` may import this. Domain and API layers interact
 * exclusively through repository ports.
 *
 * LIFECYCLE: Lazily creates a connection pool from `DATABASE_URL`.
 * In production (`IS_PROD`), SSL is enabled with rejectUnauthorized: false
 * (compatible with hosted clouds like Neon, Supabase, AWS RDS, Render, etc).
 */
import pg from 'pg';
import { DATABASE_URL, IS_PROD } from '../config/index';

const { Pool } = pg;

export interface PostgresQueryResult<R = any> {
  rows: R[];
  rowCount?: number | null;
}

export interface PostgresExecutor {
  query<R extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<PostgresQueryResult<R>>;
}

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in configuration');
    }
    const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
    const useSsl = IS_PROD && !isLocalhost;

    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Default shared Postgres executor backed by `getPgPool()`.
 */
export const pgExecutor: PostgresExecutor = {
  async query<R extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<PostgresQueryResult<R>> {
    const p = getPgPool();
    const result = await p.query<R>(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  },
};
