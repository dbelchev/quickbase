import {
  decisionSchema,
  tenantIdSchema,
  updateFieldsSchema,
  type Decision,
  type DecideResult,
  type Proposal,
  type ProposalView,
  type ProposeResult,
  type TenantId,
  type UpdateFields,
} from "../model";
import type { TicketRepository } from "../repository";

export class ProposalService {
  private readonly proposals: Proposal[] = [];

  constructor(private readonly repository: TicketRepository) {}

  reset(): void {
    this.proposals.length = 0;
  }

  propose(input: {
    tenantId: TenantId;
    id: string;
    action: Proposal["action"];
    fields?: Record<string, unknown>;
  }): ProposeResult {
    const tenantId = tenantIdSchema.parse(input.tenantId);
    const ticket = this.repository.find(tenantId, String(input.id));
    if (!ticket) return { outcome: "not_found" };

    let fields: UpdateFields | undefined;
    if (input.action === "update") {
      const parsed = updateFieldsSchema.safeParse(input.fields ?? {});
      if (!parsed.success) return { outcome: "rejected" };
      fields = Object.keys(parsed.data).length > 0 ? parsed.data : undefined;
    }

    const proposal: Proposal = {
      id: crypto.randomUUID(),
      tenantId,
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description,
      action: input.action,
      fields,
      state: "pending",
    };
    this.proposals.push(proposal);
    return { outcome: "pending", proposal: viewProposal(proposal) };
  }

  decide(input: {
    tenantId: TenantId;
    proposalId: string;
    decision: Decision;
  }): DecideResult {
    const tenantId = tenantIdSchema.parse(input.tenantId);
    const decision = decisionSchema.parse(input.decision);
    const proposal = this.proposals.find((item) => item.id === input.proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      return { outcome: "not_found" };
    }
    if (proposal.state !== "pending") {
      return { outcome: "already_decided" };
    }

    if (decision === "reject") {
      proposal.state = "rejected";
      return { outcome: "rejected" };
    }

    const write =
      proposal.action === "delete"
        ? this.repository.delete(tenantId, proposal.ticketId)
        : this.repository.applyUpdate(
            tenantId,
            proposal.ticketId,
            proposal.fields ?? {},
          );
    if (write === "not_found") {
      proposal.state = "rejected";
      return { outcome: "not_found" };
    }

    proposal.state = "applied";
    return { outcome: "applied" };
  }

  recordedDecision(
    tenantId: TenantId,
    proposalId: string,
  ): { outcome: "applied" | "rejected" } | null {
    const proposal = this.proposals.find(
      (item) => item.id === proposalId && item.tenantId === tenantId,
    );
    if (!proposal) return null;
    if (proposal.state === "applied" || proposal.state === "rejected") {
      return { outcome: proposal.state };
    }
    return null;
  }
}

function viewProposal(proposal: Proposal): ProposalView {
  return {
    id: proposal.id,
    tenantId: proposal.tenantId,
    ticketId: proposal.ticketId,
    title: proposal.title,
    description: proposal.description,
    action: proposal.action,
    fields: proposal.fields,
  };
}
