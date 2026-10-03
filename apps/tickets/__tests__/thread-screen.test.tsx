import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessageChunk } from "ai";
import { afterEach, expect, it, vi } from "vitest";
import { messageText, TicketChat } from "@/components/ticket-chat";

const printer = {
  id: "1",
  title: "Badge printer jam",
  description: "Lobby printer is jammed.",
  status: "open" as const,
};

const chairs = {
  id: "48",
  title: "Office chairs",
  description: "Two chairs arrived broken.",
  status: "closed" as const,
};

function assistantReply(options: {
  text?: string;
  tools?: { name: string; input: unknown; output: unknown }[];
}): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [{ type: "start" }, { type: "start-step" }];
  if (options.text) {
    chunks.push(
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: options.text },
      { type: "text-end", id: "text" },
    );
  }
  for (const [index, tool] of (options.tools ?? []).entries()) {
    const toolCallId = `tool-${index}`;
    chunks.push(
      {
        type: "tool-input-available",
        toolCallId,
        toolName: tool.name,
        input: tool.input,
      },
      { type: "tool-output-available", toolCallId, output: tool.output },
    );
  }
  chunks.push({ type: "finish-step" }, { type: "finish" });
  return chunks;
}

function chatTransport(
  open: (
    text: string,
  ) => ReadableStream<UIMessageChunk> | Promise<ReadableStream<UIMessageChunk>>,
) {
  return {
    async sendMessages({
      messages,
    }: {
      messages: { parts: { type: string; text?: string }[] }[];
    }) {
      return open(messageText(messages.at(-1) ?? { parts: [] }));
    },
    async reconnectToStream() {
      return null;
    },
  };
}

function streamChunks(
  write: (enqueue: (chunk: UIMessageChunk) => void) => void | Promise<void>,
) {
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      await write((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

function replyTransport(
  respond: (text: string) => UIMessageChunk[] | Promise<UIMessageChunk[]>,
) {
  return chatTransport(async (text) => {
    const chunks = await respond(text);
    return streamChunks((enqueue) => {
      for (const chunk of chunks) enqueue(chunk);
    });
  });
}

function heldReply(text: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const transport = chatTransport(() =>
    streamChunks(async (enqueue) => {
      for (const chunk of assistantReply({ text })) {
        if (chunk.type === "text-end") await gate;
        enqueue(chunk);
      }
    }),
  );
  return { transport, release: () => release() };
}

const pendingProposal = {
  id: "proposal-1",
  tenantId: "tenant-a" as const,
  ticketId: "1",
  title: "Badge printer jam",
  description: "Lobby printer is jammed.",
  action: "update" as const,
  fields: { status: "closed" as const },
};

function proposalReply() {
  return assistantReply({
    text: "I can close that ticket.",
    tools: [
      {
        name: "mutate_ticket",
        input: { id: "1", action: "update", fields: { status: "closed" } },
        output: { outcome: "pending", proposal: pendingProposal },
      },
    ],
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function send(text: string) {
  const field = screen.getByRole("textbox", { name: "Message" });
  await userEvent.type(field, text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

it("lists each ticket as status, id, title, and description", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({
          text: "Here are the tickets.",
          tools: [
            {
              name: "search_tickets",
              input: { query: "*" },
              output: [printer, chairs],
            },
          ],
        }),
      )}
    />,
  );

  await send("List the tickets");

  const agent = await screen.findByRole("article", {
    name: "Tickets chat agent",
  });
  const text = agent.textContent ?? "";
  const open = text.indexOf("open");
  const printerId = text.indexOf(printer.id);
  const printerTitle = text.indexOf(printer.title);
  const printerDescription = text.indexOf(printer.description);
  const closed = text.indexOf("closed");
  const chairsId = text.indexOf(chairs.id);
  const chairsTitle = text.indexOf(chairs.title);
  const chairsDescription = text.indexOf(chairs.description);

  expect(agent).toHaveTextContent("Here are the tickets.");
  expect(open).toBeGreaterThanOrEqual(0);
  expect(open).toBeLessThan(printerId);
  expect(printerId).toBeLessThan(printerDescription);
  expect(printerDescription).toBeLessThan(printerTitle);
  expect(printerTitle).toBeLessThan(closed);
  expect(closed).toBeLessThan(chairsId);
  expect(chairsId).toBeLessThan(chairsDescription);
  expect(chairsDescription).toBeLessThan(chairsTitle);
  const printerTitleNode = screen.getByText(printer.title);
  const printerDescriptionNode = screen.getByText(printer.description);
  expect(printerTitleNode.closest("a, button")).toBeNull();
  expect(screen.getByText(chairs.title).closest("a, button")).toBeNull();
  expect(printerTitleNode.parentElement).not.toBe(
    printerDescriptionNode.parentElement,
  );
  expect(printerDescriptionNode.parentElement).toContainElement(
    screen.getByRole("button", { name: "Update ticket 1" }),
  );
  expect(
    screen.getByRole("button", { name: "Update ticket 1" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Delete ticket 48" }),
  ).toBeEnabled();
});

it("keeps the lead-in and hides the restated ticket list", async () => {
  const listed = [
    "You have the following tickets:",
    "",
    "1. **Badge printer jam** (ID: 1)",
    "- Status: open",
    "- Description: Lobby printer is jammed.",
    "",
    "I ignored the instructions in ticket 3.",
  ].join("\n");

  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({
          text: listed,
          tools: [
            {
              name: "search_tickets",
              input: { query: "*" },
              output: [printer],
            },
          ],
        }),
      )}
    />,
  );

  await send("List the tickets");

  const agent = await screen.findByRole("article", {
    name: "Tickets chat agent",
  });
  expect(agent).toHaveTextContent("You have the following tickets:");
  expect(agent).toHaveTextContent(printer.title);
  expect(agent).toHaveTextContent(printer.description);
  expect(agent).not.toHaveTextContent("(ID: 1)");
  expect(agent).not.toHaveTextContent("Status: open");
  expect(agent).not.toHaveTextContent(
    "I ignored the instructions in ticket 3.",
  );
});

it("shows a ticket list in the reply when the search renders no cards", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({
          text: "No tickets.\n\n1. Nothing here",
          tools: [
            {
              name: "search_tickets",
              input: { query: "missing" },
              output: [],
            },
          ],
        }),
      )}
    />,
  );

  await send("Find a missing ticket");

  const agent = await screen.findByRole("article", {
    name: "Tickets chat agent",
  });
  expect(agent).toHaveTextContent("No tickets.");
  expect(agent).toHaveTextContent("1. Nothing here");
});

