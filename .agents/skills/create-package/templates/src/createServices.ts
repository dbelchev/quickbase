import { createRepository } from "./repository";
import { createService } from "./service";

export function createServices() {
  const repository = createRepository();
  return createService(repository);
}
