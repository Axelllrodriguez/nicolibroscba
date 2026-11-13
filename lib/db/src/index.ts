import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/nicolibros";

const isRemote =
  !connectionString.includes("localhost") &&
  !connectionString.includes("127.0.0.1");

export const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: process.env["VERCEL"] === "1" ? 1 : 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
export * from "drizzle-orm";