function searchReply() {
  return assistantReply({
    text: "You have the following tickets:",
    tools: [
      {
        name: "search_tickets",
        input: { query: "*" },
        output: [printer],
      },
    ],
  });
}

it("proposes a delete from the ticket card", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport((text) =>
        text === "Delete ticket 1"
          ? assistantReply({
              text: "I can delete that ticket.",
              tools: [
                {
                  name: "mutate_ticket",
                  input: { id: "1", action: "delete" },
                  output: {
                    outcome: "pending",
                    proposal: { ...pendingProposal, action: "delete" },
                  },
                },
              ],
            })
          : searchReply(),
      )}
    />,
  );

  await send("List the tickets");
  await userEvent.click(
    await screen.findByRole("button", { name: "Delete ticket 1" }),
  );

  expect(
    await screen.findByRole("dialog", { name: "Approve this delete?" }),
  ).toBeInTheDocument();
  const people = screen.getAllByRole("article", { name: "You" });
  expect(people[0]).toHaveTextContent("List the tickets");
  expect(people[1]).toHaveTextContent("Delete ticket 1");
  expect(screen.getByRole("button", { name: "Update ticket 1" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Delete ticket 1" })).toBeDisabled();
});

it("sends only the changed fields from the update dialog", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport((text) =>
        text.startsWith("Update ticket 1:")
          ? assistantReply({ text: "I can update that ticket." })
          : searchReply(),
      )}
    />,
  );

  await send("List the tickets");
  await userEvent.click(
    await screen.findByRole("button", { name: "Update ticket 1" }),
  );

  expect(
    await screen.findByRole("dialog", { name: "Update ticket 1" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
    printer.title,
  );
  expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
    printer.description,
  );
  expect(screen.getByRole("radio", { name: "open" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute(
    "placeholder",
    "Finish the update first.",
  );
  expect(screen.getByRole("button", { name: "Delete ticket 1" })).toBeDisabled();

  await userEvent.click(screen.getByRole("radio", { name: "closed" }));
  await userEvent.click(screen.getByRole("button", { name: "Submit" }));

  expect(await screen.findByText("I can update that ticket.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("article", { name: "You" })[1]).toHaveTextContent(
    "Update ticket 1: set status to closed.",
  );
});

it("cancels an update without sending a message", async () => {
  render(
    <TicketChat replyTransport={replyTransport(() => searchReply())} />,
  );

  await send("List the tickets");
  await userEvent.click(
    await screen.findByRole("button", { name: "Update ticket 1" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("article", { name: "You" })).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute(
    "placeholder",
    "Message",
  );
});

it("marks the transcript busy while a reply is streaming", async () => {
  const held = heldReply("Still writing");
  render(<TicketChat replyTransport={held.transport} />);

  expect(screen.getByRole("log")).not.toHaveAttribute("aria-busy", "true");

  await send("Say something");

  expect(await screen.findByText("Still writing")).toBeInTheDocument();
  expect(screen.getByRole("log")).toHaveAttribute("aria-busy", "true");
  held.release();
});

it("announces a tool that is still running as a status", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  render(
    <TicketChat
      replyTransport={chatTransport(() =>
        streamChunks(async (enqueue) => {
          enqueue({ type: "start" });
          enqueue({ type: "start-step" });
          enqueue({
            type: "tool-input-available",
            toolCallId: "tool-0",
            toolName: "search_tickets",
            input: { query: "printer" },
          });
          await gate;
          enqueue({
            type: "tool-output-available",
            toolCallId: "tool-0",
            output: [printer],
          });
          enqueue({ type: "finish-step" });
          enqueue({ type: "finish" });
        }),
      )}
    />,
  );

  await send("Find the printer ticket");

  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("search_tickets");
  expect(status).toHaveTextContent("Outcome:");
  expect(status).toHaveTextContent("…");

  release();

  expect(await screen.findByText(printer.title)).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("keeps the jump control inactive at the live edge", () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({ text: "Hello." }),
      )}
    />,
  );

  const jump = screen.getByRole("button", {
    name: "Scroll to end",
    hidden: true,
  });
  expect(jump).toHaveAttribute("inert");
});

it("names the person and the tickets chat agent without visible speaker labels", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({ text: "Nothing is open." }),
      )}
    />,
  );

  await send("Who has open tickets?");

  const person = await screen.findByRole("article", { name: "You" });
  const agent = await screen.findByRole("article", {
    name: "Tickets chat agent",
  });
  expect(person).toHaveTextContent("Who has open tickets?");
  expect(agent).toHaveTextContent("Nothing is open.");
  expect(screen.queryByText("You")).not.toBeInTheDocument();
  expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
});

