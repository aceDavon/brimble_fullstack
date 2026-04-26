import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Single connection for migrations, pooled client for queries
const migrationClient = postgres(connectionString, { max: 1 });
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });
