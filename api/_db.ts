import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DB_URL ||
  process.env.PG_CONNECTION ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

if (!connectionString) {
  console.warn("[db] DB_URL не задан — БД недоступна");
}

// Keep certificate verification enabled, including when a provider URL uses sslmode=require.
let safeConnection: URL | null = null;
try {
  if (connectionString) safeConnection = new URL(connectionString);
} catch {
  /* pg also supports non-URI connection strings. */
}
for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  safeConnection?.searchParams.delete(key);
export const pool = new Pool({
  connectionString: safeConnection?.toString() || connectionString,
  ssl: {
    rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA
      ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") }
      : {}),
  },
  max: 3,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );

  const client = await pool.connect();
  try {
    const result = await client.query(text, values);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}
