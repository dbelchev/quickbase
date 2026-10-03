"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  ApprovalModal,
  type PendingProposal,
} from "@/components/approval-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type TenantId = "tenant-a" | "tenant-b";

type ChatMessage = UIMessage<{ confirmation?: boolean }>;

const tenants: { id: TenantId; label: string }[] = [
  { id: "tenant-a", label: "Tenant A" },
  { id: "tenant-b", label: "Tenant B" },
];

const pendingConfirmations = new Map<string, string>();

export function TicketChat({
  replyTransport,
}: {
  replyTransport?: ChatTransport<ChatMessage>;
} = {}) {
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
          <ThreadAlert className="mx-auto w-full max-w-3xl px-4 pb-3">
            {resetError}
          </ThreadAlert>
        ) : null}
      </header>
      <ChatSession
        key={threadId}
        tenantId={tenantId}
        threadId={threadId}
        replyTransport={replyTransport}
        onBusyChange={reportSessionBusy}
      />
    </div>
  );
}

function ChatSession({
  tenantId,
  threadId,
  replyTransport,
  onBusyChange,
}: {
  tenantId: TenantId;
  threadId: string;
  replyTransport?: ChatTransport<ChatMessage>;
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
      replyTransport ??
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
    [replyTransport, tenantId, threadId],
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

  const fieldLocked = busy || proposal !== null;

  async function submitMessage({ text }: { text: string }) {
    const trimmed = text.trim();
    if (!trimmed || fieldLocked) return;
    setDraft("");
    await sendMessage({ text: trimmed });
  }

  return (
    <>
      <Conversation className="mx-auto min-h-0 w-full max-w-3xl flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask about this tenant&apos;s tickets. Deletes and updates wait for
              approval.
            </p>
          ) : null}
          {messages.map((message) => (
            <ThreadMessage
              key={message.id}
              message={message}
              decisions={decisions}
            />
          ))}
          {error ? <ThreadAlert>{error.message}</ThreadAlert> : null}
          {decisionError ? <ThreadAlert>{decisionError}</ThreadAlert> : null}
        </ConversationContent>
      </Conversation>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <PromptInput maxFiles={0} onSubmit={submitMessage}>
            <PromptInputTextarea
              aria-label="Message"
              value={draft}
              disabled={fieldLocked}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                proposal ? "Decide the pending change first." : "Message"
              }
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                aria-label="Send"
                disabled={fieldLocked || draft.trim() === ""}
                size="sm"
              >
                Send
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
      {proposal ? (
        <ApprovalModal proposal={proposal} onDecide={decide} />
      ) : null}
    </>
  );
}

function ThreadMessage({
  message,
  decisions,
}: {
  message: ChatMessage;
  decisions: Record<string, "applied" | "rejected">;
}) {
  if (message.role === "user" && message.metadata?.confirmation) return null;

  const text = messageText(message);
  const tools = message.parts.filter((part) => part.type.startsWith("tool-"));
  if (!text && tools.length === 0) return null;

  const fromPerson = message.role === "user";

  return (
    <Message
      from={fromPerson ? "user" : "assistant"}
      role="article"
      aria-label={fromPerson ? "You" : "Tickets chat agent"}
      className={fromPerson ? undefined : "w-full max-w-none"}
    >
      {text ? (
        <MessageContent
          className={
            fromPerson
              ? "whitespace-pre-wrap"
              : "w-fit whitespace-pre-wrap rounded-lg bg-muted px-4 py-3"
          }
        >
          {text}
        </MessageContent>
      ) : null}
      {tools.map((part, index) => (
        <ToolRecord
          key={"toolCallId" in part ? part.toolCallId : `${part.type}-${index}`}
          part={part}
          decisions={decisions}
        />
      ))}
    </Message>
  );
}

type TicketCardModel = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
};

export function messageText(message: {
  parts: readonly { type: string; text?: string }[];
}): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function ThreadAlert({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`text-sm text-red-700 dark:text-red-400 ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

function readTicket(value: unknown): TicketCardModel | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.description !== "string" ||
    (record.status !== "open" && record.status !== "closed")
  ) {
    return null;
  }
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
  };
}

function ToolRecord({
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
    <div className="flex w-full min-w-0 flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{name}</p>
        {outcome ? (
          <p>
            Outcome: <span className="font-medium">{outcome}</span>
          </p>
        ) : null}
      </div>
      <pre className="overflow-x-auto text-xs text-muted-foreground">
        {JSON.stringify(input ?? {}, null, 2)}
      </pre>
      {name === "search_tickets" && Array.isArray(output) ? (
        <div className="flex flex-col gap-2">
          {output.map((hit, index) => {
            const ticket = readTicket(hit);
            if (!ticket) return null;
            return <TicketCard key={`${ticket.id}-${index}`} ticket={ticket} />;
          })}
        </div>
      ) : null}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: TicketCardModel }) {
  return (
    <Card className="w-full min-w-0">
      <CardContent className="flex min-w-0 items-center gap-3">
        <Badge variant={ticket.status === "closed" ? "secondary" : "default"}>
          {ticket.status}
        </Badge>
        <span className="shrink-0 whitespace-nowrap">{ticket.id}</span>
        <span className="min-w-0 shrink truncate font-medium">{ticket.title}</span>
        <span className="min-w-0 flex-[1_2_0%] truncate text-muted-foreground">
          {ticket.description}
        </span>
      </CardContent>
    </Card>
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
