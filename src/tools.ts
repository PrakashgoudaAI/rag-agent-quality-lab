import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
export interface Identity {
  tenant: string;
  role: "editor" | "viewer";
  approved: boolean;
}
export interface WriteLifecycle {
  beforeCommit?: (signal: AbortSignal) => Promise<void>;
  afterCommit?: (signal: AbortSignal) => Promise<void>;
}
export async function toolSession(
  identity: Identity,
  lifecycle: WriteLifecycle = {},
) {
  // Identity is established by the host, never taken from tool arguments.
  const actor = Object.freeze({ ...identity });
  const notes = new Map<
    string,
    { id: number; tenant: string; title: string }
  >();
  const server = new McpServer({
    name: "synthetic-note-service",
    version: "0.1.0",
  });
  server.registerTool(
    "create_note",
    {
      description: "Create an approved synthetic note with replay protection.",
      inputSchema: z
        .object({
          title: z.string().min(1).max(120),
          requestKey: z.string().regex(/^[a-z0-9-]{8,64}$/),
        })
        .strict(),
    },
    async ({ title, requestKey }, extra) => {
      if (actor.role !== "editor" || !actor.approved)
        return {
          isError: true,
          content: [{ type: "text", text: "Write denied." }],
        };
      // The host may pause storage at this boundary; tool callers cannot supply hooks.
      await lifecycle.beforeCommit?.(extra.signal);
      extra.signal.throwIfAborted();
      const existing = notes.get(requestKey);
      if (existing && existing.title !== title)
        return {
          isError: true,
          content: [{ type: "text", text: "Request key conflict." }],
        };
      const note = existing ?? {
        id: notes.size + 1,
        tenant: actor.tenant,
        title,
      };
      notes.set(requestKey, note);
      await lifecycle.afterCommit?.(extra.signal);
      return { content: [{ type: "text", text: JSON.stringify(note) }] };
    },
  );
  const client = new Client({ name: "quality-harness", version: "0.1.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  return {
    client,
    notes,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
export interface Action {
  name: string;
  arguments: Record<string, unknown>;
}
export async function runActions(
  client: Client,
  actions: Action[],
  options: { maxSteps: number; timeoutMs: number; signal?: AbortSignal },
) {
  if (
    !Number.isInteger(options.maxSteps) ||
    options.maxSteps < 1 ||
    options.maxSteps > 20 ||
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs <= 0 ||
    options.timeoutMs > 30000
  )
    throw new Error("Invalid execution budget.");
  const signal = AbortSignal.any([
    AbortSignal.timeout(options.timeoutMs),
    ...(options.signal ? [options.signal] : []),
  ]);
  const results = [];
  for (const action of actions) {
    signal.throwIfAborted();
    if (results.length >= options.maxSteps)
      throw new Error("Step budget exhausted.");
    if (action.name !== "create_note") throw new Error("Tool is not allowed.");
    const result = await client.callTool(action, undefined, {
      signal,
      timeout: options.timeoutMs,
    });
    results.push(result);
    if (result.isError) throw new Error("Tool denied the action.");
  }
  return results;
}
