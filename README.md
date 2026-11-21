# TrustCart Baseline Lead

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart gives marketplaces a pre-publication verification API for health-product listings. A marketplace submits a listing and receives a status, a reason, an audit trace, and a URL for retrieving the decision. The baseline runs end to end with a synthetic registry and a local SQLite database. Its approvals apply only to synthetic fixtures.

> **All data is synthetic.** TrustCart does not connect to the Thai FDA registry or any marketplace. It is not affiliated with Shopee or Thai FDA, and its results are decision support. They are not certification, legal advice, or medical advice.

## Problem

A real 13-digit Thai FDA registration number does not prove that the listed product holds it. Shoppers cannot tell whether the number on a health-product listing belongs to that product. Listings also claim to treat, prevent, or reverse disease. Enforcement happens after publication: Thai FDA reports 121,494 illegal health-product ads closed between 2023 and April 2026. Sources are listed in the pitch deck. Small sellers usually learn the rules when a listing is taken down.

## Solution

TrustCart checks a listing **before publication** through an API. The design rule is *AI extracts and suggests, deterministic rules decide, humans govern*:

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
- **Test results.** `pytest` passes 105 tests for the demo workflow, API compatibility, dataset invariants, and agency aggregation.

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

```powershell
.venv/Scripts/python -m uvicorn app:app --port 8000
```

The password gate covers the dashboard, API, and documentation. Access fails closed if the environment variable is missing. Vercel uses the root `app.py` entrypoint and the configuration in `vercel.json`.

Hosted SQLite storage is temporary. Saved verification results can disappear after a function restart or be unavailable on another instance. Local SQLite preserves evidence hashes, listing snapshots, reviews, and audit history across app restarts. All demo roles share the password gate. Marketplace OAuth and separate reviewer identities remain roadmap work.

Databases from the earlier feature branch are upgraded at startup. Existing listing snapshots and evidence hashes are imported into the current schema, and previous audit entries remain readable. If a saved listing only has the previous permit-conflict flag, mutations return `409`. Submit a new verification with the permit number to run the current comparison.

The dashboard evaluates 20 synthetic records. Seller, Shopper, and Reviewer workspaces support submission, evidence upload, recheck, risk ordering, reviewer decisions, reports, badges, and audit checks. Mutations use the current chain hash and reject stale or tampered cases. Demo reset clears the form while retaining saved history.

## Complete L1 demo

1. Open Seller and select L1. Submit the listing to receive PENDING.
2. Use the synthetic sample files to upload label and certificate evidence. The conflicting fields keep the result PENDING at confidence 0.60.
3. Recheck the case and open Reviewer. Refresh the queue, enter a reason, and deny the selected case.
4. Verify the audit. Demonstrate tampering and verify the failed audit. Further changes are blocked on the altered case.
5. Submit a new case to restart. Select simulated registry outage to see zero approvals across the 20 records.

## API workflow

FastAPI registers five routers from `backend/app/api/`. The API entry point is `backend.app.main:app`. The password-protected local demo uses `app:app`.

| Router | API area |
| --- | --- |
| `verifications.py` | Listing submission and retrieval |
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

## Frontend integration

The fe branch is integrated with the released main API. The root route serves the TrustCart marketplace, /seller manages versioned product listings, and /reviewer reads verification reports. /workspace retains evidence upload, rechecks, reviewer decisions, outage and tamper controls, and agency aggregation. /docs remains available behind the same password gate.

Product edits use optimistic version checks and atomically create fresh verification history in SQLite. The current released identity policy, required supplement term, UNKNOWN outage handling, and hash-based reviewer actions remain in effect. Frontend fixtures and tests use the released registry identity. TrustCart styling uses a teal palette, a distinct hero and rounded product cards. Historical reference artwork remains in source provenance; copied promotional sections are hidden from the live interface.

Local checks include pytest, npm test and npm run test:browser. Install Node dependencies with npm ci.

Frontend integration validation: 105 Python tests, 94 Node component tests, and 14 desktop/mobile browser tests passed locally. GitHub CI runs both the API and frontend suites.
