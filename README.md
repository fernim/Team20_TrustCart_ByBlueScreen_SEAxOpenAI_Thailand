# TrustCart

**Verify the listing. Trace the evidence. Escalate uncertainty.**

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart is an API-first, human-governed verification workflow. It adds optional, document-backed product verification to a Shopee-style marketplace. Sellers publish listings, submit private evidence, and track blockers; reviewers resolve uncertain cases; buyers see a clickable tick only on the current passing product revision. The registry remains synthetic: the badge is not official certification or proof of physical authenticity.

> **All data is synthetic.** TrustCart does not connect to the Thai FDA registry or any marketplace. It is not affiliated with Shopee or Thai FDA, and its results are decision support. They are not certification, legal advice, or medical advice.

[Decision replay demo and marketplace pilot](docs/DECISION_REPLAY.md)

## Problem

A real 13-digit Thai FDA registration number does not prove that the listed product holds it. Shoppers cannot tell whether the number on a health-product listing belongs to that product. Listings also claim to treat, prevent, or reverse disease. Enforcement happens after publication: Thai FDA reports 121,494 illegal health-product ads closed between 2023 and April 2026. Sources are listed in the pitch deck. Small sellers usually learn the rules when a listing is taken down.

## Solution

TrustCart checks a listing **before granting its product badge** through an API. The design rule is *AI extracts and suggests, deterministic rules decide, humans govern*:

- Rules R-01 to R-05 decide the status. A language model is never allowed to set one.
- A registry outage, missing reference, or unmapped category returns `UNKNOWN` with human review. TrustCart never approves a case it could not verify.
- Every decision step is written to a SHA-256 hash-chained audit trace.

## Product: one verification engine, two delivery surfaces

```
Seller / marketplace listing
        |
        v
POST /v1/verifications  ──>  Registry adapter (synthetic in demo)
        |                      + rule-based identity, category,
        |                        advertising and evidence checks
        v
  APPROVED / PENDING / DENIED / UNKNOWN
        |
        +--> Evidence upload --> Recheck --> Human review when required
        |
        +--> Evidence-linked report + hash-chained audit trace
        |
        +--> API response / reviewer dashboard / shopper-facing demo widget
```

**The API is the product; the dashboard is the demonstration and review interface.** They share the same backend decision model rather than implementing separate verification systems.

**Design principle:** *AI extracts and suggests. Deterministic rules decide. Humans govern.* Optional language-model extraction must remain grounded in the listing text and cannot set or override a verification status. With no approved external AI configuration, the demo uses local rule-based screening.

### Intended users and commercial buyers

| Role                                                          | Job to be done                                                        | TrustCart interface                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Marketplace trust-and-safety or listing-operations team       | Screen listings consistently and route unresolved cases               | **Verification API + reviewer queue + audit report** |
| Supplement brand, seller-operations team, or marketing agency | Find listing problems and provide missing evidence before publication | **Seller dashboard + evidence/recheck flow**         |
| Shopper                                                       | Understand which checks ran and what remains unverified               | **Demo trust status + explanation**                  |
| Regulatory reviewer or other authorized human reviewer        | Inspect evidence, resolve escalations, and retain decision history    | **Reviewer dashboard + tamper-evident trace**        |

**Who might pay?** The commercial hypotheses are (1) marketplaces or seller platforms paying for API usage / enterprise integration, and (2) brands or agencies paying for a hosted review workflow. **Neither willingness to pay nor customer ROI has been validated.** We are not asserting that a large marketplace would outsource functionality it can build internally.


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
- **Validation.** Run the Python, DOM and Playwright commands below. Browser tests use real role sessions, temporary SQLite data and password-free demo role selection; they never call live OpenAI.

## Run locally

Create `.venv` and install `requirements.txt`. No password variables are required. On `/login`, choose a demo account and continue:

| Account | Access |
| --- | --- |
| `buyer` | Public product catalog |
| `seller1` | TrustCart Demo Shop |
| `seller2` | BlueScreen Health Shop |
| `reviewer` | Agency and cross-shop review |

