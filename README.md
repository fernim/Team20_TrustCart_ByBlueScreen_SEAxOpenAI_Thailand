# TrustCart

**Verify the listing. Trace the evidence. Escalate uncertainty.**

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart is an API-first, human-governed verification workflow for health-product listings. Marketplaces and seller operations can check product identity, advertising claims, and supporting evidence before publication. A marketplace submits a listing and receives a status, a reason, an audit trace, and a URL for retrieving the decision. The baseline runs end to end with a synthetic registry and a local SQLite database. Its approvals apply only to synthetic fixtures.

> **All data is synthetic.** TrustCart does not connect to the Thai FDA registry or any marketplace. It is not affiliated with Shopee or Thai FDA, and its results are decision support. They are not certification, legal advice, or medical advice.

## Problem

A real 13-digit Thai FDA registration number does not prove that the listed product holds it. Shoppers cannot tell whether the number on a health-product listing belongs to that product. Listings also claim to treat, prevent, or reverse disease. Enforcement happens after publication: Thai FDA reports 121,494 illegal health-product ads closed between 2023 and April 2026. Sources are listed in the pitch deck. Small sellers usually learn the rules when a listing is taken down.

## Solution

TrustCart checks a listing **before publication** through an API. The design rule is *AI extracts and suggests, deterministic rules decide, humans govern*:

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
| Password-protected web demo and interactive API docs | `app.py`, `demo.html`, `vercel.json` |
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
- **Test results.** Local validation passes 137 Python tests, 114 Node component tests, and 32 desktop/mobile browser tests. Shared PostgreSQL connectivity still requires hosted verification.

## Run locally

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API contract. In another PowerShell terminal, submit the sample marketplace listing and retrieve the stored result.

```powershell
$listing = @{
    registration_reference = 'DEMO-001'
    product_name = 'Demo Supplement'
    license_holder = 'Demo Brand'
    category = 'supplement'
} | ConvertTo-Json

$submission = Invoke-WebRequest -Method Post `
    -Uri 'http://127.0.0.1:8000/v1/verifications' `
    -ContentType 'application/json' -Body $listing

Invoke-RestMethod -Uri ('http://127.0.0.1:8000' + $submission.Headers.Location)
```

| Status | Meaning in the synthetic demo |
| --- | --- |
| `APPROVED` | The applicable synthetic checks pass, confidence is at least 0.75, and no conflict requires review. |
| `PENDING` | Evidence or reviewer action is required, including unresolved identity or permit conflicts. |
| `DENIED` | A conclusive check failed or a reviewer confirmed denial. |
| `UNKNOWN` | The reference is missing, the category is unmapped, or the registry is unavailable. The response flags the case for human review. |

The API checks registration identity, registered category, advertising claims, submitted permits, and declared seller evidence when applicable. Each decision step contributes to the SHA-256 trace. Local SQLite preserves results across app restarts.

## Marketplace service roadmap

An authorized live registry connector, durable hosted storage, and marketplace OAuth authentication remain integration work. Claims, evidence, rechecks, review, reports, and audit verification are implemented in the synthetic demo. The public source repository and any future hosted API are separate deliverables.

## Tests

```powershell
.venv/Scripts/python -m pytest -q
```

## Web demo and API documentation

