# TrustCart Implementation Plan (for developers and Codex)

This plan breaks the target product in the pitch deck and `PRODUCT.md` into tested tasks that fit before **code freeze at 17:00 on 21 November 2026**. `AGENTS.md` takes precedence on safety rules and the status policy. Before you start a task, check the "Current state" section against the code, because it changes as tasks land.

**Core thesis:** AI extracts and suggests, deterministic rules R-01 to R-05 decide, and humans govern.

---

## 1. Current state

The core synthetic demo is implemented. The app includes PENDING mismatch handling, R-01 through R-05, JSON registry fixtures, phrase-based Thai/English claim checks, registry permit comparison, evidence hashes and declarations, rechecks, a reviewer queue, optimistic chain-hash validation, audit verification, reports, badges, comparison, and screened copy templates. Three UI workspaces exercise these endpoints, alongside 20 evaluated transactions and an outage control.

Optional OpenAI extraction is implemented behind explicit data-transfer approval and environment credentials. It remains disabled on the hosted demo. Marketplace OAuth is roadmap work. Hosted SQLite is temporary. Product evidence checks compare declared fields and file hashes; document authenticity and OCR require further integration.

Validation: 32 tests pass. Local browser verification completed L1 submission, evidence, recheck, reviewer denial, valid audit, and deliberate tamper detection. The deployed Vercel API also passed the same full workflow, stale-hash rejection, reports, widget, outage, docs, and password checks.

---

## 2. Target demo loop (what the judges must see work live)

**L1, turmeric that "reverses diabetes"**
1. A seller submits a listing with a real-format number that belongs to a different product, plus disease claims.
2. R-01 detects the identity mismatch → `PENDING`, evidence requested. R-03 detects the disease claim.
3. The seller uploads a label and a certificate. The SHA-256 of each file goes into the trace.
4. Recheck: R-05 finds that the licence holder still does not match, confidence 0.60 < 0.75 → reviewer queue.
5. The reviewer confirms → `DENIED`. The report shows every step, and the tamper check passes.
6. Toggle the registry offline → a new submission returns `UNKNOWN`, never `APPROVED`.
7. Tamper with one trace entry → `/v1/audit/{id}` reports the chain as broken.

Steps 1–2 and 6 are the minimum demo. Steps 3–5 complete the loop. Step 7 is the wow moment.

---

## 3. Tasks in dependency order

Rules for every task (from `AGENTS.md`): write the failing test first, change one rule, endpoint, or component per task, tag commits `[codex]`, and do not use live services in tests.

### T1. `PENDING` status and the mismatch policy (P0, about 20 min)
- **Files:** `backend/app/main.py`, `tests/test_baseline.py`
- **Change:** add `Status.PENDING`. A product or licence-holder mismatch against an **active** record → `PENDING`, reason `evidence_requested`, `human_review_required=True`. An inactive record stays `DENIED`.
- **Acceptance:** the existing `Different Product` test case expects `PENDING`. A new test with an inactive fixture expects `DENIED`.

### T2. Synthetic fixtures L1–L7 (P0, about 30 min)
- **Files:** `backend/data/registry.json`, `backend/data/listings.json`, `backend/app/registry.py`
- **Change:** move the registry fixtures to JSON and keep `tool_registry_lookup` as the only access point. Write new synthetic data during the event.

| ID | Scenario | Expected |
| --- | --- | --- |
| L1 | Number belongs to another product, plus disease claims | `PENDING` (R-01, R-03) → evidence → reviewer → `DENIED` |
| L2 | Clean collagen listing with the "ผลิตภัณฑ์เสริมอาหาร" term | `APPROVED` |
| L3 | Revoked or inactive registration, plus weight-loss claims | `DENIED` |
| L4 | Valid number, "prevents obesity" claim | `DENIED` (R-03) or `PENDING` for a copy fix |
| L5 | Number in an invalid or nonexistent format | `UNKNOWN` |
| L6 | Clean fish oil from the official store | `APPROVED` |
| L7 | Same number as L6, advertising permit conflict | `PENDING` (R-04) |

