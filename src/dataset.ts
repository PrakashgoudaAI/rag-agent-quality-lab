import { readFile } from "node:fs/promises";
import { z } from "zod";
import { querySchema, validateDataset } from "./evaluation.ts";
const documentSchema = z
  .object({
    id: z.string().min(1),
    tenant: z.string().min(1),
    current: z.boolean(),
    text: z.string().min(1).max(6000),
  })
  .strict();
export async function loadDataset() {
  const corpus = z
    .array(documentSchema)
    .min(1)
    .parse(
      JSON.parse(
        await readFile(new URL("../data/corpus.json", import.meta.url), "utf8"),
      ),
    );
  const queries = z
    .array(querySchema)
    .min(1)
    .parse(
      JSON.parse(
        await readFile(
          new URL("../data/queries.json", import.meta.url),
          "utf8",
        ),
      ),
    );
  validateDataset(corpus, queries);
  return { corpus, queries };
}
