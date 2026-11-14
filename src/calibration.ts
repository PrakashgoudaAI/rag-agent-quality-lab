import { readFile } from "node:fs/promises";
import { z } from "zod";
import { scoreAnswer, type Query } from "./evaluation.ts";
import { fingerprint, retrieve, type Document } from "./retrieval.ts";
const fixtureSchema = z
  .object({
    id: z.string().min(1),
    queryId: z.string().min(1),
    answer: z.unknown(),
    expectedCorrect: z.boolean(),
  })
  .strict();
export async function calibrate(corpus: Document[], queries: Query[]) {
  const fixtures = z
    .array(fixtureSchema)
    .min(1)
    .parse(
      JSON.parse(
        await readFile(
          new URL("../data/calibration.json", import.meta.url),
          "utf8",
        ),
      ),
    );
  if (new Set(fixtures.map((f) => f.id)).size !== fixtures.length)
    throw new Error("Duplicate calibration ID.");
  const rows = fixtures.map((f) => {
    const q = queries.find((q) => q.id === f.queryId);
    if (!q) throw new Error("Unknown calibration query.");
    const observed = scoreAnswer(
      corpus,
      q,
      retrieve(corpus, q.tenant, q.question),
      f.answer,
    ).correct;
    return { id: f.id, expected: f.expectedCorrect, observed };
  });
  const falseAccepts = rows.filter((r) => r.observed && !r.expected).length;
  const falseRejects = rows.filter((r) => !r.observed && r.expected).length;
  return {
    fixtureHash: fingerprint(fixtures),
    cases: rows.length,
    falseAccepts,
    falseRejects,
    passed: falseAccepts === 0 && falseRejects === 0,
    rows,
  };
}
