import { createRepository } from "../repository";

type Repository = ReturnType<typeof createRepository>;

export function createService(_repository: Repository) {
  return {};
}
