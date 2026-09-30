import { createRequire } from "node:module";
import { seedTickets } from "./seed";

const requireSqlite = createRequire(import.meta.url);

export type SqlValue = string | number | bigint | null;

export type SqlStatement = {
  all(...anonymousParameters: SqlValue[]): unknown[];
  get(...anonymousParameters: SqlValue[]): unknown;
  run(...anonymousParameters: SqlValue[]): { changes: number | bigint };
};

export type TicketDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
};

type SqliteModule = {
  DatabaseSync: new (location: string) => TicketDatabase;
};

const schema = `
CREATE TABLE tickets (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  PRIMARY KEY (tenant_id, id)
)`;

export function openTicketDatabase(): TicketDatabase {
  const { DatabaseSync } = requireSqlite("node:sqlite") as SqliteModule;
  const database = new DatabaseSync(":memory:");
  database.exec(schema);
  insertSeed(database);
  return database;
}

export function reseedTicketDatabase(database: TicketDatabase): void {
  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM tickets");
    insertSeed(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function insertSeed(database: TicketDatabase): void {
  const insert = database.prepare(
    `INSERT INTO tickets (tenant_id, id, title, description, status)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const ticket of seedTickets()) {
    insert.run(
      ticket.tenantId,
      ticket.id,
      ticket.title,
      ticket.description,
      ticket.status,
    );
  }
}
