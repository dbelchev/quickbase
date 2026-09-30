"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApprovalModal,
  type PendingProposal,
} from "@/components/approval-modal";

type TenantId = "tenant-a" | "tenant-b";

type ChatMessage = UIMessage<{ confirmation?: boolean }>;

const tenants: { id: TenantId; label: string }[] = [
  { id: "tenant-a", label: "Tenant A" },
  { id: "tenant-b", label: "Tenant B" },
];

const pendingConfirmations = new Map<string, string>();

export function TicketChat() {
  const [tenantId, setTenantId] = useState<TenantId>("tenant-a");
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [sessionBusy, setSessionBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const reportSessionBusy = useCallback((busy: boolean) => {
    setSessionBusy(busy);
  }, []);

  function selectTenant(next: TenantId) {
    if (next === tenantId) return;
    setTenantId(next);
    setThreadId(crypto.randomUUID());
    setResetError(null);
  }

  async function resetStorage() {
    setResetting(true);
    setResetError(null);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      if (!response.ok) {
        setResetError("Storage was not reset.");
        return;
      }
      setThreadId(crypto.randomUUID());
    } catch {
      setResetError("Storage was not reset.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="relative z-30 border-b border-zinc-200 bg-background dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold">Tickets</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void resetStorage()}
              disabled={sessionBusy || resetting}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Reset
            </button>
            <div role="radiogroup" aria-label="Tenant" className="flex gap-2">
            {tenants.map((tenant) => {
              const selected = tenant.id === tenantId;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectTenant(tenant.id)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    selected
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {tenant.label}
                </button>
              );
            })}
            </div>
          </div>
        </div>
        {resetError ? (
          <p
            role="alert"
            className="mx-auto w-full max-w-3xl px-4 pb-3 text-sm text-red-700 dark:text-red-400"
          >
            {resetError}
          </p>
        ) : null}
      </header>
      <ChatSession
        key={threadId}
        tenantId={tenantId}
        threadId={threadId}
        onBusyChange={reportSessionBusy}
      />
    </div>
  );
}

function ChatSession({
  tenantId,
  threadId,
  onBusyChange,
}: {
  tenantId: TenantId;
  threadId: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [decisions, setDecisions] = useState<
    Record<string, "applied" | "rejected">
  >({});
  const [draft, setDraft] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body, api }) => ({
          api,
          headers: { "X-Tenant-ID": tenantId },
          body: {
            ...body,
            threadId,
            messages,
            confirmationProposalId: pendingConfirmations.get(threadId),
          },
        }),
      }),
    [tenantId, threadId],
  );

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    id: threadId,
    transport,
  });

  const proposal = firstPendingProposal(messages, decisions);
  const replying = status === "submitted" || status === "streaming";
  const busy = replying || deciding;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  async function decide(decision: "approve" | "reject") {
    if (!proposal) return;
    setDeciding(true);
    setDecisionError(null);
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
        },
        body: JSON.stringify({ proposalId: proposal.id, decision }),
      });
      if (!response.ok) {
        setDecisionError("The decision was not recorded.");
        return;
      }
      const body = (await response.json()) as { outcome?: string };
      const outcome = body.outcome === "applied" ? "applied" : "rejected";
      setDecisions((current) => ({ ...current, [proposal.id]: outcome }));
      pendingConfirmations.set(threadId, proposal.id);
      try {
        await sendMessage({
          text: "Confirm the recorded decision.",
          metadata: { confirmation: true },
        });
      } finally {
        pendingConfirmations.delete(threadId);
      }
    } finally {
      setDeciding(false);
    }
  }

  async function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || proposal) return;
    setDraft("");
    await sendMessage({ text });
  }

  return (
    <>
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ask about this tenant&apos;s tickets. Deletes and updates wait for
            approval.
          </p>
        ) : null}
        <ol className="flex flex-col gap-4" aria-live="polite">
          {messages.map((message) => (
            <MessageRow key={message.id} message={message} decisions={decisions} />
          ))}
        </ol>
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error.message}
          </p>
        ) : null}
        {decisionError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {decisionError}
          </p>
        ) : null}
      </main>
      <form
        onSubmit={submitMessage}
        className="border-t border-zinc-200 dark:border-zinc-800"
      >
        <div className="mx-auto flex w-full max-w-3xl gap-2 px-4 py-3">
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <textarea
            id="chat-message"
            value={draft}
            rows={2}
            disabled={busy || proposal !== null}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              proposal ? "Decide the pending change first." : "Message"
            }
            className="min-h-12 flex-1 resize-none rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={busy || proposal !== null || draft.trim() === ""}
            className="self-end rounded-md bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
          >
            Send
          </button>
        </div>
      </form>
      {proposal ? (
        <ApprovalModal proposal={proposal} onDecide={decide} />
      ) : null}
    </>
  );
}

