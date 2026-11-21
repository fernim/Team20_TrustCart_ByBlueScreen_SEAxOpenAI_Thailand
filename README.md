# TrustCart Baseline Lead

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart gives marketplaces a pre-publication verification API for health-product listings. A marketplace submits a listing and receives a status, a reason, an audit trace, and a URL for retrieving the decision. The baseline runs end to end with a synthetic registry and a local SQLite database. Its approvals apply only to synthetic fixtures.

## Run locally

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000
```

On macOS/Linux, use `.venv/bin/python` in place of `.venv/Scripts/python`.

Open `http://127.0.0.1:8000/` for the storefront UI prototype, or `http://127.0.0.1:8000/docs` for the interactive API contract. In another PowerShell terminal, submit the sample marketplace listing and retrieve the stored result.

```powershell
$listing = @{
    registration_reference = 'DEMO-001'
    product_name = 'Vitamin C Supplement'
    license_holder = 'LumaVale'
    category = 'supplement'
} | ConvertTo-Json

$submission = Invoke-WebRequest -Method Post `
    -Uri 'http://127.0.0.1:8000/v1/verifications' `
    -ContentType 'application/json' -Body $listing

Invoke-RestMethod -Uri ('http://127.0.0.1:8000' + $submission.Headers.Location)
```

| Status | Meaning in the baseline |
| --- | --- |
| `APPROVED` | The synthetic fixture is active and its product, licence holder, and category match. |
| `DENIED` | An identity/category check failed, or R-03 detected an overclaim in the supplied title/description. |
| `UNKNOWN` | The reference is missing, the category is unmapped, or the registry is unavailable. The response flags the case for human review. |

The API covers R-01 registration identity, the registry category match from R-02, and a limited R-03 overclaim check when title/description text is supplied. Each decision step contributes to the SHA-256 trace. SQLite preserves results across app restarts. Confidence is `1.0` for a conclusive fixture check and `0.0` when the result is unknown.

## Marketplace service roadmap

An authorized registry connector, marketplace authentication, a complete regulatory claims rule pack, evidence checks, and an authorized reviewer workflow are future integration work. The public source repository and any future hosted API are separate deliverables.

## Storefront UI prototype

The homepage recreates the visual structure of [Shopee Thailand](https://shopee.co.th/): orange search header, promotional banners, seven service shortcuts, a two-row category grid, flash deals, product cards, and footer. FastAPI serves the HTML, CSS, vanilla JavaScript, and local images without a frontend build step.

- Search in Thai or English, filter by category, sort by price, and load more demo products.
- Switch Thai/English navigation and catalog text. Reference banner artwork retains its original Thai text.
- Cycle banners, save a sample voucher, open product details, choose quantities, and add/remove items in a demo cart. The cart and voucher reset on page reload.
- Utility links explain prototype limitations. Accounts, authenticated seller portals, payment, checkout, shipping, and social connections are not implemented. The local seller demo is available at `/seller`.

The 27 catalog entries use reference photographs and illustrative prices, sales counts and offers. Real supplement reference names/photos (DHC, NeoCell and Deva C) do not inherit approval from the synthetic registry fixture. Saved seller products can receive a blue checkmark only when their backend result qualifies. Customers can click a blue “ตรวจทะเบียนแล้ว” / “Registration checked” badge only when the product passes verification. Non-passing listings remain normal product cards with no status badge. The popup shows only the short status and the synthetic-data label; detailed reasons and traces remain in the reviewer view. Unknown or failed requests never produce a verified badge. The separate `/reviewer` page loads a stored report by its ID and displays status, reason, confidence, human-review routing, registry source, timestamped trace entries, and expandable previous/current hashes plus the final chain hash. A selector lists reports from the current browser session. Clicking a customer status badge also points the Reviewer link at that product’s report; the lookup also accepts an ID from the API. The view displays recorded hashes without independently validating their integrity. This read-only local reviewer demo has no authentication or authorization; it must not be treated as a protected reviewer portal. The registration check does not establish authenticity or verify a seller account. Denied, unknown, pending, low-confidence and failed-request products have no status badge. It is an independent TrustCart demo, not an official Shopee website. Reference images are stored locally with provenance in `frontend/assets/sources.json`; imagery and marks remain owned by their respective owners.

Three overclaim fixtures use the matching NeoCell, Deva C and DHC reference photos with deliberately unsupported test copy. Their descriptions identify the text as example copy requiring correction; it is not quoted from the photographed manufacturers or source sellers. A limited deterministic R-03 policy detects fixed-time appearance promises, instant-effect promises, and universal result guarantees in Thai and English. The three listings are submitted to the existing API and receive `DENIED` with `advertising_overclaim`; exact matched phrases, their title/description source, and bilingual reasons are persisted in `claim_findings` and the hash-chained trace. They use the existing synthetic reference as a borrowed-reference scenario; no new registration record is invented. R-03 rejection does not establish their identity. Samples are deterministic for repeatable demos and tests.

### R-03 scope

`POST /v1/verifications` accepts optional `title` (up to 1,000 characters) and `description` (up to 6,000 characters). Omitting them preserves baseline behavior. Matching phrases are detected by the demo patterns in `backend/app/claims.py`, not by the LLM or a frontend status flag. Registry outage, missing reference, or unmapped category still returns `UNKNOWN` and human review before a conclusive claim verdict. Corrected text is checked anew; it can pass only if identity and category also match. Existing stored reports remain readable.

This is a narrow demo policy, not a comprehensive Thai FDA compliance engine. It does not assess arbitrary paraphrases, substantiation, legal exceptions, disease claims, or the required supplement label. Quoted examples are still scanned as listing text. A successful result is limited to the implemented checks.

## Tests

`tests/test_claims_unit.py` adds offline R-03 scanner regression coverage for literal text/source preservation, case and whitespace variations, Thai numerals, repeated occurrences, and ordinary copy without findings. Run it directly with `.venv/bin/python -m pytest -q tests/test_claims_unit.py` on macOS/Linux.

```powershell
.venv/Scripts/python -m pytest -q
```

Frontend component tests require Node.js 18+ and npm (development only):

```bash
npm ci
npm test
```

The DOM tests cover search and empty states, combined filters, sorting, pagination, banners, coupons, countdown expiry, product details, cart validation/totals/removal, utility dialogs, and language switching. Python tests cover page/static serving alongside the baseline API. Desktop and mobile visual behavior should also be checked in a browser after UI changes.

## Reviewer design

The orange-and-white reviewer workspace shares the storefront design system documented in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). A responsive four-stage stepper explains R-01 identity, R-02 category, R-03 advertising and final confirmation. It shows every recorded failure and concrete fixes; missing steps are never shown as passed. The backend may evaluate several rules even when an earlier rule fails. The stepper summarizes those results rather than creating a new workflow or publishing products.

