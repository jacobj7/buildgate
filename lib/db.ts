import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool: Pool | undefined };

const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pool = pool;
}

export default pool;