This is public demo role selection: anyone can choose any role. Sessions, shop ownership checks and CSRF protection remain in place; the selector does not authenticate a real identity.

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
```

On Windows, use `.venv/Scripts/python` instead. Open `http://localhost:8000/login`. Buyers can also browse without signing in. Sessions last eight hours and use HttpOnly cookies and CSRF tokens. Choose a role to enter seller or agency views; no password is requested.

## Connected demo

See [the English walkthrough](DEMO.en.md) or [คู่มือเดโมภาษาไทย](DEMO.md).

- **Buyer:** `/` and `/products/{id}` show published product images, price and stock. Only an eligible current approval has a clickable badge with a short explanation. Buyers receive no private documents, AI findings or audit hashes.
- **Seller:** `/seller` shows only that shop's products. Publication is independent of verification. The demo ฿299/month plan enables unlimited verification submissions without taking payment. Each submission needs a label and registration document, plus an advertising permit when required. Sellers see the stage, blockers, reviewer instructions and prior revisions, and can submit more documents for a new review.
- **Agency:** `/agency` replaces the Reviewer workspace, with Thai/English language switching, Shopee/Lazada source filters, action-based work queues, result filters and product/reference search. `/agency/submissions/{id}` opens a dedicated product report. Staff choose Start review before recording a decision. Approve, Deny and Request documents require a reason and the current chain hash. Approval requires confirmed documents and screened listing copy. Denial requires a conclusive rule failure or a reviewer-confirmed registry identity mismatch. The audit records the denial basis. An unavailable registry remains `UNKNOWN` and needs review.

Editing any product invalidates its current badge and supersedes its submission. Historical evidence and traces remain available privately. Late AI results and stale reviewer decisions cannot approve the edited product. The Agency workspace uses the existing reviewer account and role; legacy APIs and `/workspace` remain reviewer-only diagnostic surfaces.

### Live assessment and replay

`backend/app/document_assessment.py` calls the OpenAI Responses API for document extraction/readiness only. Enable it with environment variables `OPENAI_API_KEY` and `TRUSTCART_AI_TRANSFER_APPROVED=true`; `OPENAI_DOCUMENT_MODEL` optionally overrides `gpt-4o-mini`. The UI identifies document transfer and the selected mode. `backend/app/llm.py` remains the separate grounded claim extractor. Neither model sets a status.

**Live** never silently switches to canned data. Provider errors, malformed output and unconfigured live access produce `UNKNOWN`, no badge, and a retry/review action. Extraction below 0.75 or inconsistent/unreadable evidence requires review. Text-PDF quotations are independently checked; image-only/scanned documents require human visual confirmation. Categories other than supplements require manual review. Registry failures cannot be approved by a reviewer.

**Replay** accepts only the exact synthetic example listing and document hashes provided in Seller Centre. It is visibly labeled and makes no OpenAI call. The three examples demonstrate approval, uncertain documents and a prohibited claim. Real market reference names/photos remain unverified. Reference imagery provenance is in `frontend/assets/sources.json`.

### Storage and deployment scope

Startup adds `tc_*` tables without deleting existing records. Existing catalog products are assigned to the first demo shop but do not inherit a badge from legacy verification. Submissions retain immutable listing snapshots and private document revisions. Evidence bytes are held in SQLite locally or BYTEA when `TRUSTCART_DATABASE_URL` selects the existing PostgreSQL adapter. Files are limited to PDF/PNG/JPEG/WebP, 2 MiB each, five active documents per submission and ten unencrypted PDF pages.

Local checks use synthetic registry data and replay documents. Hosted PostgreSQL and live OpenAI calls require separate environment validation. Serverless SQLite is ephemeral. Demo subscription activation does not collect payment. See [Agency workflow details](AGENCY.md).

The optional `app:app` hosting entrypoint uses the same role sessions. Its old shared Basic gate (`TRUSTCART_DEMO_PASSWORD`) remains for legacy diagnostic access; it does not replace reviewer authorization. New role screens and the public storefront do not use that shared password.

