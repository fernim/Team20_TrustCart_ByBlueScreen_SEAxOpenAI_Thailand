# TrustCart

**Verify the listing. Trace the evidence. Escalate uncertainty.**

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand.

TrustCart is a FastAPI application with a vanilla JavaScript marketplace, a shop-owned Seller Centre, and an Agency review workspace. Sellers can publish products without verification. A separate, optional evidence workflow determines whether the current product revision earns a clickable verification badge.

The design rule is **AI extracts and suggests; deterministic rules decide; humans govern**. Decision steps use `Trace.add` to append SHA-256 hash-chained entries. Human actions validate the current chain hash and retain prior history.

**Current scope:** registry records and replay documents are synthetic. Seller-entered products and uploaded documents are persisted application data; some storefront content is static reference artwork or explicitly labeled sample content. The app has no live Thai FDA, Shopee or Lazada feed and is not affiliated with those organizations. A badge is not official certification, document authentication, or proof of physical authenticity.

[Decision replay demo and marketplace pilot](docs/DECISION_REPLAY.md)

## Implementation audit

Reviewed against the source and local tests on **21 November 2026**, starting from commit `bbb9e04`. This README describes implemented behavior. [PRODUCT.md](PRODUCT.md), [REGISTRATION.md](REGISTRATION.md), and older deployment/demo documents also contain targets and historical descriptions; do not treat those as proof of a live deployment.

| Area | Implemented now | Limit |
| --- | --- | --- |
| Marketplace | Public catalog, search/categories/sorting, product URLs, images, price/stock, local cart, Thai/English UI | No payment, order fulfillment, or live marketplace feed |
| Seller Centre | Shop-owned product creation/editing, private drafts, explicit refresh, optional subscription and evidence submissions | Public demo role selection; subscription does not collect money |
| Agency | Current submission queues, marketplace/status/work filters, bilingual reports, Start review, decisions and revision history | Shopee denotes this local storefront; Lazada has no seeded/live feed |
| Verification | Deterministic R-01–R-05 checks, four statuses, confidence/review routing, audit hashes | Narrow synthetic rule pack; not comprehensive regulatory compliance |
| Document assessment | Explicit live OpenAI mode and exact-fixture replay mode | Live requires approved transfer/configuration; scans/images require human confirmation |
| Persistence | SQLite default; optional PostgreSQL adapter compatible with Supabase | Actual hosted database selection/connectivity is not established by local tests |
| Access controls | Opaque server sessions, role checks, seller ownership, CSRF and cross-origin write rejection | Anyone can select any demo role; not production identity authentication |

## Data flow: is this using Supabase or real data?

```text
Browser
  ├─ public catalog ──> /v1/catalog/products
  ├─ seller actions ──> /v1/seller/*
  └─ agency actions ──> /v1/reviewer/*
                              |
                       FastAPI + database adapter
                              |
                       SQLite OR PostgreSQL

Verification ──> tool_registry_lookup ──> local synthetic registry.json
Document run ──> live OpenAI (explicitly enabled) OR exact synthetic replay
```

The browser calls FastAPI, not the Supabase JavaScript SDK or Data API. The server can connect directly to Supabase PostgreSQL through `psycopg`. This integration does not use Supabase Auth, Storage buckets, or Realtime: sessions are application tables, and evidence bytes are stored in database BLOB/BYTEA columns.

Database selection in `backend/app/database.py` is:

1. A nonempty `TRUSTCART_DATABASE_URL` selects PostgreSQL in any environment.
2. Otherwise, when `VERCEL=1` and `SUPABASE_URL` is present, `POSTGRES_URL` must supply a valid PostgreSQL URI. Missing/invalid managed configuration fails rather than silently choosing SQLite.
3. Without either configuration, the app uses its SQLite path. `SUPABASE_URL` alone outside Vercel does not select PostgreSQL.

A configured PostgreSQL connection failure does not fall back to SQLite. Connections disable automatic prepared statements and set the transaction-local `trustcart` search path. Startup creates the application schema/tables and adds connected workflow tables and indexes; existing local records remain supported. Existing products without owners are assigned to the first demo shop and do not inherit connected badges from legacy verifications. Switching databases does not automatically copy SQLite records.