- **Acceptance:** a parametrized test checks that each ID returns its expected first status.

### T3. Registry outage toggle (P0, about 15 min)
- **Files:** `registry.py`, `main.py` (`/demo/registry/{state}`), tests
- **Change:** a module flag `online` or `offline`. While it is offline, `tool_registry_lookup` raises `RegistryUnavailable`.
- **Acceptance:** offline → `UNKNOWN` with reason `registry_unavailable` and human review, never `APPROVED`. Online restores normal results.

### T4. R-03 advertising claims, deterministic (P0, about 40 min)
- **Files:** `backend/data/claim_rules.json`, `backend/app/rules.py`, tests
- **Change:** a Thai and English keyword list (treat, cure, prevent, reverse, and Thai equivalents such as รักษา, ป้องกัน, ย้อน, หาย). For supplements, the term `ผลิตภัณฑ์เสริมอาหาร` is required. The output lists every matched phrase with its position in the text.
- **Listing schema:** add optional `title` and `description` fields and keep the existing fields.
- **Acceptance:** L1, L3 and L4 fail R-03 with the matched phrases in `rule_results`. L2 and L6 pass. A missing required term fails R-03.

### T5. `rule_results` in the response (P0, about 20 min)
- **Change:** `Verification.rule_results: list[{rule, result: pass|fail|skip, reason_en, reason_th, evidence?}]`. Every rule result also calls `Trace.add`.
- **Acceptance:** an L1 response contains R-01 fail and R-03 fail, with reasons in both languages.

### T6. LLM claim extraction with a grounding guard (P1, about 45 min)
- **Files:** `backend/app/llm.py`, tests with a fake client
- **Change:** OpenAI structured outputs with a JSON schema `{claims:[{phrase, type}]}`. **Drop every phrase that does not appear literally in the listing.** If `OPENAI_API_KEY` is not set, skip the call and use T4 alone. The LLM never sets a status.
- **Acceptance:** a fake client that returns an invented phrase → the phrase is dropped. A fake client that returns a grounded euphemism → the phrase reaches R-03. Tests make no network calls.

### T7. Evidence upload and R-05 (P1, about 45 min)
- **Endpoint:** `POST /v1/verifications/{id}/evidence` (multipart: `label`, `certificate`)
- **Change:** store the SHA-256 of each file (no raw file contents are needed for the demo) in an `evidence` table and `Trace.add("evidence", sha256)`. R-05 compares the fields the seller declares in the evidence with the registry record.
- **Acceptance:** after an upload, the trace contains both hashes. L1 evidence with a mismatched holder → R-05 fail, confidence 0.60, `PENDING` with human review.

### T8. Recheck (P1, about 20 min)
- **Endpoint:** `POST /v1/verifications/{id}/recheck`. It reruns every rule with the current evidence and appends to the same trace, keeping the earlier history.
- **Acceptance:** the trace grows, the earlier entries stay unchanged, and the chain still verifies.

### T9. Review queue and reviewer decision (P1, about 40 min)
- **Endpoints:** `GET /v1/review-queue` sorted by risk score; `POST /v1/verifications/{id}/review` with `{decision: approve|deny, note, chain_hash}`
- **Change:** the reviewer must send the current `chain_hash`. A stale hash → 409. Risk score (RISK-v1) ranks the queue only and never changes the status: High ≥ 80, Medium 30–79, Low < 30.
- **Acceptance:** a stale hash → 409. Approving an L1 case that confidence alone could not approve → the status changes and the trace records the human action.

### T10. Audit verification and tamper demo (P1, about 25 min)
- **Endpoints:** `GET /v1/audit/{id}` → `{valid: bool, broken_at?: index}`; `POST /demo/tamper/{id}` edits one stored entry.
- **Acceptance:** before tampering `valid=true`. After tampering `valid=false` with `broken_at` set.

