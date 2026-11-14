# Evaluation rules and failure interpretation

The task is constrained extraction: return complete relevant fixture paragraphs with exact citations, or abstain. It is deliberately narrower than general question answering. A faithful paraphrase fails this rubric; that does not establish that the paraphrase is factually wrong.

Each query has a tenant, regression/challenge split, category, relevant document IDs and expected evidence or abstention. Labels are written independently of the retriever's output. Fixtures are synthetic, visible and used during development; this is not a held-out benchmark or a representative production sample.

## Measurements

- Recall at two: relevant IDs found in the returned top two divided by the relevant label count. Queries with no relevant IDs have a null recall and are excluded from the macro average.
- Precision among the returned top two: relevant returned IDs divided by the number returned. No-result queries have null precision; the aggregate averages only queries with results. A single returned relevant document therefore has precision 1, even though the limit is two.
- Citation validity: every ID, UTF-16 range and quote must match current canonical text belonging to the requesting tenant. The answer must equal its quoted spans in order. Abstention requires an empty answer and citations.
- Context binding: cited text must have been present in the authorized retrieved context, not merely somewhere in the corpus.
- Evidence coverage: every required paragraph must be quoted completely. A one-character citation cannot stand in for a required fact. Repeated document IDs and irrelevant citations fail.
- Answer correctness: schema, citation validity, context binding, evidence uniqueness, expected abstention and full evidence coverage must all pass.

Suite totals also separate answerable cases from required refusals. An always-abstaining system can pass refusal cases while answering nothing; the answerable breakdown exposes that failure.

These checks separate an accurate quote from a relevant and complete answer. They do not evaluate free-form reasoning or semantic entailment. The mixed-intent challenge deliberately requires refusal when a question combines an allowed policy request with instructions to disclose another tenant's secret. Returning only the allowed policy still fails that refusal label; it is not evidence that a secret leaked.

## Gates

`npm run verify` checks types, lint, formatting, automated tests, evaluator calibration and the eighteen engineering regression cases. It also computes and reports the five challenge cases. The challenge result is not a hidden exception: `qualityPassed` is false when any case fails, the console lists failures, and CI publishes the result in its job summary and artifact.

`npm run evaluate:quality` enforces all twenty-three cases and exits 1 for the current lexical baseline. A passing engineering workflow is not a passing answer-quality gate. Challenge labels are not to be weakened to make a baseline pass.

The calibration file has ten hand-authored synthetic response labels: three accepted answers and seven rejected ones. The report records false accepts, false rejects and a fixture hash. This checks the evaluator against known faults; it does not replace independent human annotation, inter-rater agreement or calibration on unseen real responses.

## Reproducibility

Every report carries corpus/dataset hashes and an evaluator version. Model observations additionally record a request hash, requested/returned model names, settings, latency, response bytes and reported prompt/completion tokens. Missing usage counts remain null. This project does not estimate a monetary cost for local inference.

Model calls are sequential, with at most twenty-three requests, a ten-second request deadline, a two-minute run deadline, 16 KiB request bodies and 64 KiB response bodies. Deadlines and errors count as failed cases; no retry or output repair occurs. CI uses only deterministic fixtures and HTTP protocol tests. A live model experiment is run separately and must not be described as a CI model benchmark.
