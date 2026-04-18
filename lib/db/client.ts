import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// We lazy-init so that builds and local dev don't blow up when env is missing —
// only the routes that actually touch the DB will throw.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (_db) return _db;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL not set — see Appendix A.1 of the plan for Supabase setup.",
    );
  }
  const client = postgres(connectionString, {
    prepare: false, // Supabase pooler + drizzle plays best without prepared statements
    max: 1,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
