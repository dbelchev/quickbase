import {
  all,
  compiler,
  get,
  run,
  type Database,
} from "@quickbase/database";
import {
  tenantIdSchema,
  ticketSchema,
  type TenantId,
  type Ticket,
  type UpdateFields,
} from "../model";
import { loadTicketStore, reseedTicketDatabase } from "./database";

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
    const rows =
      needle === "" || needle === "*"
        ? all(this.database, listTickets(owner))
        : all(this.database, searchTickets(owner, likePattern(needle)));
    return rows.map((row) => ticketSchema.parse(row));
  }

  find(tenantId: TenantId, id: string): Ticket | null {
    const owner = tenantIdSchema.parse(tenantId);
    const row = get(
      this.database,
      compiler("tickets")
        .select("id", "title", "description", "status")
        .where({ tenant_id: owner, id }),
    );
    return row ? ticketSchema.parse(row) : null;
  }

  applyUpdate(
    tenantId: TenantId,
    id: string,
    fields: UpdateFields,
  ): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const assignments = definedFields(fields);
    if (Object.keys(assignments).length === 0) {
      return this.find(owner, id) ? "applied" : "not_found";
    }
    const changes = run(
      this.database,
      compiler("tickets").where({ tenant_id: owner, id }).update(assignments),
    );
    return changes === 0 ? "not_found" : "applied";
  }

  delete(tenantId: TenantId, id: string): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const changes = run(
      this.database,
      compiler("tickets").where({ tenant_id: owner, id }).delete(),
    );
    return changes === 0 ? "not_found" : "applied";
  }
}

function listTickets(owner: TenantId) {
  return compiler("tickets")
    .select("id", "title", "description", "status")
    .where("tenant_id", owner)
    .orderByRaw("rowid");
}

function searchTickets(owner: TenantId, pattern: string) {
  return listTickets(owner).where((builder) => {
    builder
      .whereRaw("title LIKE ? ESCAPE '\\'", [pattern])
      .orWhereRaw("description LIKE ? ESCAPE '\\'", [pattern]);
  });
}

function definedFields(fields: UpdateFields): Record<string, string> {
  const assignments: Record<string, string> = {};
  if (fields.title !== undefined) assignments.title = fields.title;
  if (fields.description !== undefined) {
    assignments.description = fields.description;
  }
  if (fields.status !== undefined) assignments.status = fields.status;
  return assignments;
}

function likePattern(query: string): string {
  const escaped = query
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
}