Two normal, unverified reference listings now use short title excerpts from Shopee (Neocell Super Collagen + C and Deva C Vitamin C). Their descriptions are explicitly labeled summaries of visible pack-size information, because full seller descriptions could not be retrieved. Source links are available in product details. They carry no verified badge. Three additional, explicitly labeled copy-correction examples reuse matching market photos with test overclaims; those phrases are not attributed to the source sellers.

## Seller workspace

Open `/seller` from the view navigation or Seller Centre. The Shopee-style workspace provides product title, description, category, registration reference, registered product name and licence-holder fields. Save an unverified local draft, or submit to the existing verification API. The full submitted listing is saved with its verification in SQLite, so selecting a current-session report restores its original fields. Legacy reports without snapshots require the seller to enter missing fields again.

The seller product list shares current-session report IDs with the reviewer page. Seller and reviewer use the same progress renderer; sellers see status, rule progress and corrective reasons, while raw audit entries and hashes appear only in the reviewer view. Editing a field clears the displayed result and requires a fresh check. Corrections create a new report and preserve previous results. Network failures never display approval. Drafts use browser local storage; the recent report list is session-local. This is a local prototype without seller authentication, marketplace publication, or uploads. The supplied Shopee URL is the public storefront; this is a styled recreation rather than a verified copy of the authenticated Seller Centre.

## Product-facing presentation

Customer, seller and reviewer screens use normal product-facing wording without simulation or fictional-brand labels. The sample registry holder is now `LumaVale`; its reference remains `DEMO-001`. This copy cleanup does not add real-registry access, accounts, checkout, publication or official Shopee affiliation. Backend `registry_source` metadata remains truthful and existing audit records are preserved. Catalog fixtures and unsupported claim examples remain test data even though those remarks are no longer displayed in product copy.

## Seller products in the customer catalog

Seller submissions now create persistent product records through `POST /v1/products`. Editing a selected product uses `PUT /v1/products/{id}` with `expected_version`; stale edits return 409 rather than overwriting newer data. Product content and its new verification are committed together in SQLite. Every revision keeps its immutable verification report and a traced product ID/version. `GET /v1/products` and `GET /v1/products/{id}` return the current product snapshot and latest verification, with caching disabled.

Customers see saved seller products ahead of the example catalog. The catalog refreshes on load, focus, visibility restoration, cross-tab update notifications, and every five seconds while visible. Only APPROVED results with confidence at least 0.75, no human-review requirement and an audit hash receive a clickable badge. Denied/unconfirmed listings are normal cards. Refresh failures remove seller-product badges until a fresh result is available. Edits update the same product card; drafts remain private to the browser until submitted. Prices are required for all new and edited product API requests. Legacy records without prices remain editable by sellers but are excluded from the customer catalog until priced. Shop recommendation labels are omitted because no shop-level recommendation data exists.

Seller product records survive restarts and are reloaded from the database, while prior verification reports remain accessible in Reviewer. This remains a local, unauthenticated workspace; tenant ownership and production access control have not been implemented.


The seller list displays each saved product’s image, price, stock and verification status with separate **Edit** and **View product** actions. It refreshes saved summaries on focus without replacing unsaved form edits. Missing images use a neutral placeholder; prices and stock are never invented for older records. Market image provenance is recorded in `frontend/assets/sources.json`; these photos are reference artwork, not product certification.
