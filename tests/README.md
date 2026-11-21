# Automated UI checks

## Product media API regression checks

Run `.venv/bin/python -m pytest -q tests/test_product_media.py` on macOS/Linux (use `.venv/Scripts/python` on Windows). These checks cover image/price/stock persistence through edits and restarts, rejection of invalid commerce fields on creation and update, unchanged saved products and prior verification reports after rejected edits, and a successful subsequent edit using the original version.

Use Node.js 18+ and the Python virtual environment described in the root README.

```sh
npm ci
npm test
```

`npm test` runs deterministic DOM interaction tests in jsdom without live services or credentials.

| Component | Automated coverage |
| --- | --- |
| Shopper | Search and empty results; every category and reset; sorting and pagination; language switching; carousel arrows/dots; banners and all shortcuts; vouchers; flash deals/countdown; product details; cart merging, totals, removal, quantity limits and focus; utility dialogs; verification badges and failure states; seller-catalog refresh/deletion and safe text rendering. |
| Seller | Required fields; submission and correction; stable-ID versioned updates; saved-product selection; draft save/restore/storage failures; unsaved-change confirmation; new-product reset; disabled controls during requests; conflict/server/network/malformed-response handling; stale-response suppression; reviewer-only audit details hidden. |
| Reviewer | Manual UUID lookup; query-string and saved-report selection; report details, literal findings, rule stepper and stored audit hashes; invalid input/session data; missing/network/server/malformed/wrong-ID reports; loading state; stale successes and failures. |
| Shared verification view | Confirmation at the 0.75 threshold; blocked confirmation for low confidence, review requirements, unresolved statuses, missing rules or conflicting outcomes; safe evidence/hash text; seller audit suppression. |
| Agency | Marketplace/work/result/search filters, Thai/English persistence, safe rendering, failed refreshes, report drafts, stale actions and historical/audit-invalid read-only cases. |
| Shared page shell | Shared tokens, current-page navigation, and skip links. |

## Real browser checks

```sh
npx playwright install chromium
npm run test:browser
```

Playwright starts FastAPI on port 8768 against a disposable SQLite database. It refuses to reuse an existing server. It runs Chromium at desktop (1440 px) and mobile (390 px) viewport sizes. No marketplace or registry site is contacted; the backend uses its synthetic adapter. A preinstalled Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The browser suite checks shopper search/language/sorting/cart, native dialog opening and Escape/focus restoration, seller creation and correction, persistence after reload, reviewer audit expansion, customer badges, native draft-discard confirmations, cross-page navigation, stylesheet loading, and viewport overflow. These scenarios complement the larger mocked failure-path suite.

The linked marketplace and workspace tests verify edits to a saved product, evidence upload, recheck, reviewer denial, storefront badge refresh, and safe handling of failed lookup and case switching.

Failure traces are retained under `test-results/`; inspect one with `npx playwright show-trace <trace.zip>`. Generated results are ignored by Git.

The reference brand showcase is hidden in the integrated interface. Browser checks verify the visible TrustCart hero and popular-product images, plus navigation and product behavior.

## Hosted desktop and mobile checks

Check `/version` on an authorized disposable Vercel deployment with the current code and shared PostgreSQL. Set `TRUSTCART_BASE_URL` to that origin and run `npm run test:browser` for the passwordless synthetic demo. Leave `TRUSTCART_BASE_URL` unset to use the isolated local suite. Use the Python marketplace-client tests for the separate credential-enabled configuration.

Hosted mode runs the storefront, seller, Agency, workspace and access checks across desktop and mobile Chromium contexts. The suite covers public catalog and private-role access, document submission, reviewer actions, stale hashes, outages, and the public badge. Each created product title is unique so earlier runs do not create ambiguous selectors.

Hosted traces are disabled so they do not capture session cookies or CSRF headers. The suite creates synthetic products and reviews whose saved audit history remains available for inspection.

Shared persistent storage is required for saved-product and report continuity across hosted requests. A disappearing product or report remains a test failure. Temporary instance-local SQLite cannot guarantee those flows on Vercel.

Browser checks use Chromium and a mobile viewport emulator. The registry and assessed evidence are synthetic.

## Agency validation

The Agency implementation was checked locally with `.venv/bin/python -m pytest -q` (143 passed), `npm test` (120 passed), and `npx playwright test --config playwright.connected.config.cjs` (28 passed across desktop/mobile). Test credentials are generated in the process environment. Browser tests cover report deep links through sign-in, stale-hash reloads, original document links/responses, native draft-discard confirmation, approval propagation, seller corrections and existing shopper flows. Headless Chromium does not render the PDF viewer reliably; tests verify the document link opens a new surface and its authenticated response contains a PDF instead of waiting for an HTML DOM event.

Agency screenshots are retained in `artifacts/ui/agency-*.png`. These checks use an isolated SQLite database, synthetic registry and replay fixtures. Live marketplace feeds, real provider calls and hosted PostgreSQL were not exercised.

## Main → fe integration validation

The merged suite retains the connected role-session browser harness. Incoming legacy Seller/Reviewer page scenarios are covered by the connected seller/Agency flows rather than restoring the old unauthenticated pages. New workspace regression cases run in `workspace.spec.cjs` with real reviewer sessions and CSRF tokens, using the hosted entrypoint over disposable SQLite. Live database settings are explicitly cleared in the local browser server.

A mixed-storage regression verifies that legacy diagnostic product listings ignore connected submission-backed records and cannot overwrite them. Current shop-owned products use `/v1/seller/products`, `/v1/catalog/products` and the Agency submission endpoints; the diagnostic `/v1/products` list contains legacy verification-backed products only.

The existing Python 3.15 environment cannot install the pinned psycopg-binary 3.2 wheel. Full merge validation therefore uses an isolated Python 3.13 environment at `/tmp/trustcart-merge-venv`, installed from the unchanged requirements file.

Merge validation passed: `/tmp/trustcart-merge-venv/bin/python -m pytest -q` — 172 tests; `npm test` — 120 tests; `npx playwright test` — 34 desktop/mobile tests. The public storefront remains public, the commit-version GET remains public, and private diagnostic/role endpoints retain their access checks.
