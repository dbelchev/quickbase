import type { Database } from "@quickbase/database";
import { seedTickets } from "./seed";

const schema = `
CREATE TABLE tickets (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  PRIMARY KEY (tenant_id, id)
)`;

export function loadTicketStore(database: Database): void {
  database.exec(schema);
  insertSeed(database);
}

export function reseedTicketDatabase(database: Database): void {
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

function insertSeed(database: Database): void {
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
