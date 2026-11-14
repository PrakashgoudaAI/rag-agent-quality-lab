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

## Evidence selection candidate

A separate candidate asks the model for supporting document IDs, then constructs quotes and offsets from canonical text in code. Its curated glossary and weighted lexical ranking improve the known paraphrase retrieval case. The same evaluator remains in use; original labels and baselines are unchanged.

One frozen run passed 22/23 development cases and 14/16 author-created extension cases. Both full quality gates failed. Unsupported detail, a lexical miss and a dispatch/arrival confusion remain documented. These small, visible datasets do not establish general accuracy or independent readiness.

```sh
LOCAL_MODEL=qwen3:4b npm run evaluate:selection
LOCAL_MODEL=qwen3:4b npm run evaluate:extension
npm run audit:candidate
```

The audit recomputes saved experiment outcomes without calling a model. CI publishes those archived results alongside the original baseline and rejects inconsistent counts or fixture hashes. See [the selection design](docs/decisions/003-evidence-selection.md) and [full comparison](docs/experiments/README.md#evidence-selection-candidate).

## MCP write boundaries

The official MCP client/server SDK performs discovery and calls over paired in-memory transports. A fixed host identity, strict argument schema, editor role and host approval are required for `create_note`. Tool arguments cannot override the tenant. Identical key/payload requests replay one record; changed intent conflicts.

The runner limits actions and time and stops on denial or cancellation. Tests pause a handler before and after its write. Cancellation before commit prevents the effect; cancellation after commit leaves a record that the same request key can recover. See [the cancellation decision](docs/decisions/002-cancellation-and-replay.md). Replay state is session-local and not durable.

## Evidence and debugging

Run `npm test` to isolate implementation tests. The controlled HTTP server tests malformed JSON, unexpected status/media type, redirects, excessive streamed bytes, stalled bodies, cancellation and exhausted request budgets. They are protocol tests, not model quality measurements.

For a rejected model answer, inspect the row's schema, citation validity, context binding, evidence coverage and abstention checks. Compare corpus/dataset/request hashes before comparing runs. A valid quote can still be irrelevant. A failed request is a failed case, not an abstention.

On 14 November 2026, 27 implementation tests passed locally. The deterministic baseline passed 18 regression cases and failed all five challenges; ten calibration answers produced zero false accepts/rejects. Two actual local Qwen3 4B runs also failed the quality gate, with answerable coverage of 3/11 and 0/11. See [the measured results and limits](docs/experiments/).

The first milestone passed seven tests and five smoke cases. This milestone expands both the checks and failure visibility; its results are recorded under [experiments](docs/experiments/). Future work should improve retrieval and abstention against the fixed challenge labels, add independently reviewed cases and verify durable tool reconciliation before introducing automatic write retries.

Source and original synthetic fixtures are MIT licensed. Dependencies retain their licenses. The lint toolchain uses supported TypeScript 5.9.3 and a minimatch 11.0.1 override for its locked dependency tree.