The [hosted demo](https://trustcart-bluescreen-demo.vercel.app) includes 20 synthetic marketplace transactions, status filters, decision reports, and a sample verification request.

Open the [interactive API documentation](https://trustcart-bluescreen-demo.vercel.app/docs) to authorize with HTTP Basic authentication, inspect request examples, and try the endpoints. Use username `demo` and the shared password supplied separately.

To run the web app locally, set `TRUSTCART_DEMO_PASSWORD` in the process environment, then run:

The 27 catalog entries use reference photographs and illustrative prices, sales counts and offers. Real supplement reference names/photos (DHC, NeoCell and Deva C) do not inherit approval from the synthetic registry fixture. Saved seller products can receive a blue checkmark only when their backend result qualifies. Customers can click a blue “ตรวจทะเบียนแล้ว” / “Registration checked” badge only when the product passes verification. Non-passing listings remain normal product cards with no status badge. The popup shows only the short status and the synthetic-data label; detailed reasons and traces remain in the reviewer view. Unknown or failed requests never produce a verified badge. The separate `/reviewer` page loads a stored report by its ID and displays status, reason, confidence, human-review routing, registry source, timestamped trace entries, and expandable previous/current hashes plus the final chain hash. A selector lists reports from the current browser session. Clicking a customer status badge also points the Reviewer link at that product’s report; the lookup also accepts an ID from the API. The view displays recorded hashes without independently validating their integrity. This read-only local reviewer demo has no authentication or authorization; it must not be treated as a protected reviewer portal. The registration check does not establish authenticity or verify a seller account. Denied, unknown, pending, low-confidence and failed-request products have no status badge. It is an independent TrustCart demo, not an official Shopee website. Reference images are stored locally with provenance in `frontend/assets/sources.json`; imagery and marks remain owned by their respective owners.

Three overclaim fixtures use the matching NeoCell, Deva C and DHC reference photos with deliberately unsupported test copy. Their descriptions identify the text as example copy requiring correction; it is not quoted from the photographed manufacturers or source sellers. A limited deterministic R-03 policy detects fixed-time appearance promises, instant-effect promises, and universal result guarantees in Thai and English. The three listings are submitted to the existing API and receive `DENIED` with `advertising_overclaim`; exact matched phrases, their title/description source, and bilingual reasons are persisted in `claim_findings` and the hash-chained trace. They use the existing synthetic reference as a borrowed-reference scenario; no new registration record is invented. R-03 rejection does not establish their identity. Samples are deterministic for repeatable demos and tests.

```powershell
.venv/Scripts/python -m uvicorn app:app --port 8000
```

The password gate covers the dashboard, API, and documentation. Access fails closed if the environment variable is missing. Vercel uses the root `app.py` entrypoint and the configuration in `vercel.json`.

Hosted SQLite storage is temporary. Saved verification results can disappear after a function restart or be unavailable on another instance. Local SQLite preserves evidence hashes, listing snapshots, reviews, and audit history across app restarts. The [shared storage settings](#shared-production-storage) describe the PostgreSQL option.

The hosted entry point rejects browser writes from a different origin when the browser reports the request's origin. Direct API clients may authenticate with HTTP Basic. To restrict the reviewer queue, review decisions, and agency summary, configure `TRUSTCART_REVIEWER_PASSWORD` with a distinct secret and use username `reviewer` for those operations. A `demo` login then receives `403` on those endpoints. Open a separate browser profile and sign in as `reviewer` to run the full judge workflow in one session. Without this setting the shared demo login can operate the full workflow. Individual identities, per-record and tenant access controls, and marketplace OAuth remain production work.

Databases from the earlier feature branch are upgraded at startup. Existing listing snapshots and evidence hashes are imported into the current schema, and previous audit entries remain readable. If a saved listing only has the previous permit-conflict flag, mutations return `409`. Submit a new verification with the permit number to run the current comparison.

The dashboard evaluates 20 synthetic records. Seller, Shopper, and Reviewer workspaces support submission, evidence upload, recheck, risk ordering, reviewer decisions, reports, badges, and audit checks. Mutations use the current chain hash and reject stale or tampered cases. Demo reset clears the form while retaining saved history.

## Complete L1 demo

1. Open Seller and select L1. Submit the listing to receive PENDING.
2. Use the synthetic sample files to upload label and certificate evidence. The conflicting fields keep the result PENDING at confidence 0.60.
3. Recheck the case and open Reviewer. Refresh the queue, enter a reason, and deny the selected case.
4. Verify the saved audit. Run the tamper simulation to show a broken chain on a copy, then verify the saved audit again.
5. Submit a new case to restart. Select simulated registry outage to see zero approvals across the 20 records.

## API workflow

FastAPI registers six routers from `backend/app/api/`. The local API entry point is `backend.app.main:app`. Use `app:app` for the password-protected demo and its access checks.

| Router | API area |
| --- | --- |
| `verifications.py` | Listing submission and retrieval |
| `products.py` | Versioned product creation, updates, and retrieval |
| `seller.py` | Evidence, rechecks, and copy suggestions |
| `reviewer.py` | Review queue and decisions |
| `reports.py` | Reports, badges, comparison, and audit checks |
| `agency.py` | Aggregate verification metrics |

### Try the L1 workflow in Swagger

1. Sign in and open `/docs`. Run `GET /v1/demo/scenarios` and copy the `L1` object into `POST /v1/verifications`. The API returns `201` with an ID, a `Location` header, and a `PENDING` result.
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

Once a reviewer has recorded a decision, seller evidence uploads and rechecks on that verification return `409`. Submit a fresh verification for updated evidence or an edited listing. A reviewer may record a new decision using the latest audit hash.

Evidence uploads accept an optional comma-separated `standards` declaration. ISO 9001 alone cannot satisfy R-05; ISO 22000 or GMP can satisfy the standards comparison when identity checks also pass. This compares declarations, not certificate authenticity. A file digest already stored for another verification adds a `duplicate_evidence` trace event and requires human review at confidence 0.60; rechecks retain unresolved duplicate warnings.

If a stored audit chain fails validation, the shopper widget returns `UNKNOWN`. The report retains the recorded status alongside the failed audit result for investigation.

## Run locally on macOS or Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
```

This local development entry point is unprotected. Use `app:app` with a privately configured `TRUSTCART_DEMO_PASSWORD` for the password-gated demo; use the generated `/docs` for current request schemas. `/version` is the intentional public GET exception.

## Optional AI extraction

The extraction client uses OpenAI structured output and drops every phrase absent from the listing. Deterministic rules evaluate the extracted phrases. Without configuration, keyword rules run locally.

Explicit human approval is required before sending listing text to OpenAI. After obtaining approval, configure the process environment with OPENAI_API_KEY and TRUSTCART_AI_TRANSFER_APPROVED=true. OPENAI_MODEL is optional. The deployed demo currently uses local deterministic screening. Tests use fake clients and never call OpenAI.

Validation: 137 Python tests, 114 Node component tests, and 32 desktop/mobile browser tests pass locally, including the documented OpenAPI workflow, grounded extraction, the L1 loop, evidence validation, dataset invariants, agency aggregation, and audit checks. Risk weights are illustrative and need calibration. Reviewer access, completed-review protection, cross-origin write rejection, and audit simulation are covered; see [API judge Q&A](docs/JUDGE_QA.md).

## Dataset and release update

The deterministic generator at scripts/generate_demo_dataset.py produces 18 fictional DEMO registry references, 40 tagged listings, and 16 evidence-case definitions. The evidence definitions include unsupported COA cases explicitly marked as roadmap. Existing DEMO aliases remain compatible. No official registration numbers are generated. Submitted numeric references must match the expected grouped format; malformed or unsupported references return UNKNOWN.

Expired or revoked fixtures are denied. Permit conflicts and required missing permits remain PENDING. Unsupported registries return UNKNOWN. Drug-category and prohibited supplement claims are screened by the synthetic rule pack. All 40 listings have explicit expected status and rule failures, and every outage variant remains UNKNOWN.

GET /v1/agency/summary aggregates saved synthetic verifications by status, failing rule, category, day, claim phrase and audit validity. The Agency view exposes those totals without seller identity fields.

The release retains the existing router split, SQLite evidence migration compatibility, evidence-backed rechecks, ThomazAgents.md, and competition declarations. Python 3.9 pytest CI runs on pull requests and pushes to main with read-only repository permissions and no live credentials. Live AI, official registry integration, document authenticity/COA validation and marketplace OAuth remain integration work.

Two normal, unverified reference listings now use short title excerpts from Shopee (Neocell Super Collagen + C and Deva C Vitamin C). Their descriptions are explicitly labeled summaries of visible pack-size information, because full seller descriptions could not be retrieved. Source links are available in product details. They carry no verified badge. Three additional, explicitly labeled copy-correction examples reuse matching market photos with test overclaims; those phrases are not attributed to the source sellers.

## Frontend integration

The fe branch is integrated with the released main API. The root route serves the TrustCart marketplace, /seller manages versioned product listings, and /reviewer reads verification reports. /workspace retains evidence upload, rechecks, reviewer decisions, outage and tamper controls, and agency aggregation. /docs remains available behind the same password gate.

Open **Evidence and review** on a saved product to load its current verification in `/workspace`. The workspace can also open a product from its saved-product list. Listing edits retain the product's price, stock, and images and create a new verification revision. Evidence, rechecks, and reviewer decisions update that verification, so the marketplace displays the current badge when it refreshes. Each workspace case links back to its marketplace product.

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

PostgreSQL mutations lock the selected verification or product row before validating its revision. Evidence hashes, review history and product versions remain in the same transaction as the updated decision. A configured but unavailable database fails the request instead of falling back to temporary local data.

Without this variable, the app uses its existing SQLite database. Local SQLite records and schema migrations remain supported. Moving to PostgreSQL starts a shared database; existing instance-local Vercel records are not automatically imported.

Customers see saved seller products ahead of the example catalog. The catalog refreshes on load, focus, visibility restoration, cross-tab update notifications, and every five seconds while visible. Only APPROVED results with confidence at least 0.75, no human-review requirement and an audit hash receive a clickable badge. Denied/unconfirmed listings are normal cards. Refresh failures remove seller-product badges until a fresh result is available. Edits update the same product card; drafts remain private to the browser until submitted. Prices are required for all new and edited product API requests. Legacy records without prices remain editable by sellers but are excluded from the customer catalog until priced. Shop recommendation labels are omitted because no shop-level recommendation data exists.

Seller product records survive restarts and are reloaded from the database, while prior verification reports remain accessible in Reviewer. The deployed workspace uses the shared demo password gate; per-seller tenant ownership remains unimplemented.


The seller list displays each saved product’s image, price, stock and verification status with separate **Edit** and **View product** actions. It refreshes saved summaries on focus without replacing unsaved form edits. Missing images use a neutral placeholder; prices and stock are never invented for older records. Market image provenance is recorded in `frontend/assets/sources.json`; these photos are reference artwork, not product certification.

Hosted browser tests reproduce missing products and reports when Vercel requests reach different temporary SQLite instances. The PostgreSQL adapter requires the team's connection configuration and hosted verification before this persistence issue can be marked resolved. Unit tests isolate external database and AI configuration.

Latest local validation: 137 Python tests, 114 Node component tests, and 32 desktop/mobile browser tests passed with `.venv/Scripts/python -m pytest -q`, `npm test`, and `npm run test:browser`. These checks use isolated SQLite data, synthetic fixtures, and a fake PostgreSQL client; no live services were used. The historical hosted desktop/mobile run against the SQLite deployment passed 16 checks and failed 4 saved-product continuity checks. Hosted retesting remains the Vercel team member's task and was not rerun for this gap review. GitHub CI runs both the API and frontend suites.

The reviewer product list shows saved images, prices, stock and latest verification statuses. Open report loads the corresponding detailed audit while historical reports remain accessible. Product details have direct `/products/{id}` URLs.

The shared visual theme remains Shopee-style after backend merges: orange tokens, compact corners, campaign imagery and consistent seller/reviewer controls. Evidence workspace and API links remain available.

## Background references

- [Thai FDA — misleading health-product advertising and complaints (27 January 2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3428)
- [Thai FDA Journal — survey of unlawful online health-product advertisements (2024)](https://he01.tci-thaijo.org/index.php/fdajournal/article/view/273126)
- [Thai FDA — platform screening and enforcement update (2026)](https://dis.fda.moph.go.th/detail-newsUpdate?id=3498)
- [Thai FDA Food Division — advertising criteria (2026)](https://food.fda.moph.go.th/food-law/announ-fda-ads69)
- [Product brief](PRODUCT.md) · [Implementation details](IMPLEMENTATION.md) · [Demo guide](DEMO.md) · [Developer/agent instructions](AGENTS.md)
