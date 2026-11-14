import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  retrieve,
  extract,
  supported,
  fingerprint,
  type Document,
} from "./retrieval.ts";
const corpus = JSON.parse(
  await readFile(new URL("../data/corpus.json", import.meta.url), "utf8"),
) as Document[];
const queries = JSON.parse(
  await readFile(new URL("../data/queries.json", import.meta.url), "utf8"),
) as {
  id: string;
  tenant: string;
  question: string;
  relevant: string[];
  answerId: string | null;
}[];
const rows = queries.map((q) => {
  const start = performance.now();
  const hits = retrieve(corpus, q.tenant, q.question);
  const answer = extract(corpus, q.tenant, hits);
  return {
    id: q.id,
    retrieved: hits.map((d) => d.id),
    recallAt2: q.relevant.length
      ? q.relevant.filter((id) => hits.some((d) => d.id === id)).length /
        q.relevant.length
      : null,
    correct: q.answerId
      ? answer.citations[0]?.id === q.answerId
      : answer.abstain,
    supported: supported(corpus, q.tenant, answer),
    latencyMs: performance.now() - start,
  };
});
const answerable = rows.filter((r) => r.recallAt2 !== null);
const report = {
  baseline: "lexical retrieval + exact extract; no model inference",
  corpusHash: fingerprint(corpus),
  datasetHash: fingerprint(queries),
  cases: rows.length,
  recallAt2:
    answerable.reduce((n, r) => n + (r.recallAt2 ?? 0), 0) / answerable.length,
  correct: rows.filter((r) => r.correct).length,
  supported: rows.filter((r) => r.supported).length,
  rows,
};
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/evaluation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (rows.some((r) => !r.correct || !r.supported)) process.exitCode = 1;
