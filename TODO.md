# TODO

Updated after completing the core workflow. There are 32 passing tests. The committed history at `31ef16b` contains 5 of 7 commits with the `[codex]` tag; current uncommitted work is excluded. Code freeze is at **17:00**. `IMPLEMENTATION.md` has full specs and acceptance tests for each task. Bugs are tracked in [BUGS.md](BUGS.md).

## Done

- [x] T1 `PENDING` on an identity mismatch; `DENIED` on an inactive registration
- [x] T2 Fixtures L1–L7 in `backend/data/*.json`
- [x] T3 Simulated registry outage per request → `UNKNOWN`
- [x] T4 Deterministic R-03 claim check and required supplement term
- [x] T5 Bilingual `rule_results` for R-01 to R-05
- [x] T12 The dashboard's 20 records run through the real rules, with Seller, Shopper, and Reviewer workspaces

## P0 — Complete the L1 demo loop

- [x] **T7 Evidence upload and R-05.** `POST /v1/verifications/{id}/evidence` stores the SHA-256 of each file in the trace. R-05 compares the evidence with the registry record. A holder mismatch gives confidence 0.60 → `PENDING` with human review. R-05 checks declared evidence fields after upload.
- [x] **T8 Recheck.** `POST /v1/verifications/{id}/recheck` reruns the rules and appends to the same trace without changing earlier entries.
- [x] **T9 Review queue and decision.** `GET /v1/review-queue` ranks by RISK-v1. `POST /v1/verifications/{id}/review` requires the current `chain_hash`, and a stale hash returns 409.
- [x] **T10 Audit and tamper.** `GET /v1/audit/{id}` returns `{valid, broken_at}`. A tamper demo route breaks the chain on stage.
- [x] **T12 UI.** Shopper, Seller, and Reviewer views, plus demo controls: offline, tamper, reset.

## P1

- [x] T11 `GET /v1/reports/{id}` and `GET /v1/widgets/{id}` (badge)
- [x] T6 LLM claim extraction with a grounding guard. Without an API key, fall back to the T4 rules. Tests use a fake client.

## P3 (only if time remains)

- [ ] T13 `suggest-copy`; OAuth client credentials (Roadmap is enough for the pitch); `compare`

## Docs and submission (finish by 16:45)

- [x] README: update committed-history and actual test counts.
- [ ] README Declarations: replace the TODO link to the earlier repository, which returns 404. Make it public or explain this in the submission form.
- [ ] README: the team confirms the sentence "No code from the earlier prototype was copied" is true.
- [x] IMPLEMENTATION.md: update the current-state section to match the completed workflow.
- [ ] Pitch slides: change the demo URL to `trustcart-bluescreen-demo.vercel.app`, and label features that were not built "Roadmap".
- [ ] Slides: correct the judges, the 6-minute pitch, and the name "Tadcha Anunrojwong".
- [ ] Record a backup demo video.
- [ ] Submit the Google Form: repository, writeup, demo link and password (in the form only), and declarations.

## Final check before 17:00

- [x] `pytest -q` passes, and the README shows the actual count
- [x] Run the L1 loop on the hosted demo from start to finish
- [x] Registry offline → zero approvals
- [x] Tamper → audit invalid
- [x] The synthetic-data disclaimer appears on every screen
- [ ] No secrets in the repository

## Completion update

The core demo loop, reports, widgets, Thai claim regression fixes, registry permit checks, and three UI workspaces are implemented. There are 32 passing tests. The copy-template and comparison endpoints are also implemented. T6 is tested using fake clients; live OpenAI transfer remains disabled pending approval and credentials. OAuth is roadmap work.

Local browser testing completed the L1 evidence-to-review loop and tamper demonstration. The reset control resets the form and retains audit history. Evidence files are hashed, with declared fields compared against the synthetic registry. Hosted storage remains temporary.

Team submission items remain open: confirm code provenance and earlier repository visibility, provide the pitch source for edits, record a backup video, and submit the event form. These require team input or external materials.

Hosted verification passed for the full L1 workflow, stale-hash rejection, reports, widget, tamper detection, outage handling, docs, and password protection.
