import { retrieveExpanded, retrievalVersion } from "./selection.ts";
import { platform, arch, cpus, totalmem } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { loadDataset } from "./dataset.ts";
import { LocalModel } from "./ollama.ts";
import { retrieve } from "./retrieval.ts";
import { scoreAnswer, summarize, type ScoredRow } from "./evaluation.ts";
const args = process.argv.slice(2);
if (args.some((a) => !["--selection", "--extension"].includes(a)))
  throw new Error("Unknown evaluation option.");
const selecting = args.includes("--selection");
const extension = args.includes("--extension");
const model = process.env.LOCAL_MODEL;
if (!model)
  throw new Error(
    "Set LOCAL_MODEL to an already installed Ollama model. No models are downloaded by this command.",
  );
const { corpus, queries } = await loadDataset(
  extension ? "extension" : "development",
);
const adapter = new LocalModel({
  model,
  mode: selecting ? "select" : "extract",
  maxRequests: queries.length,
  timeoutMs: 10000,
});
const deadline = AbortSignal.timeout(120000);
const rows: ScoredRow[] = [];
const observations = [];
for (const q of queries) {
  const hits = (selecting ? retrieveExpanded : retrieve)(
    corpus,
    q.tenant,
    q.question,
  );
  const start = performance.now();
  try {
    const result = await adapter.answer(corpus, q, hits, deadline);
    rows.push({
      id: q.id,
      suite: q.suite,
      category: q.category,
      retrieved: hits.map((d) => d.id),
      ...scoreAnswer(corpus, q, hits, result.answer),
      latencyMs: result.latencyMs,
    });
    observations.push({ id: q.id, ...result });
  } catch (error) {
    rows.push({
      id: q.id,
      suite: q.suite,
      category: q.category,
      retrieved: hits.map((d) => d.id),
      ...scoreAnswer(corpus, q, hits, null),
      latencyMs: performance.now() - start,
    });
    observations.push({
      id: q.id,
      error: error instanceof Error ? error.message : "Request failed.",
    });
  }
}
const report = {
  model,
  evaluationSet: extension ? "author-extension" : "development",
  pipeline: selecting ? "selection" : "extract",
  retrievalVersion: selecting ? retrievalVersion : "overlap-v1",
  modelDigest: process.env.LOCAL_MODEL_DIGEST ?? null,
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model ?? null,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
  },
  settings: {
    temperature: 0,
    think: false,
    numPredict: 512,
    numCtx: 4096,
    requestTimeoutMs: 10000,
    runTimeoutMs: 120000,
  },
  requests: adapter.requests,
  promptVersion: selecting ? "evidence-selection-v1" : "canonical-extract-v2",
  ...summarize(corpus, queries, rows),
  observations,
};
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/model-evaluation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      model,
      requests: adapter.requests,
      qualityPassed: report.qualityPassed,
      suites: report.suites,
    },
    null,
    2,
  ),
);
if (!report.qualityPassed) process.exitCode = 1;
