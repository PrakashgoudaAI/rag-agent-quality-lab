import { z } from "zod";
import {
  fingerprint,
  supported,
  type Answer,
  type Document,
} from "./retrieval.ts";
export const answerSchema = z
  .object({
    answer: z.string().max(12000),
    citations: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            start: z.number().int().nonnegative(),
            end: z.number().int().positive(),
            quote: z.string().min(1).max(6000),
          })
          .strict(),
      )
      .max(8),
    abstain: z.boolean(),
  })
  .strict();
export const querySchema = z
  .object({
    id: z.string().min(1),
    suite: z.enum(["regression", "challenge"]),
    category: z.string().min(1),
    tenant: z.string().min(1),
    question: z.string().min(1).max(2000),
    relevant: z.array(z.string()).max(8),
    expected: z
      .object({ abstain: z.boolean(), evidence: z.array(z.string()).max(8) })
      .strict(),
  })
  .strict();
export type Query = z.infer<typeof querySchema>;
export function validateDataset(corpus: Document[], queries: Query[]) {
  if (!corpus.length || !queries.length)
    throw new Error("Empty corpus or dataset.");
  for (const values of [corpus.map((d) => d.id), queries.map((q) => q.id)])
    if (new Set(values).size !== values.length)
      throw new Error("Duplicate fixture ID.");
  for (const q of queries) {
    if (q.expected.abstain !== !q.expected.evidence.length)
      throw new Error("Abstention and evidence labels disagree.");
    for (const list of [q.relevant, q.expected.evidence]) {
      if (new Set(list).size !== list.length)
        throw new Error("Duplicate evidence label.");
      for (const id of list)
        if (
          !corpus.some((d) => d.id === id && d.tenant === q.tenant && d.current)
        )
          throw new Error("Label references unavailable evidence.");
    }
    if (q.expected.evidence.some((id) => !q.relevant.includes(id)))
      throw new Error("Expected evidence is not relevant.");
  }
}
export function scoreAnswer(
  corpus: Document[],
  q: Query,
  hits: Document[],
  raw: unknown,
) {
  const parsed = answerSchema.safeParse(raw);
  const valid = parsed.success;
  const answer = parsed.success ? parsed.data : undefined;
  const citations = answer?.citations ?? [];
  const cited = new Set(
    citations
      .filter((c) =>
        corpus.some(
          (d) =>
            d.id === c.id &&
            c.start === 0 &&
            c.end === d.text.length &&
            c.quote === d.text,
        ),
      )
      .map((c) => c.id),
  );
  const evidenceCoverage = q.expected.evidence.length
    ? q.expected.evidence.filter((id) => cited.has(id)).length /
      q.expected.evidence.length
    : null;
  const evidenceRelevant =
    citations.length > 0 && citations.every((c) => q.relevant.includes(c.id));
  const citationValid = !!answer && supported(corpus, q.tenant, answer);
  const evidenceUnique =
    new Set(citations.map((c) => c.id)).size === citations.length;
  const contextBound = citations.every((c) =>
    hits.some(
      (h) =>
        h.id === c.id &&
        corpus.some(
          (d) =>
            d.id === h.id &&
            d.text === h.text &&
            d.tenant === q.tenant &&
            d.current,
        ),
    ),
  );
  const abstentionCorrect = !!answer && answer.abstain === q.expected.abstain;
  const correct =
    valid &&
    citationValid &&
    evidenceUnique &&
    contextBound &&
    abstentionCorrect &&
    (q.expected.abstain || (evidenceCoverage === 1 && evidenceRelevant));
  return {
    schemaValid: valid,
    expectedAbstention: q.expected.abstain,
    answerAbstained: answer?.abstain ?? null,
    evidenceUnique,
    contextBound,
    citationValid,
    abstentionCorrect,
    evidenceCoverage,
    evidenceRelevant,
    correct,
    recallAt2: q.relevant.length
      ? q.relevant.filter((id) => hits.some((d) => d.id === id)).length /
        q.relevant.length
      : null,
    precisionAt2: hits.length
      ? hits.filter((d) => q.relevant.includes(d.id)).length / hits.length
      : null,
  };
}
export type ScoredRow = ReturnType<typeof scoreAnswer> & {
  id: string;
  suite: Query["suite"];
  category: string;
  latencyMs: number;
  retrieved: string[];
};
export function summarize(
  corpus: Document[],
  queries: Query[],
  rows: ScoredRow[],
) {
  if (
    rows.length !== queries.length ||
    new Set(rows.map((r) => r.id)).size !== queries.length ||
    queries.some(
      (q) =>
        !rows.some(
          (r) =>
            r.id === q.id && r.suite === q.suite && r.category === q.category,
        ),
    )
  )
    throw new Error("Incomplete or mismatched evaluation results.");
  const suites = Object.fromEntries(
    (["regression", "challenge"] as const).map((suite) => {
      const selected = rows.filter((r) => r.suite === suite);
      const answerable = selected.filter((r) => r.recallAt2 !== null);
      const retrieved = selected.filter((r) => r.precisionAt2 !== null);
      return [
        suite,
        {
          cases: selected.length,
          correct: selected.filter((r) => r.correct).length,
          answerable: {
            cases: selected.filter((r) => !r.expectedAbstention).length,
            correct: selected.filter((r) => !r.expectedAbstention && r.correct)
              .length,
          },
          unanswerable: {
            cases: selected.filter((r) => r.expectedAbstention).length,
            correct: selected.filter((r) => r.expectedAbstention && r.correct)
              .length,
          },
          passed: selected.length > 0 && selected.every((r) => r.correct),
          recallAt2: answerable.length
            ? answerable.reduce((n, r) => n + r.recallAt2!, 0) /
              answerable.length
            : null,
          precisionAt2: retrieved.length
            ? retrieved.reduce((n, r) => n + r.precisionAt2!, 0) /
              retrieved.length
            : null,
        },
      ];
    }),
  );
  return {
    schemaVersion: 2,
    evaluatorVersion: "whole-paragraph-v1",
    corpusHash: fingerprint(corpus),
    datasetHash: fingerprint(queries),
    regressionPassed: suites.regression.passed,
    qualityPassed: rows.every((r) => r.correct),
    suites,
    rows,
  };
}
export const abstention: Answer = { answer: "", citations: [], abstain: true };
