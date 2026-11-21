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
    product_name = 'Demo Supplement'
    license_holder = 'Demo Brand'
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
| `DENIED` | A supported category or registration identity check failed against the fixture. |
| `UNKNOWN` | The reference is missing, the category is unmapped, or the registry is unavailable. The response flags the case for human review. |

The API covers R-01 registration identity and the registry category match from R-02. Each decision step contributes to the SHA-256 trace. SQLite preserves results across app restarts. Confidence is `1.0` for a conclusive fixture check and `0.0` when the result is unknown.

## Marketplace service roadmap

An authorized registry connector, marketplace authentication, claims and evidence checks, and a reviewer workflow are future integration work. The public source repository and any future hosted API are separate deliverables.

## Storefront UI prototype

The homepage recreates the visual structure of [Shopee Thailand](https://shopee.co.th/): orange search header, promotional banners, seven service shortcuts, a two-row category grid, flash deals, product cards, and footer. FastAPI serves the HTML, CSS, vanilla JavaScript, and local images without a frontend build step.

- Search in Thai or English, filter by category, sort by price, and load more demo products.
- Switch Thai/English navigation and catalog text. Reference banner artwork retains its original Thai text.
- Cycle banners, save a sample voucher, open product details, choose quantities, and add/remove items in a demo cart. The cart and voucher reset on page reload.
- Utility links explain prototype limitations. Accounts, seller portals, payment, checkout, shipping, and social connections are not implemented.

All 24 catalog entries, prices, sales counts, and offers are illustrative. The Demo Supplement listing requests a check from the existing verification API. A blue checkmark appears beside that product name only when the backend approves the synthetic identity/category check with confidence at least 0.75 and no human review required. Click the checkmark on the card or in product details to open a verification report with the backend status, confidence, plain-language reason, report ID, and timestamped audit trace. Each trace entry exposes its previous and current hash, followed by the final chain hash. This view displays recorded hashes without independently validating their integrity. Its explanation states the limited scope; it never verifies a seller account. Other statuses and failed requests show no checkmark. It is an independent TrustCart demo, not an official Shopee website. Reference images are stored locally with provenance in `frontend/assets/sources.json`; imagery and marks remain owned by their respective owners.

## Tests

```powershell
.venv/Scripts/python -m pytest -q
```

Frontend component tests require Node.js 18+ and npm (development only):

```bash
npm ci
npm test
```

The DOM tests cover search and empty states, combined filters, sorting, pagination, banners, coupons, countdown expiry, product details, cart validation/totals/removal, utility dialogs, and language switching. Python tests cover page/static serving alongside the baseline API. Desktop and mobile visual behavior should also be checked in a browser after UI changes.