function MessageRow({
  message,
  decisions,
}: {
  message: ChatMessage;
  decisions: Record<string, "applied" | "rejected">;
}) {
  if (message.role === "user" && message.metadata?.confirmation) return null;

  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
  const tools = message.parts.filter((part) => part.type.startsWith("tool-"));

  if (!text && tools.length === 0) return null;

  return (
    <li className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {message.role === "user" ? "You" : "Assistant"}
      </p>
      {text ? <p className="whitespace-pre-wrap text-sm">{text}</p> : null}
      {tools.map((part, index) => (
        <ToolTrace
          key={"toolCallId" in part ? part.toolCallId : `${part.type}-${index}`}
          part={part}
          decisions={decisions}
        />
      ))}
    </li>
  );
}

function ToolTrace({
  part,
  decisions,
}: {
  part: ChatMessage["parts"][number];
  decisions: Record<string, "applied" | "rejected">;
}) {
  const name = part.type.slice("tool-".length);
  const input = "input" in part ? part.input : undefined;
  const output = "output" in part ? part.output : undefined;
  const outcome = outcomeLabel(output, decisions);

  return (
    <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{name}</p>
        {outcome ? (
          <p>
            Outcome: <span className="font-medium">{outcome}</span>
          </p>
        ) : null}
      </div>
      <pre className="mt-2 overflow-x-auto text-xs text-zinc-700 dark:text-zinc-300">
        {JSON.stringify(input ?? {}, null, 2)}
      </pre>
      {name === "search_tickets" && Array.isArray(output) ? (
        <ul className="mt-2 space-y-2">
          {output.map((hit) => (
            <SearchHit key={String(hit.id)} hit={hit} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchHit({ hit }: { hit: unknown }) {
  if (!hit || typeof hit !== "object") return null;
  const ticket = hit as {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
  };
  return (
    <li className="rounded border border-zinc-100 p-2 dark:border-zinc-900">
      <p className="font-medium">
        {ticket.id}: {ticket.title}
      </p>
      <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {ticket.description}
      </p>
      <p className="text-xs text-zinc-500">{ticket.status}</p>
    </li>
  );
}

function outcomeLabel(
  output: unknown,
  decisions: Record<string, "applied" | "rejected">,
): string | null {
  if (Array.isArray(output)) return null;
  if (!output || typeof output !== "object") return "…";
  const record = output as {
    outcome?: string;
    proposal?: { id?: string };
  };
  const decided = record.proposal?.id
    ? decisions[record.proposal.id]
    : undefined;
  if (decided) return decided;
  if (record.outcome === "not_found") return "not found";
  if (record.outcome) return record.outcome;
  return "…";
}

function firstPendingProposal(
  messages: ChatMessage[],
  decisions: Record<string, "applied" | "rejected">,
): PendingProposal | null {
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-mutate_ticket" || !("output" in part)) continue;
      const proposal = readPendingProposal(part.output);
      if (proposal && !decisions[proposal.id]) return proposal;
    }
  }
  return null;
}

function readPendingProposal(output: unknown): PendingProposal | null {
  if (!output || typeof output !== "object") return null;
  const record = output as {
    outcome?: string;
    proposal?: PendingProposal;
  };
  if (record.outcome !== "pending" || !record.proposal?.id) return null;
  return record.proposal;
}
