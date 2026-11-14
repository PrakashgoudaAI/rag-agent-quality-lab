import { test } from "node:test";
import assert from "node:assert/strict";
import { toolSession, runActions } from "../src/tools.ts";
const action = {
  name: "create_note",
  arguments: { title: "Synthetic review", requestKey: "review-001" },
};
await test("MCP discovery, replay and conflict preserve one effect", async () => {
  const s = await toolSession({
    tenant: "alpha",
    role: "editor",
    approved: true,
  });
  try {
    assert.equal((await s.client.listTools()).tools[0]?.name, "create_note");
    const a = await s.client.callTool(action);
    const b = await s.client.callTool(action);
    assert.deepEqual(a, b);
    assert.equal(s.notes.size, 1);
    assert.equal(
      (
        await s.client.callTool({
          ...action,
          arguments: { ...action.arguments, title: "Changed" },
        })
      ).isError,
      true,
    );
    assert.equal(s.notes.size, 1);
  } finally {
    await s.close();
  }
});
await test("viewer and unapproved writers are denied through MCP", async () => {
  for (const actor of [
    { tenant: "alpha", role: "viewer" as const, approved: true },
    { tenant: "alpha", role: "editor" as const, approved: false },
  ]) {
    const s = await toolSession(actor);
    try {
      assert.equal((await s.client.callTool(action)).isError, true);
      assert.equal(s.notes.size, 0);
    } finally {
      await s.close();
    }
  }
});
await test("tool arguments cannot override tenant or bypass validation", async () => {
  const s = await toolSession({
    tenant: "alpha",
    role: "editor",
    approved: true,
  });
  try {
    for (const args of [
      { ...action.arguments, tenant: "beta" },
      { ...action.arguments, title: "" },
      { title: "x", requestKey: "bad" },
    ]) {
      assert.equal(
        (await s.client.callTool({ name: "create_note", arguments: args }))
          .isError,
        true,
      );
    }
    assert.equal(s.notes.size, 0);
  } finally {
    await s.close();
  }
});
await test("step budget, pre-cancellation and unknown tools prevent extra effects", async () => {
  const s = await toolSession({
    tenant: "alpha",
    role: "editor",
    approved: true,
  });
  try {
    await assert.rejects(
      runActions(
        s.client,
        [
          action,
          {
            ...action,
            arguments: { title: "Second", requestKey: "review-002" },
          },
        ],
        { maxSteps: 1, timeoutMs: 1000 },
      ),
      /budget/,
    );
    assert.equal(s.notes.size, 1);
    await assert.rejects(
      runActions(s.client, [action], {
        maxSteps: 2,
        timeoutMs: 1000,
        signal: AbortSignal.abort(),
      }),
    );
    await assert.rejects(
      runActions(s.client, [{ name: "shell", arguments: {} }], {
        maxSteps: 2,
        timeoutMs: 1000,
      }),
      /allowed/,
    );
    assert.equal(s.notes.size, 1);
  } finally {
    await s.close();
  }
});
