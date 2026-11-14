import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset } from "../src/dataset.ts";
import { retrieve, supported } from "../src/retrieval.ts";
import { retrieveExpanded, renderSelection } from "../src/selection.ts";
const { corpus } = await loadDataset();
await test("query expansion fixes a documented lexical miss without changing the baseline", () => {
  const question = "When may I pick up my order?";
  assert.deepEqual(retrieve(corpus, "alpha", question), []);
  assert.equal(
    retrieveExpanded(corpus, "alpha", question)[0]?.id,
    "alpha-hours",
  );
});
await test("foreign and obsolete documents cannot affect candidate ranking", () => {
  const question = "Camera returns receipt";
  const expected = retrieveExpanded(corpus, "alpha", question);
  const additions = Array.from({ length: 30 }, (_, i) => ({
    id: "foreign-" + i,
    tenant: "beta",
    current: true,
    text: question,
  }));
  assert.deepEqual(
    retrieveExpanded(
      [
        ...corpus,
        ...additions,
        { id: "old", tenant: "alpha", current: false, text: question },
      ],
      "alpha",
      question,
    ),
    expected,
  );
  assert.deepEqual(retrieveExpanded(corpus, "gamma", question), []);
});
await test("glossary ranking does not claim to solve unsupported-detail relevance", () => {
  assert.ok(
    retrieveExpanded(corpus, "alpha", "Battery warranty transferability").some(
      (d) => d.id === "alpha-warranty",
    ),
  );
  assert.throws(() => retrieveExpanded(corpus, "alpha", "x", 0));
});
await test("selected evidence renders complete canonical paragraphs, including UTF-16 spans", () => {
  const docs = [
    {
      id: "unicode",
      tenant: "alpha",
      current: true,
      text: "A camera 📷 requires a receipt.",
    },
    {
      id: "second",
      tenant: "alpha",
      current: true,
      text: "Collection opens Monday.",
    },
  ];
  const answer = renderSelection(docs, "alpha", docs, ["unicode", "second"]);
  assert.equal(supported(docs, "alpha", answer), true);
  assert.equal(answer.citations[0].end, docs[0].text.length);
  assert.equal(answer.answer, docs.map((d) => d.text).join("\n"));
  assert.deepEqual(renderSelection(docs, "alpha", docs, []), {
    answer: "",
    citations: [],
    abstain: true,
  });
});
await test("selection cannot smuggle duplicate, missing, altered, foreign or stale evidence", () => {
  const hits = retrieveExpanded(corpus, "alpha", "Camera returns");
  const id = hits[0].id;
  for (const ids of [[id, id], ["unknown"], ["beta-pin"], ["alpha-return-v1"]])
    assert.throws(() => renderSelection(corpus, "alpha", hits, ids));
  assert.throws(() =>
    renderSelection(
      corpus,
      "alpha",
      hits.map((h) => ({ ...h, text: "Altered" })),
      [id],
    ),
  );
});

await test("extension fixtures validate independently of the unchanged development query file", async () => {
  const { queries } = await loadDataset("extension");
  assert.equal(queries.length, 16);
  assert.equal(queries.filter((q) => q.expected.abstain).length, 8);
  assert.equal(new Set(queries.map((q) => q.id)).size, 16);
});

await test("archived result audits reject altered counts, omitted cases and changed fixture hashes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { auditArchivedRun } = await import("../src/archived-run.ts");
  const { corpus, queries } = await loadDataset();
  const raw = JSON.parse(
    await readFile(
      new URL(
        "../docs/experiments/004-selection-development.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(auditArchivedRun(corpus, queries, raw).qualityPassed, false);
  for (const mutate of [
    (r: typeof raw) => {
      r.rows[0].correct = !r.rows[0].correct;
    },
    (r: typeof raw) => {
      r.qualityPassed = true;
    },
    (r: typeof raw) => {
      r.rows.pop();
    },
    (r: typeof raw) => {
      r.datasetHash = "changed";
    },
    (r: typeof raw) => {
      r.suites.challenge.correct = 5;
    },
  ]) {
    const copy = structuredClone(raw);
    mutate(copy);
    assert.throws(() => auditArchivedRun(corpus, queries, copy));
  }
});
