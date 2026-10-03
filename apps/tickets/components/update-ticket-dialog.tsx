"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type UpdateTicket = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
};

export function updateRequest(
  ticket: UpdateTicket,
  draft: Pick<UpdateTicket, "title" | "description" | "status">,
): string | null {
  const changes: string[] = [];
  if (draft.title !== ticket.title) {
    changes.push(`title to ${JSON.stringify(draft.title)}`);
  }
  if (draft.description !== ticket.description) {
    changes.push(`description to ${JSON.stringify(draft.description)}`);
  }
  if (draft.status !== ticket.status) {
    changes.push(`status to ${draft.status}`);
  }
  if (changes.length === 0) return null;
  return `Update ticket ${ticket.id}: set ${changes.join(", ")}.`;
}

export function UpdateTicketDialog({
  ticket,
  onCancel,
  onSubmit,
}: {
  ticket: UpdateTicket;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [status, setStatus] = useState(ticket.status);
  const request = updateRequest(ticket, { title, description, status });

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const firstField = dialogRef.current?.querySelector("input, textarea, button");
    if (firstField instanceof HTMLElement) firstField.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>("input, textarea, button"),
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

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel and close"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-ticket-title"
        onKeyDown={onKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 shadow-lg dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <h2 id="update-ticket-title" className="text-lg font-semibold">
          Update ticket {ticket.id}
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (request) onSubmit(request);
          }}
        >
          <div className="block text-sm">
            <label className="text-zinc-500" htmlFor="update-title">
              Title
            </label>
            <Input
              id="update-title"
              className="mt-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="block text-sm">
            <label className="text-zinc-500" htmlFor="update-description">
              Description
            </label>
            <Textarea
              id="update-description"
              className="mt-1"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div role="radiogroup" aria-label="Status" className="flex gap-2">
            {(["open", "closed"] as const).map((option) => {
              const selected = option === status;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStatus(option)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    selected
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={request === null}>
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
