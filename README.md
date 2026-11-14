# Retrieval and Agent Quality Lab

A small TypeScript harness for separating retrieval correctness, answer evidence and tool execution policy. The corpus and actions are synthetic. It runs without an account, model endpoint or API key.

```sh
npm ci --ignore-scripts
npm run verify
```

Use Node.js 24. Verification checks TypeScript, promise-handling lint and formatting, runs the tests and writes `reports/evaluation.json`. The report records corpus/dataset hashes, per-case retrieval IDs, recall at two for answerable cases, expected answer/abstention checks and local latency. The five-case fixture is a smoke dataset, not an estimate of real-world accuracy.

## Retrieval and evidence

`src/retrieval.ts` filters tenant and current-version documents before lexical ranking. The baseline copies one canonical document into its answer. Citations contain IDs, character ranges and exact text; the verifier checks all three against the authorized canonical corpus and requires the answer to equal those spans. Altered retrieved text, foreign/stale citations and fabricated answer text are rejected by negative controls.

This is an exact extraction baseline. It does not run an LLM, compute embeddings or judge semantic entailment. Lexical overlap can retrieve irrelevant text, and exact citation support alone does not establish relevance. Expected document/abstention labels are checked separately. A modified-context fixture tests one injection pattern; it does not establish general prompt-injection resistance.

## MCP tool policy

`src/tools.ts` connects the official MCP client and server through paired in-memory transports. Tests perform discovery and tool calls through the protocol. The host supplies a fixed identity; tool arguments cannot choose a tenant. A strict input schema, editor role and explicit host approval are required to create a synthetic note. Repeating the same key/payload returns the same note; changing the payload conflicts.

The action runner allows only the registered write tool, caps steps and duration, and checks cancellation before every call. It stops after a tool denial. The initial tests cover pre-cancellation and the step limit; they do not demonstrate rollback of a request already accepted by a remote tool. Notes and replay state are in memory for one session. There is no claim of durable or cross-process idempotency, OAuth authentication or network transport coverage.

The SDK integration follows the [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x), pinned in the lockfile. Transport and identity establishment are deliberately distinct concerns.

## Current evidence and next work

On 2 November 2026, strict TypeScript checks and seven tests passed locally with Node.js 24.4.0 on macOS. The smoke evaluation returned the expected result for all five cases, with recall at two of 1.0 over the two answerable cases. These measurements describe the checked-in deterministic fixtures. A source-only copy in a path containing a space also passed a fresh locked installation and the full verification command. No model-backed quality result or hosted CI run is claimed.

Next work: expand labeled adversarial/relevance cases, add a bounded local model adapter and evaluate its responses using the same canonical evidence checks. Test cancellation during a delayed tool request and define reconciliation for ambiguous write outcomes before introducing automatic retries.

All fixtures are original synthetic examples. Source is MIT licensed; dependencies retain their own licenses.

The lint toolchain uses TypeScript 5.9.3, within its supported peer range. A minimatch 11.0.1 override keeps the locked lint dependency tree patched.