**Deployment status is unverified in this audit.** The presence of a Supabase integration or environment-variable names in the repository does not prove that a specific deployment uses it. Confirm the environment for the exact Preview/Production deployment and verify persisted data through an authorized hosted check. Serverless SQLite is instance-local and unsuitable for durable shared data. Even when Supabase is active, registry results still come from synthetic fixtures.

## Run locally

The project targets Python 3.9 and has Python 3.9 CI. This audit also validated the backend on Python 3.13. Use a compatible Python interpreter when creating the environment; the existing Python 3.15 environment could not install the pinned `psycopg[binary]>=3.2,<3.3` dependency.

```sh
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
```

On Windows, use an installed compatible Python to run `python -m venv .venv`, then replace `.venv/bin/python` with `.venv/Scripts/python` in subsequent commands.

Open [the local storefront](http://localhost:8000/) or [demo role selection](http://localhost:8000/login). No password is required for these roles:

| Demo account | Role/access |
| --- | --- |
| `buyer` | Public catalog; shopping also works while signed out |
| `seller1` | TrustCart Demo Shop |
| `seller2` | BlueScreen Health Shop |
| `reviewer` | Agency and cross-shop review |

Sessions last eight hours. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS; stored session identifiers are hashed. Private mutations need the session's `X-CSRF-Token`, returned by login and `/v1/auth/me`. Seller ownership checks restrict records to the selected shop, but public role selection makes this a demo access model, not verified identity or production isolation.

### Entry points

| Command target | Behavior |
| --- | --- |
| `backend.app.main:app` | Core marketplace, login, Seller Centre, Agency, connected and legacy API routers; local SQLite defaults to `trustcart.sqlite3` |
| `app:app` | Same application plus `/workspace`, `/version`, synthetic dashboard scenarios and tamper simulation; SQLite defaults to a file in the system temporary directory |

`vercel.json` packages `app.py` with backend, frontend, and `demo.html`. The hosting entry point retains an optional HTTP Basic gate for legacy tools using environment-only `TRUSTCART_DEMO_PASSWORD` and optional `TRUSTCART_REVIEWER_PASSWORD`. Connected pages use role sessions; Basic access does not replace role authorization. `/docs`, `/openapi.json`, and `/workspace` require the reviewer role. `/version` is a public GET in `app:app` and returns a commit identifier only, not storage health.

## Delivered user workflows

### Shopper

- Browse static examples and saved, priced seller products; search, filter, sort and load more.
- Open `/products/{id}` directly, reload it, and navigate back/forward. Reference examples use local IDs; saved products have stable IDs.
- View galleries, product descriptions, prices and stock. Cart quantities are bounded and seller stock is respected; the cart is local demo state and resets on reload.
- Product detail pages include reference specifications, sample reviews with filters/pagination/photo dialogs, and related-product navigation. Sample reviews, shipping and shop facts are presentation data, not a review database or shipping offer. Seller products do not receive invented reviews.
- Campaigns and eight brand-shop links use local reference artwork with external source links. They never receive verification badges. Provenance is recorded in `frontend/assets/sources.json`.
- The catalog refreshes on load, focus, visibility restoration, relevant storage events, and every five seconds while visible. Failure removes saved-product badges until fresh results arrive. Unpriced legacy products are omitted by the storefront until priced.

Public catalog data includes listing fields, shop identity, minimal status and `badge_eligible`; it excludes private evidence, document findings and audit hashes. Eligibility is calculated server-side from the current submission/version, `COMPLETED` stage, `APPROVED` status, confidence at least 0.75, no human-review requirement, and a valid audit chain. A legacy standalone approval does not grant a connected product badge.

### Seller

- Create/edit products with required price, optional stock and up to five locally encoded raster images. Product updates require `expected_version`; stale edits return `409`.
- Save a local draft and publish independently of verification. Successful publication remains visible if the optional verification action fails.
- Activate the **demo ฿299/month** verification plan. This sets an expiry one calendar month ahead and enables submissions; it is not billing, payment, automatic renewal, or a validated commercial offer.
- Create an immutable submission snapshot; upload a label and certificate/registration document, plus a permit when required by the listing or synthetic registry. Up to five active documents are retained per submission.
- Run live assessment or choose a labeled sample and replay. View blockers, reviewer notes, current status and private revision history; resubmit for a new evidence review.
- Use **Refresh products** or **Refresh status** for external updates. Seller product lists load on entry and after local actions; they do not poll while idle or on window focus. Manual refresh preserves unsaved edits.

Any product edit supersedes the active submission and removes its badge. Replacing checked evidence requires a new submission. The backend checks product version, current submission and chain hash; stale reviewer actions and late assessment results cannot approve a newer revision. Assessment runs use a run token and lease to reject concurrent/stale completions.

### Agency/reviewer

`/agency` is the current reviewer workspace. `/agency/submissions/{id}` opens a dedicated report. `/reviewer` redirects to Agency, optionally preserving a valid submission ID.

The queue shows current submissions with Shopee/Lazada source filters, work queues, status filters and product/reference search. Staff can inspect private originals, grounded findings, rule results, revision history and audit traces. The UI offers **Start review** before recording a decision; the transition is audited.

Decisions are **Approve**, **Deny**, or **Request documents**, with a meaningful reason and current `chain_hash`. Approval requires explicit required-document and identity-field confirmations and reruns deterministic checks. Prohibited claims and unresolved registry/category/evidence failures block approval. Registry unavailability cannot establish a denial. Requesting documents returns the case to seller action and retains prior history.

## Rules, statuses and evidence limits

| Rule | Implemented scope |
| --- | --- |
| R-01 | Synthetic registration source/format, active state, product name and licence-holder matching |
| R-02 | Registered category match and category-specific claim phrases |
| R-03 | Deterministic disease/advertising patterns, supplement-required term, Thai/English demo overclaims, optional grounded extracted claims |
| R-04 | Synthetic advertising-permit comparison, including required/missing/conflicting permits |
| R-05 | Declared/extracted or reviewer-confirmed evidence identity comparison; limited declared standards check |

The adapter in `backend/app/registry.py` is the only registry boundary and reads local fixtures. It does not query Thai FDA or scrape marketplaces. The dataset contains 18 synthetic registry records and 40 listing scenarios; `scripts/generate_demo_dataset.py` reproduces the demo data. Scenario coverage is not real-world regulatory validation.

- **APPROVED:** all required applicable checks pass with confidence at least 0.75 and no unresolved review/evidence conflict. Connected badges also require current, completed, document-backed approval and valid audit history.
- **PENDING:** evidence, correction or reviewer resolution is outstanding. An active-record identity mismatch requests evidence first.
- **DENIED:** a conclusive failure such as an inactive/revoked fixture, category/claim failure, or an explicit reviewer denial supported by available checks. A secondary failure may be recorded while another blocker keeps the overall case pending.
- **UNKNOWN:** missing/inconclusive reference, unsupported source/category, outage or unavailable document assessment. It does not mean authoritative nonexistence and never earns a badge.

Workflow stages are separate from statuses: `WAITING_DOCUMENTS`, `AI_CHECKING`, `REVIEWER_REQUIRED`, `IN_REVIEW`, `SELLER_ACTION`, `COMPLETED`, `UNAVAILABLE`, and `SUPERSEDED`. Waiting for seller input is not the same as a completed human-review decision. Low-confidence assessment cannot grant approval. Risk scoring in legacy diagnostics ranks work only; it does not change a status.

Product images must be valid PNG/JPEG/WebP data URLs, at most 2 MiB and 16 million pixels each. Remote image URLs, SVG, MIME mismatches and invalid bytes are rejected. Uploaded private documents accept PNG/JPEG/WebP or readable, unencrypted PDF with 1–10 pages, up to 2 MiB each. These validation checks do not prove authenticity. Connected document revisions preserve the original bytes privately; legacy evidence APIs store hashes and declarations instead.

### Live OpenAI and synthetic replay

`backend/app/document_assessment.py` uses the OpenAI Responses API for extraction/readability/completeness findings. Live calls require explicit transfer approval and both `OPENAI_API_KEY` and `TRUSTCART_AI_TRANSFER_APPROVED=true` in the environment. Optional `OPENAI_DOCUMENT_MODEL` selects the document model; `OPENAI_MODEL` selects the separate listing-claim model. Both default to `gpt-4o-mini` in code.

The document request can transfer the listing and uploaded document content. Text-PDF quotations are checked against extracted page text. Image-only/scanned content, low confidence, inconsistent findings, missing quotations and non-supplement categories require human confirmation. A live document error or missing configuration produces `UNKNOWN`/`UNAVAILABLE`; it never silently switches to replay.

Replay makes no OpenAI document call and accepts only the exact bundled listing and matching label/certificate/permit hashes for three synthetic cases: clean, uncertain and overclaim. It is labeled in Seller Centre. Neither replay nor live extraction authenticates documents.

`backend/app/llm.py` separately extracts literal listing claims and drops phrases absent from the listing. Without configuration, or on handled extraction errors, it returns no extracted claims and deterministic advertising checks continue. This differs from the document-assessment failure path. Neither model can set a verification status.

## API map

Current frontend scripts use the connected workflow. Legacy diagnostics share the rule engine but have separate verification records; their approvals do not bypass connected badge eligibility.

| Area | Endpoints |
| --- | --- |
| Demo role sessions | `POST /v1/auth/login`, `GET /v1/auth/me`, `POST /v1/auth/logout` |
| Public catalog | `GET /v1/catalog/products` |
| Shop products | `GET/POST /v1/seller/products`, `GET/PUT /v1/seller/products/{id}` |
| Demo plan | `GET /v1/seller/subscription`, `POST /v1/seller/subscription/activate` |
| Seller submissions/history | `POST /v1/seller/products/{id}/submissions`, `GET /v1/seller/products/{id}/history`, `GET /v1/seller/submissions/{id}` |
| Documents and assessment | `POST /v1/seller/submissions/{id}/documents`, `POST /v1/seller/submissions/{id}/run`, `GET /v1/documents/{id}` |
| Synthetic examples | `GET /v1/seller/demo-cases`, `GET /v1/seller/demo-cases/{case}/{kind}` |
| Agency | `GET /v1/reviewer/queue`, `GET /v1/reviewer/shops`, `GET /v1/reviewer/submissions`, `GET /v1/reviewer/submissions/{id}` |
| Agency actions/history | `POST /v1/reviewer/submissions/{id}/start-review`, `POST /v1/reviewer/submissions/{id}/decision`, `GET /v1/reviewer/submissions/{id}/history` |
| Legacy reviewer diagnostics | `/v1/verifications`, `/v1/products`, evidence/recheck/review endpoints, `/v1/review-queue`, `/v1/reports/{id}`, `/v1/widgets/{id}`, `/v1/audit/{id}`, `/v1/products/compare`, `/v1/agency/summary`, `/v1/listings/suggest-copy` |
| Hosting wrapper only | `/workspace`, `/version`, `/v1/demo/scenarios`, `/v1/demo/example`, `/v1/demo/transactions`, `/demo/tamper/{id}` |

Use reviewer-authorized `/docs` for current request schemas. Private writes need session cookies and CSRF headers. `409` means a stale version/hash, invalid audit, superseded submission or incompatible workflow stage: reload the current record before acting. Older Swagger examples that assume anonymous API access or Basic-only authorization do not describe the current guard.

The legacy `/workspace` retains the L1 evidence/recheck/reviewer loop, outage simulation, audit validation and tamper-on-a-copy demonstration. Its risk-ranked queue and `/v1/agency/summary` are diagnostic tools, distinct from the current Agency queue over shop-owned submissions.

## Validation

```sh
.venv/bin/python -m pytest -q
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

Playwright uses the connected application on port 8768, a temporary SQLite database, real demo role sessions and desktop/mobile Chromium viewports. It disables external database and live AI configuration. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed Chromium executable. Tests do not establish live Supabase connectivity, live OpenAI correctness, official registry accuracy, or performance on physical phones.

**Latest local validation, 21 November 2026:**

| Check | Result |
| --- | --- |
| `/tmp/trustcart-readme-audit-venv/bin/python -m pytest -q` — isolated Python 3.13 environment installed from `requirements.txt` | 174 passed; one Starlette/httpx deprecation warning |
| `npm ci` then `npm test` | 131 passed |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… npm run test:browser` — existing local Chromium | 44 passed (desktop/mobile Chromium) |

The pre-existing Python 3.15 `.venv` run had 171 passes and two import failures because `psycopg` was absent; installing the pinned binary extra on that interpreter failed dependency resolution. The successful Python 3.13 run uses the declared dependencies without modifying `.venv` or loosening requirements.

The initial audit's two browser failures were the desktop/mobile variants of **missing and failed product images display the supplement placeholder**. The test waited for an error fallback before bringing a lazy-loaded catalog image into view. The corrected test scrolls the image into view, observes a controlled HTTP 404, and verifies that the fallback image actually loads on cards and in the gallery. Both targeted variants pass without changing application image behavior. Generated browser results and failure traces are kept under ignored `test-results/` directories.

API tests isolate external configuration; most legacy policy tests replace the auth guard to test rules independently, while `test_connected_*` tests exercise real sessions/ownership/CSRF. PostgreSQL adapter tests use a fake driver; no live PostgreSQL/Supabase or OpenAI request was made for this audit. `.github/workflows/pytest.yml` defines Python 3.9 backend, Node component, and Chromium browser CI; this README does not assert the latest remote CI/deployment result.

Hosted tests can be pointed at `TRUSTCART_BASE_URL` only for an explicitly authorized disposable environment: they create persistent products and sessions. Deployment verification remains separate from a local pass. See [tests/README.md](tests/README.md) for additional test notes.

## Product limits and next steps

The implemented demo is auditable workflow software, not an official certification service. Remaining work includes authorized live registry/permit data, an expert-reviewed and versioned regulatory rule pack, document/COA authenticity, MoPH 448 ingredient ceilings, production identity/OAuth and permissions, payment processing, marketplace feeds, and calibrated risk/performance evaluation. Hosted database and AI configuration require separate verification. No live connectivity is implied by the presence of adapters.

The proposed commercial models are B2B verification API usage and a hosted review workflow. Willingness to pay, ROI, market access and customer conversion remain unvalidated. A useful pilot would measure reviewer time, evidence follow-ups, critical-issue recall, false approvals and audit completeness with authorized sources and real operations teams. Supplement retail sales are not the software addressable market.

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

**Open-source libraries:** Python dependencies include FastAPI, Uvicorn, Pydantic, httpx, python-multipart, Pillow, psycopg, pypdf and pytest; see `requirements.txt`. Frontend test dependencies are jsdom and Playwright; see `package.json`.

## How we used Codex

- **`AGENTS.md` first.** It gives Codex the stack, run and test commands, eight safety rules, and the status policy, so every task starts from the same constraints.
- **One task per rule, endpoint, or component, with the test written first.** Codex implements the task against a named acceptance test.
- **Visible log.** Commits made through Codex carry the `[codex]` tag. Inspect current Codex task history with git log --oneline --grep="[codex]" --fixed-strings.
- **Human review.** Team members review every diff that touches rules, safety, or data handling.
- **Validation.** Run the Python, DOM and Playwright commands below. Browser tests use real role sessions, temporary SQLite data and password-free demo role selection; they never call live OpenAI.

## Background references

- [Thai FDA — misleading health-product advertising and complaints (27 January 2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3428)
- [Thai FDA Journal — survey of unlawful online health-product advertisements (2024)](https://he01.tci-thaijo.org/index.php/fdajournal/article/view/273126)
- [Thai FDA — platform screening and enforcement update (2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3498)
- [Thai FDA Food Division — advertising criteria (2026)](https://food.fda.moph.go.th/food-law/announ-fda-ads69)
- [Product brief](PRODUCT.md) · [Implementation details](IMPLEMENTATION.md) · [Demo guide](DEMO.md) · [Developer/agent instructions](AGENTS.md)