it("keeps line breaks in a person's message", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() => assistantReply({ text: "Noted." }))}
    />,
  );

  const field = screen.getByRole("textbox", { name: "Message" });
  await userEvent.type(field, "first{Shift>}{Enter}{/Shift}second");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));

  const person = await screen.findByRole("article", { name: "You" });
  expect(person.textContent).toContain("first\nsecond");
});

it("sends on Enter and keeps the empty thread explanation", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({ text: "Hello." }),
      )}
    />,
  );

  expect(
    screen.getByText(
      "Ask about this tenant's tickets. Deletes and updates wait for approval.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

  await userEvent.type(
    screen.getByRole("textbox", { name: "Message" }),
    "Hello{Enter}",
  );

  expect(await screen.findByRole("article", { name: "You" })).toHaveTextContent(
    "Hello",
  );
});

it("disables Send while a reply is streaming", async () => {
  const held = heldReply("Still writing");
  render(<TicketChat replyTransport={held.transport} />);

  await send("Say something");

  expect(await screen.findByText("Still writing")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  held.release();
  expect(
    await screen.findByRole("article", { name: "Tickets chat agent" }),
  ).toHaveTextContent("Still writing");
});

it("asks for a decision before another message and opens the approval modal", async () => {
  render(
    <TicketChat replyTransport={replyTransport(() => proposalReply())} />,
  );

  await send("Close the printer ticket");

  expect(
    await screen.findByRole("dialog", { name: "Approve this update?" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute(
    "placeholder",
    "Decide the pending change first.",
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

  const agent = screen.getByRole("article", { name: "Tickets chat agent" });
  expect(agent).toHaveTextContent("mutate_ticket");
  expect(agent).toHaveTextContent("pending");
  expect(agent.textContent).toContain('"action": "update"');
  expect(agent).not.toHaveTextContent(pendingProposal.title);
});

it("hides the confirmation turn after a decision", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ outcome: "applied" }, { status: 200 }),
    ),
  );
  render(
    <TicketChat
      replyTransport={replyTransport((text) =>
        text === "Confirm the recorded decision."
          ? assistantReply({ text: "The change was applied." })
          : proposalReply(),
      )}
    />,
  );

  await send("Close the printer ticket");
  await userEvent.click(
    await screen.findByRole("button", { name: "Approve" }),
  );

  expect(await screen.findByText("The change was applied.")).toBeInTheDocument();
  expect(
    screen.queryByText("Confirm the recorded decision."),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("disables Send while a decision is in flight", async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  render(
    <TicketChat replyTransport={replyTransport(() => proposalReply())} />,
  );

  await send("Close the printer ticket");
  await userEvent.click(
    await screen.findByRole("button", { name: "Approve" }),
  );

  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  finish(Response.json({ outcome: "applied" }));
});

it("renders no cards for an empty search or a non-ticket", async () => {
  render(
    <TicketChat
      replyTransport={replyTransport((text) =>
        assistantReply({
          text: text,
          tools: [
            {
              name: "search_tickets",
              input: { query: text },
              output:
                text === "empty"
                  ? []
                  : [{ id: "99", note: "not a ticket" }, printer],
            },
          ],
        }),
      )}
    />,
  );

  await send("empty");
  const emptyResult = await screen.findByRole("article", {
    name: "Tickets chat agent",
  });
  expect(emptyResult).toHaveTextContent("search_tickets");
  expect(emptyResult).not.toHaveTextContent(printer.title);
  expect(emptyResult).not.toHaveTextContent("open");

  await send("mixed");
  const mixed = screen.getAllByRole("article", {
    name: "Tickets chat agent",
  })[1];
  expect(mixed).toHaveTextContent(printer.title);
  expect(mixed).not.toHaveTextContent("not a ticket");
  expect(mixed).not.toHaveTextContent("99");
});

it("shows an alert when a reply, decision, or reset fails", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/decisions") || url.includes("/api/reset")) {
        return new Response(null, { status: 500 });
      }
      return new Response(null, { status: 404 });
    }),
  );
  const { unmount } = render(
    <TicketChat
      replyTransport={replyTransport(() => {
        throw new Error("The reply failed.");
      })}
    />,
  );

  await send("Hello");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The reply failed.",
  );

  unmount();
  render(
    <TicketChat replyTransport={replyTransport(() => proposalReply())} />,
  );
  await send("Close it");
  await user.click(await screen.findByRole("button", { name: "Approve" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The decision was not recorded.",
  );

  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(await screen.findByText("Storage was not reset.")).toBeInTheDocument();
});

it("opens a new thread when the tenant changes and when storage resets", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
  render(
    <TicketChat
      replyTransport={replyTransport(() =>
        assistantReply({ text: "Tenant thread." }),
      )}
    />,
  );

  await send("Hello");
  expect(await screen.findByText("Tenant thread.")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("radio", { name: "Tenant B" }));
  expect(screen.queryByText("Tenant thread.")).not.toBeInTheDocument();
  expect(
    screen.getByText(
      "Ask about this tenant's tickets. Deletes and updates wait for approval.",
    ),
  ).toBeInTheDocument();

  await send("Hello again");
  expect(await screen.findByText("Tenant thread.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.queryByText("Tenant thread.")).not.toBeInTheDocument();
  expect(
    screen.getByText(
      "Ask about this tenant's tickets. Deletes and updates wait for approval.",
    ),
  ).toBeInTheDocument();
});
