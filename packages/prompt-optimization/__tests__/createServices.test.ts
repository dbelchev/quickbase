import { describe, expect, it } from "vitest";
import {
  createServices,
  ModelFactoryService,
  OptimizeInstructionsService,
  ScoreInstructionsService,
} from "../src";

describe("createServices", () => {
  it("returns the services", () => {
    expect(createServices()).toEqual({
      modelFactory: expect.any(ModelFactoryService),
      scoreInstructions: expect.any(ScoreInstructionsService),
      optimizeInstructions: expect.any(OptimizeInstructionsService),
    });
  });
});
