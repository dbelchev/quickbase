import type { ModelMessage } from "ai";
import type { TenantId, ThreadRecord } from "../model";

export class ThreadService {
  private readonly threads = new Map<string, ThreadRecord>();

  reset(): void {
    this.threads.clear();
  }

  bind(tenantId: TenantId, threadId: string): "ok" | "mismatch" {
    const existing = this.threads.get(threadId);
    if (!existing) {
      this.threads.set(threadId, { tenantId, messages: [] });
      return "ok";
    }
    return existing.tenantId === tenantId ? "ok" : "mismatch";
  }

  messages(threadId: string): ModelMessage[] {
    const messages = this.threads.get(threadId)?.messages ?? [];
    return messages as ModelMessage[];
  }

  setMessages(threadId: string, messages: ModelMessage[]): void {
    const thread = this.threads.get(threadId);
    if (thread) thread.messages = messages;
  }
}
