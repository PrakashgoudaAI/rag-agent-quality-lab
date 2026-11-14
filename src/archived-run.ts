import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { scoreAnswer, summarize, type Query } from "./evaluation.ts";
import { type Document } from "./retrieval.ts";
const archivedSchema = z.object({
  qualityPassed: z.boolean(),
  corpusHash: z.string(),
  datasetHash: z.string(),
  suites: z.record(z.string(), z.unknown()),
  rows: z.array(
    z.object({
      id: z.string(),
      suite: z.enum(["regression", "challenge"]),
      category: z.string(),
      retrieved: z.array(z.string()),
      latencyMs: z.number().nonnegative(),
      correct: z.boolean(),
    }),
  ),
  observations: z.array(
    z.object({
      id: z.string(),
      answer: z.unknown().optional(),
      error: z.string().optional(),
    }),
  ),
});
export function auditArchivedRun(
  corpus: Document[],
  queries: Query[],
  raw: unknown,
) {
  const saved = archivedSchema.parse(raw);
  if (
    saved.observations.length !== queries.length ||
    new Set(saved.observations.map((o) => o.id)).size !== queries.length
  )
    throw new Error("Incomplete archived observations.");
  const rows = saved.rows.map((row) => {
    const q = queries.find((q) => q.id === row.id);
    const observation = saved.observations.find((o) => o.id === row.id);
    if (!q || !observation) throw new Error("Unknown archived case.");
    if (
      (observation.error !== undefined) ===
      (observation.answer !== undefined)
    )
      throw new Error(
        "Archived observation needs exactly one answer or error.",
      );
    const hits = row.retrieved.map((id) => {
      const d = corpus.find(
        (d) => d.id === id && d.tenant === q.tenant && d.current,
      );
      if (!d) throw new Error("Archived retrieval crossed its boundary.");
      return d;
    });
    const score = scoreAnswer(
      corpus,
      q,
      hits,
      observation.error !== undefined ? null : observation.answer,
    );
    if (score.correct !== row.correct)
      throw new Error("Archived case outcome disagrees with its answer.");
    return { ...row, ...score };
  });
  const recomputed = summarize(corpus, queries, rows);
  if (
    saved.corpusHash !== recomputed.corpusHash ||
    saved.datasetHash !== recomputed.datasetHash ||
    saved.qualityPassed !== recomputed.qualityPassed ||
    !isDeepStrictEqual(saved.suites, recomputed.suites)
  )
    throw new Error(
      "Archived outcome or fixture identity does not match its observations.",
    );
  return recomputed;
}
