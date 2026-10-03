"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport, type UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ApprovalModal,
  type PendingProposal,
} from "@/components/approval-modal";
import {
  UpdateTicketDialog,
  type UpdateTicket,
} from "@/components/update-ticket-dialog";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Message, MessageContent } from "@/components/ui/message";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

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
      </header>
      <ChatSession
        key={threadId}
        onBusyChange={reportSessionBusy}
        replyTransport={replyTransport}
        resetError={resetError}
        tenantId={tenantId}
        threadId={threadId}
      />
    </div>
  );
}

function ChatSession({
  tenantId,
  threadId,
  replyTransport,
  resetError,
  onBusyChange,
}: {
  tenantId: TenantId;
  threadId: string;
  replyTransport?: ChatTransport<ChatMessage>;
  resetError: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [decisions, setDecisions] = useState<
    Record<string, "applied" | "rejected">
  >({});
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<UpdateTicket | null>(null);
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

  const threadLocked = busy || proposal !== null;
  const fieldLocked = threadLocked || editing !== null;

  async function submitMessage({
    text,
    clearDraft = false,
  }: {
    text: string;
    clearDraft?: boolean;
  }) {
    const trimmed = text.trim();
    if (!trimmed || threadLocked) return;
    if (clearDraft) setDraft("");
    setEditing(null);
    await sendMessage({ text: trimmed });
  }

  const turns = messages.filter(isVisibleTurn);

  return (
    <>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="mx-auto min-h-0 w-full max-w-3xl flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              aria-busy={status === "streaming"}
              className="p-4"
            >
              {messages.length === 0 ? (
                <MessageScrollerItem messageId="empty-thread">
                  <p className="text-sm text-muted-foreground">
                    Ask about this tenant&apos;s tickets. Deletes and updates
                    wait for approval.
                  </p>
                </MessageScrollerItem>
              ) : null}
              {turns.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <ThreadMessage
                    decisions={decisions}
                    locked={fieldLocked}
                    message={message}
                    onDelete={(ticket) =>
                      void submitMessage({ text: `Delete ticket ${ticket.id}` })
                    }
                    onUpdate={setEditing}
                  />
                </MessageScrollerItem>
              ))}
              {error ? (
                <MessageScrollerItem messageId="reply-error">
                  <ThreadAlert>{error.message}</ThreadAlert>
                </MessageScrollerItem>
              ) : null}
              {decisionError ? (
                <MessageScrollerItem messageId="decision-error">
                  <ThreadAlert>{decisionError}</ThreadAlert>
                </MessageScrollerItem>
              ) : null}
              {resetError ? (
                <MessageScrollerItem messageId="reset-error">
                  <ThreadAlert>{resetError}</ThreadAlert>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <ThreadComposer
            draft={draft}
            editing={editing !== null}
            locked={fieldLocked}
            pending={proposal !== null}
            onDraftChange={setDraft}
            onSubmit={(text) =>
              void submitMessage({ text, clearDraft: true })
            }
          />
        </div>
      </div>
      {proposal ? (
        <ApprovalModal proposal={proposal} onDecide={decide} />
      ) : null}
      {editing ? (
        <UpdateTicketDialog
          ticket={editing}
          onCancel={() => setEditing(null)}
          onSubmit={(text) => void submitMessage({ text })}
        />
      ) : null}
    </>
  );
}

function ThreadComposer({
  draft,
  editing,
  locked,
  pending,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  editing: boolean;
  locked: boolean;
  pending: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: (text: string) => void;
}) {
  const [composing, setComposing] = useState(false);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (composing || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const submitButton = event.currentTarget.form?.querySelector(
      'button[type="submit"]',
    );
    if (!(submitButton instanceof HTMLButtonElement) || submitButton.disabled) {
      return;
    }
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          aria-label="Message"
          disabled={locked}
          onChange={(event) => onDraftChange(event.target.value)}
          onCompositionEnd={() => setComposing(false)}
          onCompositionStart={() => setComposing(true)}
          onKeyDown={onKeyDown}
          placeholder={
            pending
              ? "Decide the pending change first."
              : editing
                ? "Finish the update first."
                : "Message"
          }
          value={draft}
        />
        <InputGroupAddon align="block-end" className="justify-end">
          <InputGroupButton
            aria-label="Send"
            disabled={locked || draft.trim() === ""}
            size="sm"
            type="submit"
            variant="default"
          >
            Send
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

function ThreadMessage({
  message,
  decisions,
  locked,
  onDelete,
  onUpdate,
}: {
  message: ChatMessage;
  decisions: Record<string, "applied" | "rejected">;
  locked: boolean;
  onDelete: (ticket: UpdateTicket) => void;
  onUpdate: (ticket: UpdateTicket) => void;
}) {
  const text = visibleText(message);
  const tools = message.parts.filter((part) => part.type.startsWith("tool-"));
  const fromPerson = message.role === "user";

  return (
    <Message
      align={fromPerson ? "end" : "start"}
      aria-label={fromPerson ? "You" : "Tickets chat agent"}
      role="article"
    >
      <MessageContent>
        {text ? (
          <Bubble
            align={fromPerson ? "end" : "start"}
            variant={fromPerson ? "secondary" : "ghost"}
          >
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        ) : null}
        {tools.map((part, index) => (
          <ToolRecord
            key={
              "toolCallId" in part ? part.toolCallId : `${part.type}-${index}`
            }
            decisions={decisions}
            locked={locked}
            part={part}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function isVisibleTurn(message: ChatMessage) {
  if (message.role === "user" && message.metadata?.confirmation) return false;
  if (messageText(message)) return true;
  return message.parts.some((part) => part.type.startsWith("tool-"));
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

function visibleText(message: ChatMessage): string {
  const text = messageText(message);
  if (!hasTicketCards(message)) return text;
  return textBeforeTicketList(text);
}

function textBeforeTicketList(text: string): string {
  const lines = text.split(/\r?\n/);
  const listStart = lines.findIndex((line) =>
    /^\s*(?:\d+\.|[-*])\s+\S/.test(line),
  );
  if (listStart === -1) return text;
  return lines.slice(0, listStart).join("\n").trim();
}

function hasTicketCards(message: ChatMessage): boolean {
  return message.parts.some((part) => {
    if (part.type !== "tool-search_tickets" || !("output" in part)) return false;
    return Array.isArray(part.output) && part.output.some((hit) => readTicket(hit));
  });
}

function ThreadAlert({ children }: { children: string }) {
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
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
  locked,
  onDelete,
  onUpdate,
}: {
  part: ChatMessage["parts"][number];
  decisions: Record<string, "applied" | "rejected">;
  locked: boolean;
  onDelete: (ticket: UpdateTicket) => void;
  onUpdate: (ticket: UpdateTicket) => void;
}) {
  const name = part.type.slice("tool-".length);
  const input = "input" in part ? part.input : undefined;
  const output = "output" in part ? part.output : undefined;
  const outcome = outcomeLabel(output, decisions);
  const running = outcome === "…";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 text-sm">
      <Marker role={running ? "status" : undefined} variant="default">
        {running ? (
          <MarkerIcon>
            <Spinner />
          </MarkerIcon>
        ) : null}
        <MarkerContent className={running ? "shimmer" : undefined}>
          <span className="font-medium">{name}</span>
          {outcome ? (
            <>
              {" "}
              Outcome: <span className="font-medium">{outcome}</span>
            </>
          ) : null}
        </MarkerContent>
      </Marker>
      <pre className="overflow-x-auto text-xs text-muted-foreground">
        {JSON.stringify(input ?? {}, null, 2)}
      </pre>
      {name === "search_tickets" && Array.isArray(output) ? (
        <div className="flex flex-col gap-2">
          {output.map((hit, index) => {
            const ticket = readTicket(hit);
            if (!ticket) return null;
            return (
              <TicketCard
                key={`${ticket.id}-${index}`}
                locked={locked}
                ticket={ticket}
                onDelete={() => onDelete(ticket)}
                onUpdate={() => onUpdate(ticket)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TicketCard({
  ticket,
  locked,
  onDelete,
  onUpdate,
}: {
  ticket: TicketCardModel;
  locked: boolean;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  return (
    <Card className="w-full min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Badge
            className="shrink-0"
            variant={ticket.status === "closed" ? "secondary" : "default"}
          >
            {ticket.status}
          </Badge>
          <span className="shrink-0 whitespace-nowrap">{ticket.id}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {ticket.description}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={locked}
              aria-label={`Update ticket ${ticket.id}`}
              onClick={onUpdate}
            >
              Update
            </Button>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              disabled={locked}
              aria-label={`Delete ticket ${ticket.id}`}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
        <span className="min-w-0 truncate font-medium">{ticket.title}</span>
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