### T11. Report and widget (P2, about 30 min)
- `GET /v1/reports/{id}`: status, rule results in both languages, evidence hashes, audit validity, and the synthetic disclaimer.
- `GET /v1/widgets/{id}`: badge data `{status, label_th, label_en, report_url}`.

### T12. Live demo UI wired to the real endpoints (P0 once T1–T5 land, about 60 min)
- **Files:** `demo.html`, `app.py`
- Three views: **Shopper** (badge and report), **Seller** (submit and upload evidence), **Reviewer** (queue, decision, audit). Demo controls: registry online or offline, tamper, reset.
- Replace the static `SCENARIOS` with calls to the real API. **Do not show results that the real code did not produce.**
- **Acceptance:** run the L1 loop in the browser from start to finish and verify the result by hand.

### T13. `suggest-copy`, OAuth 2.0, `compare` (P3, only if time remains)
- `POST /v1/listings/suggest-copy`: the LLM drafts compliant copy, and the result is checked again by R-03.
- OAuth client credentials with scopes. The HTTP Basic gate is enough for the hackathon. Mention OAuth as roadmap in the pitch.

---

## 4. Schedule (now → 17:00)

| Time | Tasks | Priority |
| --- | --- | --- |
| Until 12:30 | T1, T2, T3, T4, T5 | P0: minimum demo works |
| 12:30–14:30 | T7, T8, T9, T10 (T6 in parallel if someone is free) | P1: complete loop |
| 14:30–15:45 | T12 UI, deploy to Vercel, test the hosted demo | P0 |
| 15:45–16:15 | T11, fix bugs, record a backup demo video | |
| 16:15–16:45 | Update README counts (`[codex]`, pytest), Declarations, submit the Google Form | Must |
| 17:00 | **Code freeze** | |

### Ownership to avoid merge conflicts (from the team playbook)

| Member | Paths | Tasks |
| --- | --- | --- |
| Thomaz | `backend/app/main.py`, `llm.py`, `registry.py` | T1, T3, T6, T7, T8 |
| Ju | `backend/data/`, `backend/app/rules.py` | T2, T4, T5 (rule wording) |
| Big | `backend/app/audit.py`, `tests/` | T9, T10, test coverage |
| Fen | `demo.html`, `app.py`, deck | T11, T12, pitch |

Work on short-lived branches and merge into `main` often. Only one person edits `main.py` at a time.

---

## 5. Contracts

### Statuses
| Status | When |
| --- | --- |
| `APPROVED` | Every applicable rule passes, confidence ≥ 0.75, and nothing is unresolved |
| `PENDING` | Waiting for evidence, a copy fix, or a reviewer |
| `DENIED` | A conclusive failure: revoked registration, prohibited claim, or a mismatch confirmed by evidence or a reviewer |
| `UNKNOWN` | Outage, missing reference, unmapped category, or inconclusive lookup → human review |

### Data model (SQLite)
`verifications(id, result JSON)` exists. Add `evidence(id, verification_id, kind, sha256, created_at)` and `reviews(id, verification_id, decision, note, prev_chain_hash, created_at)`. `rule_results` and the audit trail can stay inside `result` JSON until a task needs separate tables.

### Environment variables (never in code or docs)
| Variable | Use |
| --- | --- |
| `TRUSTCART_DEMO_PASSWORD` | Password gate for the hosted demo |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional LLM extraction (T6) |

---

## 6. Definition of done (check before 16:45)

- [ ] `pytest -q` passes. Write the actual count in the README; do not copy an old one.
- [ ] Count `[codex]` commits with `git log --oneline | grep -c "\[codex\]"` and update the README.
- [ ] Run the L1 loop on the **new** hosted demo (`trustcart-bluescreen-demo.vercel.app`), not the old URL.
- [ ] Registry offline → `UNKNOWN`. Tamper → audit invalid.
- [ ] Every screen and report shows the synthetic-data disclaimer.
- [ ] No secrets in the repository. Give judges the demo password through the submission form only.
- [ ] README Declarations are current, including the link to the earlier project.
- [ ] Update the pitch slides to match what was actually built, with features that were not built labelled "Roadmap".
