# TrustCart Baseline Lead

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart adds optional, document-backed product verification to a Shopee-style marketplace. Sellers publish listings, submit private evidence, and track blockers; reviewers resolve uncertain cases; buyers see a clickable tick only on the current passing product revision. The registry remains synthetic: the badge is not official certification or proof of physical authenticity.

> **All data is synthetic.** TrustCart does not connect to the Thai FDA registry or any marketplace. It is not affiliated with Shopee or Thai FDA, and its results are decision support. They are not certification, legal advice, or medical advice.

## Problem

A real 13-digit Thai FDA registration number does not prove that the listed product holds it. Shoppers cannot tell whether the number on a health-product listing belongs to that product. Listings also claim to treat, prevent, or reverse disease. Enforcement happens after publication: Thai FDA reports 121,494 illegal health-product ads closed between 2023 and April 2026. Sources are listed in the pitch deck. Small sellers usually learn the rules when a listing is taken down.

## Solution

TrustCart checks a listing **before granting its product badge** through an API. The design rule is *AI extracts and suggests, deterministic rules decide, humans govern*:

- Rules R-01 to R-05 decide the status. A language model is never allowed to set one.
- A registry outage, missing reference, or unmapped category returns `UNKNOWN` with human review. TrustCart never approves a case it could not verify.
- Every decision step is written to a SHA-256 hash-chained audit trace.

## Build direction

- **03 Deep Domain AI (primary).** Checks follow Thai supplement compliance practice: registration identity, licence holder, category, and prohibited claims. The test is whether a trust-and-safety reviewer would rely on the result.
- **01 Autonomous & Adaptive AI (secondary).** The agent runs without supervision and escalates to a person only when it cannot verify a case.

## Declarations (what was built during the hackathon)

**Built on 21 November 2026, on site, in this repository.** The first commit, `1d8b004`, was made at 10:44 +07:00, after hacking started at 10:25. The repository history records the baseline and the final API integration.

| Built today | Files |
| --- | --- |
| Verification, evidence, recheck, and review APIs with a synthetic registry, SQLite persistence, and a hash-chained trace | `backend/app/api/`, `backend/app/verification.py`, `backend/app/registry.py`, `backend/app/workflow.py` |
| Seeded role accounts, shop ownership, private documents and reviewer decisions | `backend/app/security.py`, `backend/app/api/connected.py`, `backend/app/api/submissions.py`, `backend/app/api/documents.py`, `backend/app/api/assessment.py` |
| Tests | `tests/` |
| Codex instructions | `AGENTS.md`, `BASELINE.md`, [Thomaz API guidance](ThomazAgents.md) |

**Prepared before the event (existing personal project).**

- Prior prototype repository: `zhunbeiboshi-del/TrustCart-BlueScreen`. Access and public availability require team confirmation before submission.
- Seven planning documents were copied unchanged from that project as product specification and reference: `PRODUCT.md`, `REGISTRATION.md`, `DEMO.md`, `DEMO.en.md`, `DEPLOY.md`, `DEPLOY.en.md`, and `GAPS_AND_QA.md`. They describe the target product. Features they list are delivered only when this repository's code and tests contain them.
- Research, the pitch deck, and diagrams were also prepared before the event.
- The team must confirm the provenance statement about whether code from the earlier prototype was copied before submitting the declaration.
- Commit `514f11e` has no message. It was part of the same day's work.

**Open-source libraries:** FastAPI, Uvicorn, Pydantic, and pytest. `requirements.txt` lists them.

## How we used Codex

- **`AGENTS.md` first.** It gives Codex the stack, run and test commands, eight safety rules, and the status policy, so every task starts from the same constraints.
- **One task per rule, endpoint, or component, with the test written first.** Codex implements the task against a named acceptance test.
- **Visible log.** Commits made through Codex carry the `[codex]` tag. Inspect current Codex task history with git log --oneline --grep="[codex]" --fixed-strings.
- **Human review.** Team members review every diff that touches rules, safety, or data handling.
- **Validation.** Run the Python, DOM and Playwright commands below. Browser tests use real role sessions, temporary SQLite data and generated environment-only passwords; they never call live OpenAI.

## Run locally

Create `.venv`, install `requirements.txt`, and set these environment variables to presenter-chosen passwords before starting the server. Passwords are never checked into the repository:

| Environment variable | Account | Access |
| --- | --- | --- |
| `TRUSTCART_BUYER_PASSWORD` | `buyer` | Public product catalog |
| `TRUSTCART_SELLER1_PASSWORD` | `seller1` | TrustCart Demo Shop |
| `TRUSTCART_SELLER2_PASSWORD` | `seller2` | BlueScreen Health Shop |
| `TRUSTCART_REVIEWER_PASSWORD` | `reviewer` | Cross-shop review queue |

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
```

On Windows, use `.venv/Scripts/python` instead. Open `http://localhost:8000/login`. Buyers can also browse without signing in. Sessions last eight hours and use HttpOnly cookies and CSRF tokens. Credentials are required for seller/reviewer access even when running the core application locally.

