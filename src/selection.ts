import { z } from "zod";
import type { Answer, Document } from "./retrieval.ts";
export const selectionSchema = z
  .object({ evidenceIds: z.array(z.string().min(1).max(100)).max(2) })
  .strict();
export const retrievalVersion = "glossary-idf-v1";
const stop = new Set(
  "a an the what when where which who may can do does i my our your it is are at on in of for and".split(
    " ",
  ),
);
const tokenize = (text: string) =>
  new Set(
    (
      text
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? []
    ).filter((t) => !stop.has(t)),
  );
export function retrieveExpanded(
  corpus: Document[],
  tenant: string,
  question: string,
  k = 2,
) {
  if (!Number.isInteger(k) || k < 1 || k > 10)
    throw new Error("k must be 1..10");
  const eligible = corpus.filter((d) => d.tenant === tenant && d.current);
  let expanded = question;
  for (const [pattern, term] of [
    [/\bpick(?:ing)?\s+up\b/i, "collection"],
    [/\bdespatch\b/i, "dispatch"],
    [/\bguarantee\b/i, "warranty"],
  ] as const)
    if (pattern.test(question)) expanded += " " + term;
  const query = tokenize(expanded);
  const documents = eligible.map((d) => ({ d, terms: tokenize(d.text) }));
  const weight = (term: string) =>
    1 +
    Math.log(
      (1 + documents.length) /
        (1 + documents.filter((d) => d.terms.has(term)).length),
    );
  return documents
    .map(({ d, terms }) => ({
      d,
      score: [...query]
        .filter((t) => terms.has(t))
        .reduce((sum, t) => sum + weight(t), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id))
    .slice(0, k)
    .map((x) => x.d);
}
export function renderSelection(
  corpus: Document[],
  tenant: string,
  hits: Document[],
  ids: string[],
): Answer {
  if (ids.length > 2 || new Set(ids).size !== ids.length)
    throw new Error("Repeated or excessive selected evidence.");
  const documents = ids.map((id) => {
    const hit = hits.find((h) => h.id === id);
    const canonical = corpus.find(
      (d) =>
        d.id === id && d.tenant === tenant && d.current && d.text === hit?.text,
    );
    if (!canonical)
      throw new Error(
        "Selected evidence was not authorized retrieved context.",
      );
    return canonical;
  });
  if (!documents.length) return { answer: "", citations: [], abstain: true };
  return {
    answer: documents.map((d) => d.text).join("\n"),
    citations: documents.map((d) => ({
      id: d.id,
      start: 0,
      end: d.text.length,
      quote: d.text,
    })),
    abstain: false,
  };
}