### Marketplace API clients

Set `TRUSTCART_MARKETPLACE_CLIENTS` in the process environment to enable client credentials. Its JSON object is keyed by client ID and each entry contains `secret`, `shop_id` and a `scopes` array containing `seller:read`, `seller:write`, or both. Bind each client to an existing shop. Keep the configuration in the deployment secret store. Exchange HTTP Basic client credentials at `POST /oauth/token` with the URL-encoded `grant_type=client_credentials` and optional `scope`. Send the returned 15-minute access token as `Authorization: Bearer <access_token>` over HTTPS.

Bearer tokens access the client's shop products, submissions, submission history and allowed documents. Subscription activation, reviewer operations and legacy diagnostics require a browser role session. If marketplace configuration is present, call `POST /v1/auth/login` with `username` and `password` using the corresponding `TRUSTCART_BUYER_PASSWORD`, `TRUSTCART_SELLER1_PASSWORD`, `TRUSTCART_SELLER2_PASSWORD` or `TRUSTCART_REVIEWER_PASSWORD` environment setting. Old passwordless role sessions are rejected in that environment, and new sessions still require CSRF for writes. Keep the passwordless demo and the client environment on separate databases.

## Tests

```sh
.venv/bin/python -m pytest -q
npm ci
npm test
npm run test:browser
```

Browser tests run on port 8768 with a temporary database, password-free role selection and desktop/mobile viewports. They cover public shopping and reviews, seller media and publication, matching document approval, prohibited-claim denial, reviewer requests, resubmission history and badge invalidation. Python tests separately cover ownership, CSRF, stale hashes, late AI results, replay mismatches, ungrounded extraction, file limits and outages. Legacy policy tests isolate authentication in the test harness; `test_connected_*` tests exercise the real guard. Older seller/reviewer DOM harnesses remain regression coverage for the legacy components; connected browser tests exercise the scripts served by the current role pages.

For hosted testing, confirm the candidate commit using `GET /version`, then set `TRUSTCART_BASE_URL` to an authorized disposable demo deployment with shared PostgreSQL. The suite creates persistent synthetic products, submissions and reviews. Hosted browser traces are disabled.

## Legacy L1 diagnostic demo (`/workspace`, reviewer only)

1. Open Seller and select L1. Submit the listing to receive PENDING.
2. Use the synthetic sample files to upload label and certificate evidence. The conflicting fields keep the result PENDING at confidence 0.60.
3. Recheck the case and open Reviewer. Refresh the queue, enter a reason, and deny the selected case.
4. Verify the saved audit. Run the tamper simulation to show a broken chain on a copy, then verify the saved audit again.
5. Submit a new case to restart. Select simulated registry outage to see zero approvals across the 20 records.

## API workflow

FastAPI registers the connected workflow routers alongside the legacy diagnostic routers from `backend/app/api/`. The API entry point is `backend.app.main:app`. The password-protected local demo uses `app:app`.

| Router | API area |
| --- | --- |
| `verifications.py` | Listing submission and retrieval |
| `products.py` | Versioned product creation, updates, and retrieval |
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
| GET | /version | Public commit SHA from VERCEL_GIT_COMMIT_SHA, or local |
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
| POST | /demo/tamper/{id} | Simulate a change to a copy of a trace and return the audit result |

Evidence uploads return `200` and accept two nonempty files up to 2 MiB each. Blank registration, product, or licence-holder declarations return `422` before any evidence is saved. Each decision uses the same registry record for identity, permit, and evidence comparisons. R-02 returns `skip` when verification stops before category comparison. During an outage, registry-dependent checks are skipped and the result is `UNKNOWN`. A recheck looks up the registry again without repeating the earlier request's outage simulation.

Legacy verification responses, reports and widgets expose `verification_scope`. `identity_category` means R-03 was skipped. `listing` means R-03 checked the advertising copy. Both scopes use the demo's synthetic registry. The connected catalog badge requires a current approval with meaningful copy and an R-03 pass. Swagger describes the success response fields for evidence, recheck, review, reports, widgets and comparison.

