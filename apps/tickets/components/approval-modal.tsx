"use client";

import { useEffect, useRef } from "react";

export type PendingProposal = {
  id: string;
  tenantId: "tenant-a" | "tenant-b";
  ticketId: string;
  title: string;
  description: string;
  action: "update" | "delete";
  fields?: {
    title?: string;
    description?: string;
    status?: string;
  };
};

const tenantLabels = {
  "tenant-a": "Tenant A",
  "tenant-b": "Tenant B",
} as const;

export function ApprovalModal({
  proposal,
  onDecide,
}: {
  proposal: PendingProposal;
  onDecide: (decision: "approve" | "reject") => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const firstButton = dialogRef.current?.querySelector("button");
    firstButton?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDecide("reject");
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>("button"),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const fieldChanges = proposal.fields
    ? Object.entries(proposal.fields).filter(([, value]) => value !== undefined)
    : [];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Reject and close"
        className="absolute inset-0 bg-black/40"
        onClick={() => onDecide("reject")}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        onKeyDown={onKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 shadow-lg dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <h2 id="approval-title" className="text-lg font-semibold">
          Approve this {proposal.action}?
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Tenant</dt>
            <dd>{tenantLabels[proposal.tenantId]}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ticket</dt>
            <dd>{proposal.ticketId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Title</dt>
            <dd>{proposal.title}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Description</dt>
            <dd className="whitespace-pre-wrap">{proposal.description}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Action</dt>
            <dd>{proposal.action}</dd>
          </div>
          {proposal.action === "update" && fieldChanges.length > 0 ? (
            <div>
              <dt className="text-zinc-500">Fields that would change</dt>
              <dd>
                <ul className="mt-1 space-y-1">
                  {fieldChanges.map(([field, value]) => (
                    <li key={field}>
                      <span className="font-medium">{field}:</span> {value}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            onClick={() => onDecide("reject")}
          >
            Reject
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-950"
            onClick={() => onDecide("approve")}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
