import { describe, expect, it } from "vitest";
import { __SERVICE__, createServices } from "../src";

describe("createServices", () => {
  it("returns the services", () => {
    expect(createServices()).toEqual({
      service: expect.any(__SERVICE__),
    });
  });
});
