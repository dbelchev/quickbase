import { describe, expect, it } from "vitest";
import { createServices } from "./index";

describe("createServices", () => {
  it("returns the services", () => {
    expect(createServices()).toEqual({ service: {} });
  });
});