## Connected demo

See [the English walkthrough](DEMO.en.md) or [คู่มือเดโมภาษาไทย](DEMO.md).

- **Buyer:** `/` and `/products/{id}` show published product images, price and stock. Only an eligible current approval has a clickable badge with a short explanation. Buyers receive no private documents, AI findings or audit hashes.
- **Seller:** `/seller` shows only that shop's products. Publication is independent of verification. The demo ฿299/month plan enables unlimited verification submissions without taking payment. Each submission needs a label and registration document, plus an advertising permit when required. Sellers see the stage, blockers, reviewer instructions and prior revisions, and can submit more documents for a new review.
- **Reviewer:** `/reviewer` filters submissions by shop, status, stage and required action. It displays originals, grounded document findings, rule failures and the audit trace. Approve, Deny and Request documents require a reason and the current chain hash. Approval requires explicit inspection confirmations; prohibited claims and registry failures cannot be overridden.

Editing any product invalidates its current badge and supersedes its submission. Historical evidence and traces remain available privately. Late AI results and stale reviewer decisions cannot approve the edited product. The agency workspace is outside this demo's primary flow; legacy APIs and `/workspace` remain reviewer-only diagnostic surfaces.

### Live assessment and replay

`backend/app/document_assessment.py` calls the OpenAI Responses API for document extraction/readiness only. Enable it with environment variables `OPENAI_API_KEY` and `TRUSTCART_AI_TRANSFER_APPROVED=true`; `OPENAI_DOCUMENT_MODEL` optionally overrides `gpt-4o-mini`. The UI identifies document transfer and the selected mode. `backend/app/llm.py` remains the separate grounded claim extractor. Neither model sets a status.

**Live** never silently switches to canned data. Provider errors, malformed output and unconfigured live access produce `UNKNOWN`, no badge, and a retry/review action. Extraction below 0.75 or inconsistent/unreadable evidence requires review. Text-PDF quotations are independently checked; image-only/scanned documents require human visual confirmation. Categories other than supplements require manual review. Registry failures cannot be approved by a reviewer.

**Replay** accepts only the exact synthetic example listing and document hashes provided in Seller Centre. It is visibly labeled and makes no OpenAI call. The three examples demonstrate approval, uncertain documents and a prohibited claim. Real market reference names/photos remain unverified. Reference imagery provenance is in `frontend/assets/sources.json`.

### Storage and deployment scope

Startup adds `tc_*` tables without deleting existing records. Existing catalog products are assigned to the first demo shop but do not inherit a badge from legacy verification. Submissions retain immutable listing snapshots and private document revisions. Evidence bytes are held in SQLite locally or BYTEA when `TRUSTCART_DATABASE_URL` selects the existing PostgreSQL adapter. Files are limited to PDF/PNG/JPEG/WebP, 2 MiB each, five active documents per submission and ten unencrypted PDF pages.

This change is local and has not been deployed. Hosted PostgreSQL and live OpenAI calls require separate environment validation. Serverless SQLite is ephemeral; use persistent storage for a shared hosted demo. Demo subscription activation is not billing. Production identity, marketplace OAuth, real registry integration, payment collection and an agency workspace remain separate work.

The optional `app:app` hosting entrypoint uses the same role sessions. Its old shared Basic gate (`TRUSTCART_DEMO_PASSWORD`) remains for legacy diagnostic access; it does not replace reviewer authorization. New role screens and the public storefront do not use that shared password.

## Tests

```sh
.venv/bin/python -m pytest -q
npm ci
npm test
npm run test:browser
```

Browser tests run on port 8768 with a temporary database, generated test passwords and desktop/mobile viewports. They cover public shopping and reviews, seller media and publication, matching document approval, prohibited-claim denial, reviewer requests, resubmission history and badge invalidation. Python tests separately cover ownership, CSRF, stale hashes, late AI results, replay mismatches, ungrounded extraction, file limits and outages. Legacy policy tests isolate authentication in the test harness; `test_connected_*` tests exercise the real guard. Older seller/reviewer DOM harnesses remain regression coverage for the legacy components; connected browser tests exercise the scripts served by the current role pages.

For explicitly authorized hosted testing, set `TRUSTCART_BASE_URL` and all four account password variables. Hosted browser tests create persistent demo products, so use a disposable demo environment.

## Legacy L1 diagnostic demo (`/workspace`, reviewer only)

