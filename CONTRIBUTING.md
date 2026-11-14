# Contributing

Run `npm ci --ignore-scripts` and `npm run verify` with Node.js 24. Keep fixtures synthetic. Add labeled cases when changing retrieval behavior and negative controls when changing evidence or tool policy. Preserve separate retrieval and answer measurements; report dataset changes with their hashes. Do not commit reports, credentials or real customer documents.

Keep challenge failures in the report. `npm run evaluate:quality` intentionally fails until all labeled cases are satisfied; do not relabel a failure to make the baseline green. Record model experiments separately from deterministic CI. Cancellation changes need tests on both sides of the commit boundary, including the ambiguous-response case.
