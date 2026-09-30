import type { Database } from "@quickbase/database";
import {
  tenantIdSchema,
  ticketSchema,
  type TenantId,
  type Ticket,
  type UpdateFields,
} from "../model";
import { loadTicketStore, reseedTicketDatabase } from "./database";

const listByTenant = `
  SELECT id, title, description, status
  FROM tickets
  WHERE tenant_id = ?
  ORDER BY rowid
`;

const searchByText = `
  SELECT id, title, description, status
  FROM tickets
  WHERE tenant_id = ?
    AND (
      title LIKE ? ESCAPE '\\'
      OR description LIKE ? ESCAPE '\\'
    )
  ORDER BY rowid
`;

export class TicketRepository {
  constructor(private readonly database: Database) {
    loadTicketStore(database);
  }

  reset(): void {
    reseedTicketDatabase(this.database);
  }

  search(tenantId: TenantId, query: string): Ticket[] {
    const owner = tenantIdSchema.parse(tenantId);
    const needle = query.trim();
    if (needle === "" || needle === "*") {
      return this.database
        .prepare(listByTenant)
        .all(owner)
        .map((row) => ticketSchema.parse(row));
    }
    const pattern = likePattern(needle);
    return this.database
      .prepare(searchByText)
      .all(owner, pattern, pattern)
      .map((row) => ticketSchema.parse(row));
  }

  find(tenantId: TenantId, id: string): Ticket | null {
    const owner = tenantIdSchema.parse(tenantId);
    const row = this.database
      .prepare(
        `SELECT id, title, description, status
         FROM tickets
         WHERE tenant_id = ? AND id = ?`,
      )
      .get(owner, id);
    return row ? ticketSchema.parse(row) : null;
  }

  applyUpdate(
    tenantId: TenantId,
    id: string,
    fields: UpdateFields,
  ): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const assignments: string[] = [];
    const values: string[] = [];
    if (fields.title !== undefined) {
      assignments.push("title = ?");
      values.push(fields.title);
    }
    if (fields.description !== undefined) {
      assignments.push("description = ?");
      values.push(fields.description);
    }
    if (fields.status !== undefined) {
      assignments.push("status = ?");
      values.push(fields.status);
    }
    if (assignments.length === 0) {
      return this.find(owner, id) ? "applied" : "not_found";
    }
    const result = this.database
      .prepare(
        `UPDATE tickets
         SET ${assignments.join(", ")}
         WHERE tenant_id = ? AND id = ?`,
      )
      .run(...values, owner, id);
    return Number(result.changes) === 0 ? "not_found" : "applied";
  }

  delete(tenantId: TenantId, id: string): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const result = this.database
      .prepare(`DELETE FROM tickets WHERE tenant_id = ? AND id = ?`)
      .run(owner, id);
    return Number(result.changes) === 0 ? "not_found" : "applied";
  }
}

function likePattern(query: string): string {
  const escaped = query
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
}