1. Open Seller and select L1. Submit the listing to receive PENDING.
2. Use the synthetic sample files to upload label and certificate evidence. The conflicting fields keep the result PENDING at confidence 0.60.
3. Recheck the case and open Reviewer. Refresh the queue, enter a reason, and deny the selected case.
4. Verify the audit. Demonstrate tampering and verify the failed audit. Further changes are blocked on the altered case.
5. Submit a new case to restart. Select simulated registry outage to see zero approvals across the 20 records.

## API workflow

FastAPI registers the connected workflow routers alongside the legacy diagnostic routers from `backend/app/api/`. The API entry point is `backend.app.main:app`. The password-protected local demo uses `app:app`.

| Router | API area |
| --- | --- |
| `verifications.py` | Listing submission and retrieval |
| `seller.py` | Evidence, rechecks, and copy suggestions |
| `reviewer.py` | Review queue and decisions |
| `reports.py` | Reports, badges, comparison, and audit checks |
| `agency.py` | Aggregate verification metrics |

### Try the L1 workflow in Swagger

1. Sign in as the reviewer and open `/docs`. Legacy POST requests also need the `X-CSRF-Token` returned by `/v1/auth/me`; the workspace supplies this header, while direct API clients must include it. Run `GET /v1/demo/scenarios` and copy the `L1` object into `POST /v1/verifications`. The API returns `201` with an ID, a `Location` header, and a `PENDING` result.
2. Send `multipart/form-data` to the verification's evidence endpoint. Include `label` and `certificate` as synthetic files, the declared `registration_reference`, `product_name`, and `license_holder`, and the verification's current `chain_hash`.
3. Recheck with JSON `{"chain_hash":"<hash returned by the evidence upload>"}`. To record the demo denial, call the review endpoint with `decision: "deny"`, a note, and the hash returned by recheck.
4. Fetch the report and audit using the same verification ID. If a mutation returns `409` for a stale hash, reload the verification and use the latest hash. An invalid audit also returns `409` and blocks further mutations.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /v1/verifications | Submit listing |
| GET | /v1/verifications/{id} | Retrieve result |
| POST | /v1/verifications/{id}/evidence | Multipart synthetic files and declared product fields |
| POST | /v1/verifications/{id}/recheck | Append a rule recheck with current chain_hash |
| GET | /v1/review-queue | Risk-ranked uncertain cases |
| POST | /v1/verifications/{id}/review | Reviewer decision, note, current chain_hash |
| GET | /v1/reports/{id} | Rules, evidence hashes, risk and audit |
| GET | /v1/widgets/{id} | Bilingual badge data |
| GET | /v1/audit/{id} | Hash-chain integrity |
| GET | /v1/demo/scenarios | All 40 synthetic listing fixtures, including L1 |
| GET | /v1/agency/summary | Aggregate saved synthetic verifications without seller identities |
| POST | /v1/listings/suggest-copy | Screened deterministic copy template |
| POST | /v1/products/compare | Compare up to 10 saved reports |
| POST | /demo/tamper/{id} | Intentionally alter a synthetic trace |

Evidence uploads return `200` and accept two nonempty files up to 2 MiB each. Blank registration, product, or licence-holder declarations return `422` before any evidence is saved. Each decision uses the same registry record for identity, permit, and evidence comparisons. R-02 returns `skip` when verification stops before category comparison. During an outage, registry-dependent checks are skipped and the result is `UNKNOWN`. A recheck looks up the registry again without repeating the earlier request's outage simulation.

If a stored audit chain fails validation, the shopper widget returns `UNKNOWN`. The report retains the recorded status alongside the failed audit result for investigation.

## Optional AI extraction

The extraction client uses OpenAI structured output and drops every phrase absent from the listing. Deterministic rules evaluate the extracted phrases. Without configuration, keyword rules run locally.

Explicit human approval is required before sending listing text to OpenAI. After obtaining approval, configure the process environment with OPENAI_API_KEY and TRUSTCART_AI_TRANSFER_APPROVED=true. OPENAI_MODEL is optional. The deployed demo currently uses local deterministic screening. Tests use fake clients and never call OpenAI.

Validation: 105 tests pass, including the documented OpenAPI workflow, grounded extraction, the L1 loop, evidence validation, dataset invariants, agency aggregation, and audit checks. Risk weights are illustrative and need calibration.

## Dataset and release update

The deterministic generator at scripts/generate_demo_dataset.py produces 18 fictional DEMO registry references, 40 tagged listings, and 16 evidence-case definitions. The evidence definitions include unsupported COA cases explicitly marked as roadmap. Existing DEMO aliases remain compatible. No official registration numbers are generated. Submitted numeric references must match the expected grouped format; malformed or unsupported references return UNKNOWN.

