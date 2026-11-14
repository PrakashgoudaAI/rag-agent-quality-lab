import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset } from "../src/dataset.ts";
import {
  scoreAnswer,
  summarize,
  validateDataset,
  abstention,
} from "../src/evaluation.ts";
import { retrieve, extract } from "../src/retrieval.ts";
const { corpus, queries } = await loadDataset();
const q = queries.find((q) => q.id === "current-policy")!;
const hits = retrieve(corpus, q.tenant, q.question);
const answer = extract(corpus, q.tenant, hits);
await test("complete canonical evidence passes independently labeled answer checks", () => {
  assert.equal(scoreAnswer(corpus, q, hits, answer).correct, true);
});
await test("valid citations do not make an irrelevant answer correct", () => {
  const challenge = queries.find((q) => q.id === "lexical-false-positive")!;
  const score = scoreAnswer(corpus, challenge, hits, answer);
  assert.equal(score.citationValid, true);
  assert.equal(score.correct, false);
  assert.equal(score.abstentionCorrect, false);
});
await test("missing evidence and tiny valid spans cannot pass the answer rubric", () => {
  const multi = queries.find((q) => q.id === "multi-evidence")!;
  const multiHits = retrieve(corpus, multi.tenant, multi.question);
  const score = scoreAnswer(
    corpus,
    multi,
    multiHits,
    extract(corpus, multi.tenant, multiHits),
  );
  assert.equal(score.evidenceCoverage, 0.5);
  assert.equal(score.correct, false);
  const partial = {
    ...answer,
    answer: answer.answer.slice(0, 1),
    citations: answer.citations.map((c) => ({
      ...c,
      end: 1,
      quote: c.quote.slice(0, 1),
    })),
  };
  const tiny = scoreAnswer(corpus, q, hits, partial);
  assert.equal(tiny.citationValid, true);
  assert.equal(tiny.evidenceCoverage, 0);
  assert.equal(tiny.correct, false);
});
await test("schema faults, invented evidence and unjustified abstention are rejected", () => {
  for (const raw of [
    null,
    { ...answer, abstain: "false" },
    { ...answer, extra: "hidden" },
    { ...answer, answer: "unquoted claim" },
    abstention,
  ])
    assert.equal(scoreAnswer(corpus, q, hits, raw).correct, false);
  const noContext = scoreAnswer(corpus, q, [], answer);
  assert.equal(noContext.citationValid, true);
  assert.equal(noContext.contextBound, false);
  assert.equal(noContext.correct, false);
  const repeated = {
    ...answer,
    answer: answer.answer + "\n" + answer.answer,
    citations: [...answer.citations, ...answer.citations],
  };
  assert.equal(scoreAnswer(corpus, q, hits, repeated).correct, false);
});
await test("fixture validation rejects foreign, stale and conflicting labels", () => {
  for (const changed of [
    { ...q, expected: { abstain: true, evidence: q.expected.evidence } },
    { ...q, relevant: ["beta-pin"] },
    { ...q, relevant: ["alpha-return-v1"] },
    { ...q, relevant: [...q.relevant, ...q.relevant] },
  ])
    assert.throws(() => validateDataset(corpus, [changed]));
  assert.throws(() => validateDataset(corpus, [q, q]), /Duplicate/);
});
await test("aggregate gates reject incomplete results and preserve null metric denominators", () => {
  const row = {
    id: q.id,
    suite: q.suite,
    category: q.category,
    retrieved: hits.map((d) => d.id),
    ...scoreAnswer(corpus, q, hits, answer),
    latencyMs: 1,
  };
  assert.throws(() => summarize(corpus, [q], []), /Incomplete/);
  assert.throws(
    () => summarize(corpus, [q], [{ ...row, id: "wrong" }]),
    /mismatched/,
  );
  const unanswerable = queries.find((q) => q.id === "unknown")!;
  const report = summarize(
    corpus,
    [unanswerable],
    [
      {
        ...row,
        id: unanswerable.id,
        category: unanswerable.category,
        retrieved: [],
        ...scoreAnswer(corpus, unanswerable, [], abstention),
      },
    ],
  );
  assert.equal(report.suites.regression.recallAt2, null);
  assert.equal(report.suites.regression.precisionAt2, null);
});

await test("synthetic evaluator calibration exposes false accepts and false rejects", async () => {
  const { calibrate } = await import("../src/calibration.ts");
  const result = await calibrate(corpus, queries);
  assert.equal(result.cases, 10);
  assert.equal(result.falseAccepts, 0);
  assert.equal(result.falseRejects, 0);
  assert.equal(result.passed, true);
});

await test("always abstaining cannot hide zero answerable coverage behind correct refusals", () => {
  const rows = queries.map((q) => {
    const hits = retrieve(corpus, q.tenant, q.question);
    return {
      id: q.id,
      suite: q.suite,
      category: q.category,
      retrieved: hits.map((d) => d.id),
      ...scoreAnswer(corpus, q, hits, abstention),
      latencyMs: 1,
    };
  });
  const report = summarize(corpus, queries, rows);
  assert.equal(report.qualityPassed, false);
  assert.equal(report.suites.regression.answerable.correct, 0);
  assert.equal(report.suites.regression.answerable.cases, 9);
  assert.equal(report.suites.regression.unanswerable.correct, 9);
  assert.equal(report.suites.challenge.answerable.cases, 2);
});
