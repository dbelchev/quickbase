import { __REPOSITORY__ } from "./repository";
import { __SERVICE__ } from "./service";

export function createServices() {
  const repository = new __REPOSITORY__();
  return {
    service: new __SERVICE__(repository),
  };
}