Expired or revoked fixtures are denied. Permit conflicts and required missing permits remain PENDING. Unsupported registries return UNKNOWN. Drug-category and prohibited supplement claims are screened by the synthetic rule pack. All 40 listings have explicit expected status and rule failures, and every outage variant remains UNKNOWN.

GET /v1/agency/summary aggregates saved synthetic verifications by status, failing rule, category, day, claim phrase and audit validity. The Agency view exposes those totals without seller identity fields.

The release retains the existing router split, SQLite evidence migration compatibility, evidence-backed rechecks, ThomazAgents.md, and competition declarations. Python 3.9 pytest CI runs on pull requests and pushes to main with read-only repository permissions and no live credentials. Live AI, official registry integration, document authenticity/COA validation and marketplace OAuth remain integration work.

Two normal, unverified reference listings now use short title excerpts from Shopee (Neocell Super Collagen + C and Deva C Vitamin C). Their descriptions are explicitly labeled summaries of visible pack-size information, because full seller descriptions could not be retrieved. Source links are available in product details. They carry no verified badge. Three additional, explicitly labeled copy-correction examples reuse matching market photos with test overclaims; those phrases are not attributed to the source sellers.

## Frontend integration

The fe branch is integrated with the released main API. The root route serves the TrustCart marketplace, /seller manages versioned product listings, and /reviewer reads verification reports. /workspace retains evidence upload, rechecks, reviewer decisions, outage and tamper controls, and agency aggregation. /docs remains available behind the same password gate.

Product edits use optimistic version checks and atomically create fresh verification history in SQLite. The current released identity policy, required supplement term, UNKNOWN outage handling, and hash-based reviewer actions remain in effect. Frontend fixtures and tests use the released registry identity. The storefront, seller and reviewer retain the Shopee-style orange theme, compact controls and reference campaign imagery. Backend integration does not replace the visual theme.

Local checks include pytest, npm test and npm run test:browser. Install Node dependencies with npm ci.

## Shared production storage

Configure TRUSTCART_DATABASE_URL with a PostgreSQL connection string in the Vercel project environment to enable durable shared storage. The database role needs permission to create the dedicated trustcart schema and its tables. The first startup creates verifications, products, evidence and reviews with indexes. These are additive changes isolated from public-schema tables.

PostgreSQL mutations lock the selected verification or product row before validating its revision. Evidence hashes, review history and product versions remain in the same transaction as the updated decision. A configured but unavailable database fails the request instead of falling back to temporary local data.

Without this variable, the app uses its existing SQLite database. Local SQLite records and schema migrations remain supported. Moving to PostgreSQL starts a shared database; existing instance-local Vercel records are not automatically imported.

Customers see saved seller products ahead of the example catalog. The catalog refreshes on load, focus, visibility restoration, cross-tab update notifications, and every five seconds while visible. Only APPROVED results with confidence at least 0.75, no human-review requirement and an audit hash receive a clickable badge. Denied/unconfirmed listings are normal cards. Refresh failures remove seller-product badges until a fresh result is available. Edits update the same product card; drafts remain private to the browser until submitted. Prices are required for all new and edited product API requests. Legacy records without prices remain editable by sellers but are excluded from the customer catalog until priced. Shop recommendation labels are omitted because no shop-level recommendation data exists.

Seller product records survive restarts and are reloaded from the database, while prior verification reports remain accessible in Reviewer. The deployed workspace uses the shared demo password gate; per-seller tenant ownership remains unimplemented.


The seller list displays each saved product’s image, price, stock and verification status with separate **Edit** and **View product** actions. It refreshes saved summaries on focus without replacing unsaved form edits. Missing images use a neutral placeholder; prices and stock are never invented for older records. Market image provenance is recorded in `frontend/assets/sources.json`; these photos are reference artwork, not product certification.

Hosted browser tests reproduce missing products and reports when Vercel requests reach different temporary SQLite instances. The PostgreSQL adapter requires the team's connection configuration and hosted verification before this persistence issue can be marked resolved. Unit tests isolate external database and AI configuration.

Latest merged local validation: 111 Python tests, 107 Node component tests, and 22 desktop/mobile browser tests passed. These checks use isolated SQLite data and a fake PostgreSQL client. The latest hosted desktop/mobile run against the existing SQLite deployment passed 16 checks and failed 4 saved-product continuity checks. PostgreSQL deployment and hosted retesting remain pending. GitHub CI runs both the API and frontend suites.

The reviewer product list shows saved images, prices, stock and latest verification statuses. Open report loads the corresponding detailed audit while historical reports remain accessible. Product details have direct `/products/{id}` URLs.

The shared visual theme remains Shopee-style after backend merges: orange tokens, compact corners, campaign imagery and consistent seller/reviewer controls. Evidence workspace and API links remain available.
