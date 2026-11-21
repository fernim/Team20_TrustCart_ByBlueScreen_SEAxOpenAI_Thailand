# TODO

Updated after the ordered gap fixes: 137 Python tests, 114 Node component tests, and 26 local desktop/mobile browser tests pass. The historical committed-history snapshot at `31ef16b` contains 5 of 7 commits with the `[codex]` tag. Code freeze is at **17:00**. `IMPLEMENTATION.md` has full specs and acceptance tests for each task. Bugs are tracked in [BUGS.md](BUGS.md).

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

## Gap review at `224c22a`

Closed: 13-digit format check (`verification.py:178`), the ลดน้ำหนักทันที / เห็นผลใน 3 วัน phrases, EXPIRED fixtures, foreign registries treated as `unsupported`, permit policy (`permit_required`, `permit_active`), and the L1–L40 / E1–E16 datasets. Open items are below. Bug details are in [BUGS.md](BUGS.md) B6–B11.

### P0 (before the demo)

- [ ] **Deploy the latest `main` to production (B12).** A Vercel project member does this; the repository has no `.vercel` link or CLI setup.
  1. In Vercel → Settings → Environment Variables (Production), set the PostgreSQL connection variable that `backend/app/database.py` reads, plus `TRUSTCART_DEMO_PASSWORD`. Never put either value in the repository.
  2. In Deployments, confirm that Production shows commit `224c22a` or later. If it does not, redeploy from `main`.
  3. Rerun the hosted desktop and mobile browser checks. Target 20/20, which closes B6.
  4. Update the hosted result in the README (line 205) and in this file.
- [x] **Add `GET /version` without authentication (B12).** Returns only `{"commit": VERCEL_GIT_COMMIT_SHA or "local"}`. Four regression cases cover configured/unset SHA and password, the exact public route, and continued protection of other routes. Deployment remains assigned to the Vercel team member.

- [ ] **Hosted continuity (B6).** The last hosted run failed 4 of 20 saved-product continuity checks. Deploy PostgreSQL storage, then rerun the hosted desktop and mobile checks.
- [x] **README counts (B7).** Full local runs pass 137 Python, 114 Node, and 26 desktop/mobile browser tests. README counts now agree. The browser suite waits for the asynchronous seller Edit action to finish focusing the title before editing the price, fixing the observed test-input race. Historical hosted counts remain separately labeled; no live services were used.

### P1 (rule gaps that judges may probe)

- [x] **Standards certificate (B8).** Optional comma-separated `standards` declarations persist with uploaded evidence. E11 (ISO 9001 alone) fails R-05 and routes to review; E10 (ISO 22000), E9 (GMP), and ISO 9001 plus ISO 22000 pass when identity matches. Four regression cases cover upload, restart/recheck, audit integrity, and outage. This compares declared standards, not document authenticity.
- [x] **Duplicate evidence hash (B9).** Upload checks both file digests against other verifications and records `duplicate_evidence` through `Trace.add`. An otherwise approvable case becomes PENDING/0.60 with human review, including on recheck; UNKNOWN and conclusive DENIED states are preserved. Three tests cover both file kinds, same-case reuse, unique uploads, stale hashes, restart/recheck, audit, and outage.
- [x] **R-02 category claims (B10).** The four phrases now live under `claim_rules.json` → `category_claims`. R-02 selects them by registered category and records matched policy phrases in its trace. Nine tests cover positive/negative copy, case-insensitive matching, configurable categories, seller-category mismatch, and outage.

### Roadmap (label it in the slides if it is not built)

- [ ] **MoPH 448 ingredient ceiling (B11).** Check declared ingredient amounts against the limits.
- [ ] Direction 01 adaptive behaviour.

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
- [x] No secrets in the repository (a scan at `224c22a` found no `sk-` keys and no PostgreSQL URLs with credentials)
- [ ] Hosted checks pass on PostgreSQL (B6)

## Completion update

The core demo loop, reports, widgets, Thai claim regression fixes, registry permit checks, and three UI workspaces are implemented. The gap-fix validation passes 137 Python, 114 Node, and 26 local browser tests. The copy-template and comparison endpoints are also implemented. T6 is tested using fake clients; live OpenAI transfer remains disabled pending approval and credentials. OAuth is roadmap work.

Local browser testing completed the L1 evidence-to-review loop and tamper demonstration. The reset control resets the form and retains audit history. Evidence files are hashed, with declared fields compared against the synthetic registry. Hosted storage remains temporary.

Team submission items remain open: confirm code provenance and earlier repository visibility, provide the pitch source for edits, record a backup video, and submit the event form. These require team input or external materials.

Hosted verification passed for the full L1 workflow, stale-hash rejection, reports, widget, tamper detection, outage handling, docs, and password protection.
