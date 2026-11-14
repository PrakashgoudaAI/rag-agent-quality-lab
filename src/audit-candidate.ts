import { readFile, mkdir, writeFile } from "node:fs/promises";
import { loadDataset } from "./dataset.ts";
import { auditArchivedRun } from "./archived-run.ts";
const records = [];
for (const [set, file] of [
  ["development", "004-selection-development.json"],
  ["extension", "005-selection-extension.json"],
] as const) {
  const { corpus, queries } = await loadDataset(set);
  const report = auditArchivedRun(
    corpus,
    queries,
    JSON.parse(
      await readFile(
        new URL("../docs/experiments/" + file, import.meta.url),
        "utf8",
      ),
    ),
  );
  records.push({
    set,
    file,
    qualityPassed: report.qualityPassed,
    cases: queries.length,
    correct: report.rows.filter((r) => r.correct).length,
    failures: report.rows.filter((r) => !r.correct).map((r) => r.id),
  });
}
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/candidate-audit.json",
  JSON.stringify(records, null, 2) + "\n",
);
await writeFile(
  "reports/candidate-audit.md",
  "# Archived selection candidate\n\nThis is a consistency audit of saved observations, not a CI model inference run.\n\n" +
    records
      .map(
        (r) =>
          `${r.set}: ${r.correct}/${r.cases}; quality gate ${r.qualityPassed ? "passed" : "FAILED"}. Failures: ${r.failures.join(", ") || "none"}.`,
      )
      .join("\n\n") +
    "\n",
);
console.log(JSON.stringify(records, null, 2));
