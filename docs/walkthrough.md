# Review an answer and a cancelled tool call

Run `npm ci` and `npm run verify` on Node 24. This checks types, lint, formatting, 36 implementation tests, the deterministic evaluation and archived candidate consistency. It does not require a model download or a running model endpoint.

## A green engineering run can contain a failed model gate

Read `docs/evaluation-design.md`, then the archived experiment index. The deterministic baseline passes 18 regression cases and fails all five challenges. Calibration checks the scorer against authored answers; it does not establish general model accuracy.

The frozen selection candidate scored 22/23 on development cases and 14/16 on an author-written extension. Both full quality gates failed. Follow the individual records for unsupported warranty transfer, missed pickup wording and confusion between dispatch and arrival. Do not replace those records with an average or tune against the extension while continuing to call it unseen. Source hashes and the freeze plan make the ordering inspectable; independent review of labels is still needed.

`npm run evaluate:quality` provides the deliberately strict quality exit status. `npm run verify` checks implementation and report integrity while retaining the failed quality outcomes. Its green result is not permission to deploy the model.

## A timed-out write may still have happened

Read `docs/decisions/002-cancellation-and-replay.md` alongside the MCP tests. The suite covers bounded calls, cancellation and replay behavior. Cancellation ends the caller's wait; it is not evidence that a remote side effect was rolled back. A write with an uncertain result needs reconciliation using its original intent and identity before any retry.

This repository exercises synthetic tools and local transports. It does not claim durable cross-service reconciliation, production agent reliability, independent benchmark review or a general defense against prompt injection. Those are separate acceptance criteria, not conclusions from passing implementation tests.
