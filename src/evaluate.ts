import { calibrate } from "./calibration.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { loadDataset } from "./dataset.ts";
import { retrieve, extract } from "./retrieval.ts";
import { scoreAnswer, summarize } from "./evaluation.ts";
const { corpus, queries } = await loadDataset();
const rows = queries.map((q) => {
  const start = performance.now();
  const hits = retrieve(corpus, q.tenant, q.question);
  const answer = extract(corpus, q.tenant, hits);
  return {
    id: q.id,
    suite: q.suite,
    category: q.category,
    retrieved: hits.map((d) => d.id),
    ...scoreAnswer(corpus, q, hits, answer),
    latencyMs: performance.now() - start,
  };
});
const report = {
  baseline: "lexical retrieval + exact extract; no model inference",
  ...summarize(corpus, queries, rows),
  calibration: await calibrate(corpus, queries),
};
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/evaluation.json",
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  "reports/quality-summary.md",
  `# Retrieval baseline results

Engineering regression gate: ${report.regressionPassed ? "passed" : "FAILED"}.

Dataset quality gate: ${report.qualityPassed ? "passed" : "FAILED"}.

Regressions: ${report.suites.regression.correct}/${report.suites.regression.cases}. Challenges: ${report.suites.challenge.correct}/${report.suites.challenge.cases}.

Evaluator calibration: ${report.calibration.cases} synthetic labeled answers, ${report.calibration.falseAccepts} false accepts and ${report.calibration.falseRejects} false rejects.

Failed cases: ${
    rows
      .filter((r) => !r.correct)
      .map((r) => r.id)
      .join(", ") || "none"
  }.

A green engineering check does not establish answer quality. Run npm run evaluate:quality to enforce all cases; the current baseline fails that gate.
`,
);
console.log(
  JSON.stringify(
    {
      regressionPassed: report.regressionPassed,
      qualityPassed: report.qualityPassed,
      suites: report.suites,
      failures: rows.filter((r) => !r.correct).map((r) => r.id),
    },
    null,
    2,
  ),
);
if (
  !report.regressionPassed ||
  !report.calibration.passed ||
  (process.argv.includes("--strict") && !report.qualityPassed)
)
  process.exitCode = 1;
