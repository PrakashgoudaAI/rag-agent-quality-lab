# Retrieval and Agent Quality Lab

TypeScript checks for retrieval relevance, answer evidence and MCP write boundaries. The documents, tenants and actions are synthetic. The default checks need Node.js 24, with no model service or API key.

```sh
npm ci --ignore-scripts
npm run verify
```

The suite checks types, promise handling, formatting, HTTP adapter faults, evaluator calibration and real MCP calls through linked transports. Reports are written to ignored `reports/`.

## What the baseline shows

Nine documents and twenty-three labeled queries cover current/stale policies, tenant boundaries, lookup, irrelevant overlap, missing evidence and refusal. The lexical retriever passes eighteen regression cases and fails all five challenges. The complete quality gate is **failing**. Those failures are kept visible as development targets.

```sh
npm run evaluate          # regression check plus the complete quality report
npm run evaluate:quality  # enforces every case; currently exits 1
```

An answer must quote complete required paragraphs, cite exact ranges in authorized current documents, and use evidence actually retrieved. Correct citations alone cannot make an irrelevant or incomplete answer pass. Ten synthetic calibration answers check false accepts and false rejects. See [the rubric and denominators](docs/evaluation-design.md).

## Local model evaluation

The optional adapter uses Ollama's [chat API](https://docs.ollama.com/api/chat) with a [JSON output schema](https://docs.ollama.com/capabilities/structured-outputs). Start your already installed local Ollama service, then select an installed model:

```sh
LOCAL_MODEL=qwen3:4b npm run evaluate:model
```

The command never downloads a model. It allows a loopback HTTP origin, refuses redirects and bounds requests, bytes, generation length and elapsed time. There are no automatic retries or answer repairs. It does not execute model tool suggestions. Model setup and structured-output compatibility remain local prerequisites; the adapter cannot control whether an independently configured server proxies requests elsewhere. The recorded experiment disables cloud features.

The output is `reports/model-evaluation.json`; any failed case makes the command exit 1. The scorer uses the same reference labels as the deterministic baseline. Exact extraction results should not be presented as general language-model accuracy.

## MCP write boundaries

The official MCP client/server SDK performs discovery and calls over paired in-memory transports. A fixed host identity, strict argument schema, editor role and host approval are required for `create_note`. Tool arguments cannot override the tenant. Identical key/payload requests replay one record; changed intent conflicts.

The runner limits actions and time and stops on denial or cancellation. Tests pause a handler before and after its write. Cancellation before commit prevents the effect; cancellation after commit leaves a record that the same request key can recover. See [the cancellation decision](docs/decisions/002-cancellation-and-replay.md). Replay state is session-local and not durable.

## Evidence and debugging

Run `npm test` to isolate implementation tests. The controlled HTTP server tests malformed JSON, unexpected status/media type, redirects, excessive streamed bytes, stalled bodies, cancellation and exhausted request budgets. They are protocol tests, not model quality measurements.

For a rejected model answer, inspect the row's schema, citation validity, context binding, evidence coverage and abstention checks. Compare corpus/dataset/request hashes before comparing runs. A valid quote can still be irrelevant. A failed request is a failed case, not an abstention.

On 14 November 2026, 27 implementation tests passed locally. The deterministic baseline passed 18 regression cases and failed all five challenges; ten calibration answers produced zero false accepts/rejects. Two actual local Qwen3 4B runs also failed the quality gate, with answerable coverage of 3/11 and 0/11. See [the measured results and limits](docs/experiments/).

The first milestone passed seven tests and five smoke cases. This milestone expands both the checks and failure visibility; its results are recorded under [experiments](docs/experiments/). Future work should improve retrieval and abstention against the fixed challenge labels, add independently reviewed cases and verify durable tool reconciliation before introducing automatic write retries.

Source and original synthetic fixtures are MIT licensed. Dependencies retain their licenses. The lint toolchain uses supported TypeScript 5.9.3 and a minimatch 11.0.1 override for its locked dependency tree.
