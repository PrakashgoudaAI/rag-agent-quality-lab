import { createHash } from "node:crypto";
export interface Document {
  id: string;
  tenant: string;
  current: boolean;
  text: string;
}
export interface Citation {
  id: string;
  start: number;
  end: number;
  quote: string;
}
export interface Answer {
  answer: string;
  citations: Citation[];
  abstain: boolean;
}
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const terms = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
export function retrieve(
  corpus: Document[],
  tenant: string,
  question: string,
  k = 2,
): Document[] {
  if (!Number.isInteger(k) || k < 1 || k > 10)
    throw new Error("k must be 1..10");
  const query = terms(question);
  return corpus
    .filter((d) => d.tenant === tenant && d.current)
    .map((d) => ({
      d,
      score: [...terms(d.text)].filter((t) => query.has(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id))
    .slice(0, k)
    .map((x) => x.d);
}
// Extractive baseline: no model, embeddings or semantic entailment judgement.
export function extract(
  corpus: Document[],
  tenant: string,
  hits: Document[],
): Answer {
  const hit = hits.find((h) =>
    corpus.some(
      (d) =>
        d.id === h.id && d.tenant === tenant && d.current && d.text === h.text,
    ),
  );
  if (!hit) return { answer: "", citations: [], abstain: true };
  return {
    answer: hit.text,
    citations: [
      { id: hit.id, start: 0, end: hit.text.length, quote: hit.text },
    ],
    abstain: false,
  };
}
export function supported(
  corpus: Document[],
  tenant: string,
  value: Answer,
): boolean {
  if (value.abstain) return value.answer === "" && value.citations.length === 0;
  if (!value.citations.length) return false;
  return (
    value.citations.every((c) => {
      const d = corpus.find(
        (d) => d.id === c.id && d.tenant === tenant && d.current,
      );
      return (
        !!d &&
        Number.isInteger(c.start) &&
        Number.isInteger(c.end) &&
        c.start >= 0 &&
        c.end > c.start &&
        c.end <= d.text.length &&
        c.quote === d.text.slice(c.start, c.end)
      );
    }) && value.answer === value.citations.map((c) => c.quote).join("\n")
  );
}
