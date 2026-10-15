import {
  ModelFactoryService,
  OptimizeInstructionsService,
  ScoreInstructionsService,
} from "./service";

export function createServices() {
  const scoreInstructions = new ScoreInstructionsService();
  return {
    modelFactory: new ModelFactoryService(),
    scoreInstructions,
    optimizeInstructions: new OptimizeInstructionsService(scoreInstructions),
  };
}
