import { ai } from "@ax-llm/ax";
import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { ModelFactoryService } from "../src";

vi.mock("@ax-llm/ax", () => ({
  ai: vi.fn(),
}));

describe("ModelFactoryService", () => {
  it("rejects an empty api key before creating a model", () => {
    expect(() =>
      new ModelFactoryService().create({
        providerName: "fireworks",
        apiKey: "",
        config: { model: "accounts/fireworks/models/gpt-oss-120b" },
      }),
    ).toThrow(ZodError);
    expect(ai).not.toHaveBeenCalled();
  });

  it("returns the configured model id on the service", () => {
    const service = {};
    vi.mocked(ai).mockReturnValueOnce(service as never);
    const created = new ModelFactoryService().create({
      providerName: "fireworks",
      apiKey: "key",
      config: { model: "accounts/fireworks/models/gpt-oss-120b" },
    });
    expect(created.modelId).toBe("accounts/fireworks/models/gpt-oss-120b");
  });
});
