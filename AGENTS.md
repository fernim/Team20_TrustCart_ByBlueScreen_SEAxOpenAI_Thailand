# AGENTS.md (for Codex)

- Stack: FastAPI (Python 3.9 — use `Optional[...]`, not `X | None`, in request signatures), vanilla JS frontend served by FastAPI.
- Run (Windows): `.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000`. Test: `.venv/Scripts/python -m pytest -q`.
- Run (macOS/Linux): `.venv/bin/python -m uvicorn backend.app.main:app --port 8000`. Test: `.venv/bin/python -m pytest -q`.
- Setup: create the environment with `python -m venv .venv`, then use that environment's Python to run `-m pip install -r requirements.txt`.
- Safety rules (never break):
  1. Registry facts come only from `tool_registry_lookup`; never generate a registration number.
  2. Unknown / outage / unmapped category ⇒ `UNKNOWN` or escalate, never `APPROVED`.
  3. Confidence < 0.75 ⇒ human review.
  4. No medical advice in any user-facing text.
  5. Every decision step goes through `Trace.add` (hash-chained); human actions use `chain_hash`.
  6. The LLM (backend/app/llm.py) only extracts claims; phrases not literally in the listing are dropped. It never sets a status.
  7. Registry access only through `backend/app/registry.py` (adapter); never scrape marketplace or Thai FDA pages.
  8. Secrets (passwords, client secrets, token keys, API keys) only in environment variables; never in code or docs.
- Statuses: APPROVED / PENDING / DENIED / UNKNOWN. Rules: R-01..R-05. API under `/v1`.
- Workflow: one rule / endpoint / component per task; write the test first; tag commits `[codex]`.

## Document authority and current state

- Explicit user instructions take precedence. Preserve the safety rules above throughout implementation.
- `README.md` and `BASELINE.md` describe the baseline. Verify claims against the current checkout and tests before relying on them.
- `PRODUCT.md` defines the full product target; `REGISTRATION.md` records the promised end-to-end demo and commitments. Implement these incrementally rather than treating every described feature as already delivered.
- `DEMO.md`, `DEMO.en.md`, `DEPLOY.md`, `DEPLOY.en.md`, and `GAPS_AND_QA.md` are supporting scenarios and operational references. Their feature lists, paths, deployment claims, and test counts require verification against this checkout.
- Current implementation connects buyer, shop-owned seller and reviewer surfaces through `/v1/catalog`, `/v1/seller`, `/v1/reviewer` and `/v1/auth`. Seeded credentials come only from environment variables; sessions and CSRF are enforced in both entrypoints. Public catalog responses must never expose documents, AI findings or audit hashes. Registry data remains synthetic.
- Publication is independent of verification. A demo ฿299/month plan unlocks verification; it does not collect payment. Immutable submission snapshots, private document revisions, AI readiness, deterministic rules and reviewer decisions drive badges. Product edits supersede the active submission and remove the badge. Check both product version and current chain hash; never apply late AI results to a new revision.
- `document_assessment.py` extracts document findings separately from `llm.py` claim extraction. Live errors never fall back to replay. Replay accepts only exact synthetic fixtures. Images/scanned documents and uncertainty require human confirmation; unsupported categories do not auto-pass. Agency work is outside the primary demo scope. See README and DEMO companion files for the current flow.
- Product pages use `/products/{id}`. Seller/reviewer lists show saved media, price, stock and latest status with explicit actions. New/edited product requests require a price; unpriced legacy records remain editable but are omitted from the customer catalog. Real source-product references never inherit synthetic approvals.
- Preserve SQLite persistence while extending the product. References to in-memory storage or a future database in older documents do not authorize replacing working persistence.
- If requirements conflict, use the status policy below for new behavior. Change existing baseline behavior only in the task that implements and tests the relevant transition; update affected documentation with it. Raise any remaining material ambiguity before implementing dependent behavior.

## Decision and status policy

- `APPROVED`: every required, applicable check passes, confidence is at least 0.75, and no unresolved conflict or evidence/reviewer request remains. Baseline approvals cover synthetic identity/category checks only; do not present them as full-product verification or official certification.
- `PENDING`: a check is waiting for seller evidence, a copy correction, or human review. A product/licence-holder mismatch against an active registry record requests evidence first. It becomes `DENIED` only when evidence or an authorized reviewer confirms the mismatch; unresolved or conflicting evidence remains `PENDING` with human review.
- `DENIED`: a conclusive required-rule failure, such as a confirmed revoked registration, a prohibited claim, or a confirmed identity mismatch. A confirmed nonexistent registration may be denied only when the adapter explicitly distinguishes authoritative not-found from an unavailable or inconclusive lookup.
- `UNKNOWN`: verification cannot be completed because of an outage, missing reference, unmapped category, unsupported registry source, or inconclusive lookup. Route to human review. The baseline adapter's `None` result remains `UNKNOWN`; it does not establish authoritative nonexistence.
- Confidence below 0.75 always requires human review and never permits approval. Use `UNKNOWN` for inability to verify and `PENDING` for an unresolved evidence/reviewer workflow.
- Corrected copy, new evidence, and reviewer actions must rerun the applicable checks and append an audit trail through `Trace.add`. Human actions must use and validate `chain_hash`; retain prior decision history.
- Risk scoring ranks reviewer work only; it never changes a verification status. Synthetic data and mock-registry limitations must remain visible in user-facing results.

## Implement one tested feature at a time

1. Inspect the relevant code, tests, and product requirements. Select one rule, endpoint, or component; state its scope, dependencies, and observable acceptance criteria before editing. Do not combine unrelated features.
2. Write a meaningful failing test first and run it to confirm the expected missing behavior. Cover the feature's safety boundary as applicable: outage, low confidence, ungrounded claims, conflicting evidence, or stale audit hashes. Keep tests deterministic and independent of live services and credentials.
3. Implement the smallest complete change that passes the test. Registry facts stay behind the adapter; AI extracts grounded claims; deterministic rules decide; humans resolve escalations.
4. Run the targeted tests, then the full test suite using the platform commands above. For a frontend component, also verify the affected flow in the browser. Report actual commands and results; explain any checks that could not run. Never copy an old test count as current evidence.
5. Update affected documentation to distinguish delivered behavior from planned work. Keep Thai/English companion documents consistent when changing their shared behavior.
6. Report what changed, why, validation results, and remaining limitations. If committing, prefix the commit subject with `[codex]`; do not commit secrets or unrelated changes.

Build dependencies in small steps: define and test status transitions before evidence/reviewer flows; add each rule R-03 through R-05 separately; add grounded extraction independently from rule decisions; protect reviewer/API actions before exposing them externally. Build shopper, seller, and reviewer components against tested endpoints. Treat authorized live-registry integration and deployment as separate tasks, never implied by completing a local feature.

Frontend component tests: `npm ci` once after checkout or dependency changes, then `npm test` (Node.js 18+). These test DOM interactions without network access; use browser checks for layout, responsive behavior, keyboard focus, and native dialogs.
