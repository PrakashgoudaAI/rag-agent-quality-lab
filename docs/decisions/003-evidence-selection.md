# Select evidence, then render the answer

The scoped extraction prompt abstained on every case in its recorded run. It asked a small model to decide relevance, copy paragraphs, produce citation offsets and set an abstention flag together. This candidate separates selection from text construction: the model returns at most two document IDs; code validates those IDs against the authorized retrieved context and renders the complete canonical paragraphs.

An empty selection is a refusal. Unknown, repeated, foreign, stale or altered evidence fails rather than being silently repaired. Schema and transport limits are shared with the original adapter. The renderer constructs quotes and UTF-16 offsets directly from the stored text, including non-ASCII characters.

This removes text copying and offset calculation from generation. It does not establish relevance: the model can still select a true paragraph that fails to answer the question. The unchanged evaluator checks relevance, coverage and required refusal separately. Neither the model nor its selected IDs authorize tool writes.

The candidate retriever adds a small English glossary (`pick up` → `collection`, `despatch` → `dispatch`, `guarantee` → `warranty`), removes common function words and weights overlap by smoothed inverse document frequency. It filters tenant and current-version documents before calculating scores. This is curated lexical retrieval, not embeddings or a semantic search claim. The single-word `pickup` miss in the extension demonstrates its narrow coverage.

The original overlap retriever and extraction adapter remain available. This combined candidate changes both retrieval and generation; a single comparison cannot attribute the observed score change to either component alone.
