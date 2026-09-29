import {
  tenantIdSchema,
  type StoredTicket,
  type TenantId,
  type Ticket,
  type UpdateFields,
} from "../model";
import { seedTickets } from "./seed";

function view(ticket: StoredTicket): Ticket {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
  };
}

export class TicketRepository {
  private tickets = seedTickets();

  reset(): void {
    this.tickets = seedTickets();
  }

  search(tenantId: TenantId, query: string): Ticket[] {
    const owner = tenantIdSchema.parse(tenantId);
    const needle = query.toLowerCase();
    return this.tickets
      .filter((ticket) => ticket.tenantId === owner)
      .filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(needle) ||
          ticket.description.toLowerCase().includes(needle),
      )
      .map(view);
  }

  find(tenantId: TenantId, id: string): Ticket | null {
    const owner = tenantIdSchema.parse(tenantId);
    const ticket = this.tickets.find(
      (item) => item.id === id && item.tenantId === owner,
    );
    return ticket ? view(ticket) : null;
  }

  applyUpdate(
    tenantId: TenantId,
    id: string,
    fields: UpdateFields,
  ): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const ticket = this.tickets.find(
      (item) => item.id === id && item.tenantId === owner,
    );
    if (!ticket) return "not_found";
    if (fields.title !== undefined) ticket.title = fields.title;
    if (fields.description !== undefined) {
      ticket.description = fields.description;
    }
    if (fields.status !== undefined) ticket.status = fields.status;
    return "applied";
  }

  delete(tenantId: TenantId, id: string): "applied" | "not_found" {
    const owner = tenantIdSchema.parse(tenantId);
    const exists = this.tickets.some(
      (item) => item.id === id && item.tenantId === owner,
    );
    if (!exists) return "not_found";
    this.tickets = this.tickets.filter(
      (item) => !(item.id === id && item.tenantId === owner),
    );
    return "applied";
  }
}
