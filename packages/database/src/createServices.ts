import { createRequire } from "node:module";

const requireSqlite = createRequire(import.meta.url);

type SqlValue = string | number | bigint | null;

export type Database = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...anonymousParameters: SqlValue[]): unknown[];
    get(...anonymousParameters: SqlValue[]): unknown;
    run(...anonymousParameters: SqlValue[]): { changes: number | bigint };
  };
};

type SqliteModule = {
  DatabaseSync: new (location: string) => Database;
};

export function createServices(): { database: Database } {
  const { DatabaseSync } = requireSqlite("node:sqlite") as SqliteModule;
  return { database: new DatabaseSync(":memory:") };
}
