import { afterEach, describe, expect, it } from "vitest";
import { createServices, TicketsAgentService } from "../src";

const ENV_KEY = "GEMINI_TEST_API_KEY";

describe("createServices", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("returns a tickets chat agent", () => {
    process.env[ENV_KEY] = "test-key";

    const { ticketsAgent: ticketsChatAgent } = createServices();

    expect(ticketsChatAgent).toBeInstanceOf(TicketsAgentService);
  });
});
