import { createRepository } from "./repository";
import { __SERVICE__ } from "./service";

export function createServices() {
  const repository = createRepository();
  return {
    service: new __SERVICE__(repository),
  };
}
