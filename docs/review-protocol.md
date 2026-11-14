# Protocol for an independently reviewed assessment

Status: proposed; no independent assessment has been completed under this protocol.

## Before collecting results

Use a reviewer who did not author the candidate or its development labels. Record their role, the permitted public attribution and any conflicts. Share only synthetic documents. Agree on the task definition, supported tools, allowed sources and what counts as a correct refusal before labeling begins.

Create a fresh assessment corpus and cases. The author-written extension already published here is development evidence once it has informed changes; it must not become this new assessment. Have two reviewers label answerability, supporting document IDs, required claims and forbidden claims without seeing candidate output. Resolve disagreements in a written record before freezing the labels. Keep ambiguous cases visible and state exclusions before running.

Freeze the candidate revision, corpus and case hashes, model digest, prompt, runtime settings, resource budget, trial count and scorer revision in a manifest. Choose numerical promotion thresholds and refusal/relevance requirements with the intended use owner; do not inherit a convenient threshold from an earlier score. Publish the manifest or retain a timestamped digest before inference.

## During and after assessment

Run only the declared trials. Preserve raw observations, errors, timeouts and per-case scoring. Repeated attempts must use the declared aggregation rule; do not retain only the best answer. Report answerable coverage, correct refusals, unsupported claims and relevant supported answers separately, with numerators and denominators.

Have reviewers adjudicate discrepancies without silently editing frozen labels. If a label or scorer defect changes the result, version the correction and retain the original outcome and reason. Report uncertainty and the limits of a small synthetic set. Passing this assessment would still establish only the defined task and budget.

Once assessment results guide implementation or prompt changes, those cases become regression/development material. Prepare a new assessment before making a new unseen-performance claim. A failed gate is a recorded result and blocks promotion under the agreed criteria; it is not a reason to relax the criteria afterward.