Once a reviewer has recorded a decision, seller evidence uploads and rechecks on that verification return `409`. Submit a fresh verification for updated evidence or an edited listing. A reviewer may record a new supported decision using the latest audit hash.

Evidence uploads accept an optional comma-separated `standards` declaration. ISO 9001 alone cannot satisfy R-05; ISO 22000 or GMP can satisfy the standards comparison when identity checks also pass. This compares declarations, not certificate authenticity. A file digest already stored for another verification adds a `duplicate_evidence` trace event and requires human review at confidence 0.60; rechecks retain unresolved duplicate warnings.

If a stored audit chain fails validation, the shopper widget returns `UNKNOWN`. The report retains the recorded status alongside the failed audit result for investigation.

## Run locally on macOS or Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
```

The local entry point uses role sessions for private workflows. Shopping is public. The hosted `app:app` entry point also retains a Basic gate for legacy diagnostics; it does not replace role authorization. `/version` is a public GET endpoint returning only the commit identifier. Use the generated `/docs` for current request schemas.

## Optional AI extraction

The extraction client uses OpenAI structured output and drops every phrase absent from the listing. Deterministic rules evaluate the extracted phrases. Without configuration, keyword rules run locally.

Explicit human approval is required before sending listing text to OpenAI. After obtaining approval, configure the process environment with OPENAI_API_KEY and TRUSTCART_AI_TRANSFER_APPROVED=true. OPENAI_MODEL is optional. The deployed demo currently uses local deterministic screening. Tests use fake clients and never call OpenAI.

Local tests cover the documented OpenAPI workflow, grounded extraction, the L1 loop, evidence validation, dataset invariants, agency aggregation and audit checks. Risk weights are illustrative and need calibration. See [API judge Q&A](docs/JUDGE_QA.md) for reviewer access, completed-review protection, cross-origin write rejection and audit simulation.

## Dataset and release update

The deterministic generator at scripts/generate_demo_dataset.py produces 18 fictional DEMO registry references, 40 tagged listings, and 16 evidence-case definitions. The evidence definitions include unsupported COA cases explicitly marked as roadmap. Existing DEMO aliases remain compatible. No official registration numbers are generated. Submitted numeric references must match the expected grouped format; malformed or unsupported references return UNKNOWN.

Expired or revoked fixtures are denied. Permit conflicts and required missing permits remain PENDING. Unsupported registries return UNKNOWN. Drug-category and prohibited supplement claims are screened by the synthetic rule pack. All 40 listings have explicit expected status and rule failures, and every outage variant remains UNKNOWN.

GET /v1/agency/summary aggregates saved synthetic verifications by status, failing rule, category, day, claim phrase and audit validity. This remains a legacy diagnostic aggregate without seller identity fields. The current Agency workspace uses `/v1/reviewer/queue` over current shop-owned submissions instead.

The release retains the existing router split, SQLite evidence migration compatibility, evidence-backed rechecks, ThomazAgents.md, and competition declarations. Python 3.9 pytest CI runs on pull requests and pushes to main with read-only repository permissions and no live credentials. This project uses the synthetic registry for API client and storefront flows. Live AI activation, document authenticity/COA validation and a real marketplace rollout are separate work.

Two normal, unverified reference listings now use short title excerpts from Shopee (Neocell Super Collagen + C and Deva C Vitamin C). Their descriptions are explicitly labeled summaries of visible pack-size information, because full seller descriptions could not be retrieved. Source links are available in product details. They carry no verified badge. Three additional, explicitly labeled copy-correction examples reuse matching market photos with test overclaims; those phrases are not attributed to the source sellers.

## Frontend integration

The fe branch is integrated with the released main API. The root route serves the TrustCart marketplace, /seller manages versioned product listings, and /agency manages the current product verification queue and reports (/reviewer redirects). /workspace retains evidence upload, rechecks, reviewer decisions, outage and tamper controls, and agency aggregation. /docs remains available behind the same password gate.

Open **Evidence and review** on a saved product to load its current verification in `/workspace`. The workspace can also open a product from its saved-product list. Listing edits retain the product's price, stock, and images and create a new verification revision. Evidence, rechecks, and reviewer decisions update that verification, so the marketplace displays the current badge when it refreshes. Each workspace case links back to its marketplace product.

The Agency tab shows the same saved, priced listings as Marketplace. Each row shows product details and the latest verification status and confidence, with links to the marketplace product and its current verification. The separate verification history includes earlier revisions and standalone checks. Static reference listings have no verification record.

Marketplace, Seller, and Reviewer share a Thai/English language preference. Switching language keeps form edits and the active report. Seller-entered product copy and recorded audit entries stay in their original language.

Product edits use optimistic version checks and atomically create fresh verification history in SQLite. The current released identity policy, required supplement term, UNKNOWN outage handling, and hash-based reviewer actions remain in effect. Frontend fixtures and tests use the released registry identity. The storefront, seller and reviewer retain the Shopee-style orange theme, compact controls and reference campaign imagery. Backend integration does not replace the visual theme.

Local checks include pytest, npm test and npm run test:browser. Install Node dependencies with npm ci.

## Business model and validation plan

**B2B APIaaS (proposed):** A marketplace or seller platform could pay per verification or under an enterprise contract. **B2B workflow SaaS (proposed):** Brands/agencies with frequent reviews could pay by user seat or review volume. Shoppers benefit from transparency but are **not** the assumed subscription payer.

A credible commercial case needs a pilot with an authorized data source and real operations teams:

| Hypothesis to test                            | Measure                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Current verification is fragmented or costly  | Baseline time per review; number of systems consulted; evidence follow-ups |
| TrustCart reduces repetitive work             | Change in time-to-decision and reviewer workload versus current process    |
| TrustCart does not sacrifice safety for speed | Critical-issue recall, false approvals, false positives, escalation rate   |
| Evidence history is operationally useful      | Share of decisions with complete source/rule/reviewer trace                |
| Organizations will pay                        | Signed pilot, actual budget owner, paid conversion, retention              |

**Market sizing discipline:** the total value of Thailand's supplement sales is **not** TrustCart's addressable software market. A bottom-up estimate should use `eligible paying organizations × validated annual contract value`, with an explicit market-access assumption. No TAM, revenue, ROI, or customer conversion figure is claimed as validated here.

### Why not just use the Thai FDA search, generic AI, or marketplace filters?

- **Official lookup:** authoritative product information is vital, but product identity, listing claims, missing evidence, and a reviewer decision still need to be connected in a workflow.
- **Generic AI:** useful for interpreting text, but TrustCart keeps the decision behind explicit rules, exposes uncertainty, and records the actions taken.
- **Marketplace tooling:** large platforms already invest in screening and can build internally. TrustCart's *hypothesized* value is a reusable, auditable service that can fit smaller platforms, seller operations, or cross-channel workflows. Integration and ROI must be proven.

## Roadmap

MoPH 448 ingredient ceilings (B11) remain Roadmap; no ingredient-ceiling check is implemented.

1. **Evidence and quality:** expert-reviewed Thai rule pack; current regulatory sources and rule versioning; representative evaluation sets; calibrated risk ranking.
2. **Trusted data:** authorized Thai FDA registry/permit adapter with field provenance, freshness, source availability, and error handling.
3. **Pilot integration:** one real marketplace or seller-operations workflow with consent, proper API authentication, human-review permissions, durable storage, and privacy/security controls.
4. **Expansion:** additional health-product categories and jurisdictions only after local rules, data access, and product-market fit are validated.


## Shared production storage

Configure TRUSTCART_DATABASE_URL with a PostgreSQL connection string in the Vercel project environment to enable durable shared storage. The database role needs permission to create the dedicated trustcart schema and its tables. The first startup creates verifications, products, evidence and reviews with indexes. These are additive changes isolated from public-schema tables.

On Vercel, a Supabase Marketplace resource supplies `SUPABASE_URL` and `POSTGRES_URL` for each connected environment. TrustCart reads the managed `POSTGRES_URL` when `SUPABASE_URL` is present and no explicit `TRUSTCART_DATABASE_URL` is set. Use a separate database for disposable Preview testing because the tests create persistent synthetic cases. For manual configuration, use the Supabase **Transaction pooler** URI (port `6543`) with `sslmode=require` as the secret value of `TRUSTCART_DATABASE_URL`. The adapter disables automatic prepared statements and selects the `trustcart` schema for each transaction. Verify on a new deployment that a synthetic case saved in the workspace is visible on its marketplace product.

PostgreSQL mutations lock the selected verification or product row before validating its revision. Evidence hashes, review history and product versions remain in the same transaction as the updated decision. A configured but unavailable database fails the request instead of falling back to temporary local data.

Without either database configuration, the app uses its existing SQLite database. Local SQLite records and schema migrations remain supported. Moving to PostgreSQL starts a shared database; existing instance-local Vercel records are not automatically imported.

Customers see saved seller products ahead of the example catalog. The catalog refreshes on load, focus, visibility restoration, cross-tab update notifications, and every five seconds while visible. Only APPROVED results with confidence at least 0.75, no human-review requirement and an audit hash receive a clickable badge. Denied/unconfirmed listings are normal cards. Refresh failures remove seller-product badges until a fresh result is available. Edits update the same product card; drafts remain private to the browser until submitted. Prices are required for all new and edited product API requests. Legacy records without prices remain editable by sellers but are excluded from the customer catalog until priced. Shop recommendation labels are omitted because no shop-level recommendation data exists.

Seller product records survive restarts and are reloaded from the database, while prior verification reports remain accessible in Reviewer. The deployed workspace uses the shared demo password gate; per-seller tenant ownership remains unimplemented.


The seller list displays each saved product’s image, price, stock and verification status with separate **Edit** and **View product** actions. It refreshes saved summaries on focus without replacing unsaved form edits. Missing images use a neutral placeholder; prices and stock are never invented for older records. Market image provenance is recorded in `frontend/assets/sources.json`; these photos are reference artwork, not product certification.

Hosted browser tests reproduce missing products and reports when Vercel requests reach different temporary SQLite instances. The PostgreSQL adapter requires the team's connection configuration and hosted verification before this persistence issue can be marked resolved. Unit tests isolate external database and AI configuration.

Local validation passed 193 Python tests, 122 Node component tests and 34 desktop/mobile browser checks. Two app instances backed by disposable PostgreSQL shared sessions, documents, reviewer decisions and OAuth tokens. The smoke checks also covered stale hashes, audit validity, buyer badge propagation and seller token isolation from reviewer routes. Hosted Supabase persistence still needs verification on a current disposable deployment. The historical hosted SQLite run passed 16 of 20 checks, with four saved-product continuity failures.

The reviewer product list shows saved images, prices, stock and latest verification statuses. Open report loads the corresponding detailed audit while historical reports remain accessible. Product details have direct `/products/{id}` URLs.

The shared visual theme remains Shopee-style after backend merges: orange tokens, compact corners, campaign imagery and consistent seller/reviewer controls. Evidence workspace and API links remain available.

## Background references

- [Thai FDA — misleading health-product advertising and complaints (27 January 2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3428)
- [Thai FDA Journal — survey of unlawful online health-product advertisements (2024)](https://he01.tci-thaijo.org/index.php/fdajournal/article/view/273126)
- [Thai FDA — platform screening and enforcement update (2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3498)
- [Thai FDA Food Division — advertising criteria (2026)](https://food.fda.moph.go.th/food-law/announ-fda-ads69)
- [Product brief](PRODUCT.md) · [Implementation details](IMPLEMENTATION.md) · [Demo guide](DEMO.md) · [Developer/agent instructions](AGENTS.md)
