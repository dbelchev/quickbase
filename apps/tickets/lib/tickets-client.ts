import createClient from "openapi-fetch";
import type { paths } from "./tickets-api";

export const ticketsApi = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  // Read fetch at call time so tests can replace global fetch after import.
  fetch: (input: Request) => globalThis.fetch(input),
});

type ChatPost = paths["/api/chat"]["post"];
type DecisionPost = paths["/api/decisions"]["post"];

export type TenantId = ChatPost["parameters"]["header"]["x-tenant-id"];

export type ChatRequest = {
  headers: ChatPost["parameters"]["header"];
  body: ChatPost["requestBody"]["content"]["application/json"];
};

export type Decision =
  DecisionPost["requestBody"]["content"]["application/json"]["decision"];

export type DecisionOutcome =
  DecisionPost["responses"][200]["content"]["application/json"]["outcome"];
