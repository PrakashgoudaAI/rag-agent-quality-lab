# Local Qwen3 4B extraction runs

Measured on 14 November 2026 with the installed `qwen3:4b` model. Both runs failed the complete quality gate. The model is an optional evaluated target; its answers do not replace the deterministic baseline or authorize MCP actions.

| Prompt | Regression cases | Challenge cases | Answerable cases | Required refusals |
| --- | --- | --- | --- | --- |
| Initial, identity omitted | 12/18 | 3/5 | 3/11 | 12/12 |
| Explicit tenant identity | 9/18 | 3/5 | 0/11 | 12/12 |

The first run answered three answerable questions and abstained on the other eight. The follow-up abstained on every case. Schema-valid refusals can have valid empty citations while still failing the answer task. Reporting answerable cases separately prevents the twelve required refusals from masking this behavior.

Both versions used the same visible dataset and settings. The second prompt added tenant identity after inspection of the first prompt, so this is a development comparison, not a held-out study or evidence of a causal effect from that field. A single pass per version cannot establish statistical significance or reliable model performance. No labels or acceptance thresholds were changed between runs.

## Environment and settings

- Model digest: `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7` (read from the local server's model inventory).
- Ollama 0.40.5; Node.js 24.4.0; macOS arm64; Apple M4 Pro, 12 logical CPUs.
- Temperature 0, thinking disabled, 512 generated-token limit, 4,096 context tokens.
- One sequential call per case, 23 calls per run. Ten-second request and two-minute run deadlines; 16 KiB request and 64 KiB response caps. Neither run had a transport/schema error or retry.
- The existing local model was used without downloading weights. The temporary loopback server ran with `OLLAMA_NO_CLOUD=1` and `OLLAMA_NOPRUNE=1`, then was stopped. No external model endpoint was called.

The initial run's measured requests totaled 12.05 seconds (p50 350 ms, p95 1,136 ms), with 7,230 reported prompt tokens and 573 completion tokens. The scoped run totaled 9.32 seconds (p50 354 ms, p95 431 ms), with 7,322 prompt tokens and 446 completion tokens. These are end-to-end observations on one host; model loading time was not isolated. They are not capacity estimates or a latency improvement claim; answer lengths also differ. No monetary cost is inferred.

## Reproduce and inspect

```sh
LOCAL_MODEL=qwen3:4b npm run evaluate:model
```

Use an already installed model and a local Ollama server. The command uses the current scoped prompt, records a report and exits 1 if any case fails. `LOCAL_MODEL_DIGEST` optionally records the digest you read from your local model inventory; the runner does not independently verify that supplied value. Request hashes identify each exact payload. Fixture and evaluator hashes/version are retained in each report.

The full observations are in [the initial run](001-qwen3-4b-initial.json) and [the scoped follow-up](002-qwen3-4b-scoped.json). Both reports retain parsed answers, per-case checks, request fingerprints and usage fields. They contain only synthetic data. Their metric schema predates the added answerable/refusal aggregate fields; the table above is derived from their per-case rows and the unchanged query labels.

Next work should diagnose over-abstention on a small development subset, then evaluate a frozen candidate on independently labeled unseen questions. Retrieval must also improve: the paraphrase case had no retrieved evidence, which a model should not fill using unsupported memory. Keep this failed baseline available for comparison.
