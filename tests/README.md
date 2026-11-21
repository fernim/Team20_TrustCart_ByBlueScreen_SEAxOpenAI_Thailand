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

Set `TRUSTCART_BASE_URL` to the target origin and run `npm run test:browser` with the login password in the process environment. Set `TRUSTCART_REVIEWER_PASSWORD` when the deployment uses the separate reviewer login. Otherwise, set `TRUSTCART_DEMO_PASSWORD` for the shared demo login. Leave `TRUSTCART_BASE_URL` unset to run the isolated local suite. Keep password values out of command output and source files.

Hosted mode runs the storefront suite and additional hosted checks across desktop and mobile Chromium contexts. It covers password protection, evidence/recheck/reviewer actions, stale hashes, agency totals, outage simulation, copy correction and authenticated Swagger. Each created product title is unique so earlier hosted runs do not create ambiguous selectors.

The unauthenticated request context explicitly overrides the configured credentials. Hosted traces are disabled to avoid writing authentication headers into trace artifacts. The suite creates synthetic products and reviews, and leaves the saved audit history available for inspection.

Shared persistent storage is required for saved-product and report continuity across hosted requests. A disappearing product or report remains a test failure. Temporary instance-local SQLite cannot guarantee those flows on Vercel.

These tests cover the implemented UI workflows and, in hosted mode, the demo password gate. They do not establish exhaustive branch coverage, official product certification, live-registry integration, production identity management, real checkout, or full accessibility compliance. Browser checks use Chromium only; mobile viewport emulation is not testing on a physical phone.

## Agency validation

The Agency implementation was checked locally with `.venv/bin/python -m pytest -q` (143 passed), `npm test` (120 passed), and `npx playwright test --config playwright.connected.config.cjs` (28 passed across desktop/mobile). Test credentials are generated in the process environment. Browser tests cover report deep links through sign-in, stale-hash reloads, original document links/responses, native draft-discard confirmation, approval propagation, seller corrections and existing shopper flows. Headless Chromium does not render the PDF viewer reliably; tests verify the document link opens a new surface and its authenticated response contains a PDF instead of waiting for an HTML DOM event.

Agency screenshots are retained in `artifacts/ui/agency-*.png`. These checks use an isolated SQLite database, synthetic registry and replay fixtures. Live marketplace feeds, real provider calls and hosted PostgreSQL were not exercised.

## Main → fe integration validation

The merged suite retains the connected role-session browser harness. Incoming legacy Seller/Reviewer page scenarios are covered by the connected seller/Agency flows rather than restoring the old unauthenticated pages. New workspace regression cases run in `workspace.spec.cjs` with real reviewer sessions and CSRF tokens, using the hosted entrypoint over disposable SQLite. Live database settings are explicitly cleared in the local browser server.

A mixed-storage regression verifies that legacy diagnostic product listings ignore connected submission-backed records and cannot overwrite them. Current shop-owned products use `/v1/seller/products`, `/v1/catalog/products` and the Agency submission endpoints; the diagnostic `/v1/products` list contains legacy verification-backed products only.

The existing Python 3.15 environment cannot install the pinned psycopg-binary 3.2 wheel. Full merge validation therefore uses an isolated Python 3.13 environment at `/tmp/trustcart-merge-venv`, installed from the unchanged requirements file.

Merge validation passed: `/tmp/trustcart-merge-venv/bin/python -m pytest -q` — 172 tests; `npm test` — 120 tests; `npx playwright test` — 34 desktop/mobile tests. The public storefront remains public, the commit-version GET remains public, and private diagnostic/role endpoints retain their access checks.

## Automatic review submission

Seller Submit for review now calls the Live-only `/submit-review` endpoint. Provider-boundary tests mock the OpenAI Responses API and verify both document and claim requests; no live credentials or network calls are required. Browser tests inject explicit test-only assessors in `serve_connected.py`, then exercise the real submit endpoint, checklist rendering, Agency queue, reviewer confirmation and badge propagation. Complete, confident Replay fixtures can approve automatically under the same deterministic rules; uncertain cases still require a reviewer decision.

Validation for this change: `/tmp/trustcart-merge-venv/bin/python -m pytest -q` — 181 passed; `npm test` — 133 passed; `npx playwright test` — 46 passed. Coverage includes missing documents, unavailable/malformed claim checks, grounded claim filtering, idempotent retries, stale revisions, unrun-check approval rejection and preservation of publication behavior. Real OpenAI connectivity and deployed provider configuration were not validated.

Automatic-approval update: complete, consistent assessments at confidence ≥0.75 with all required applicable rules passing now become APPROVED/COMPLETED immediately. Lower confidence, missing information or conflicts remain PENDING for Agency, while registry outages remain UNKNOWN; failed Live OpenAI checks now route to Agency for explicit manual replacement. Validation: 184 Python tests, 133 frontend tests and 48 desktop/mobile browser tests passed, including both automatic approval and uncertain-case manual review. Providers remain mocked in local validation.

## Live OpenAI failure fallback

Failed Live document/claim checks are recorded as unavailable and skipped to Agency manual review. Otherwise eligible cases remain PENDING with no badge; conclusive failures and unavailable registry checks retain DENIED/UNKNOWN. Approval requires explicit manual-check confirmations, required original documents, confirmed identity fields and a current audit hash. Rules rerun without another provider call. Invalid Replay fixtures cannot use the fallback. API tests cover one/both providers failing, missing confirmations, stale hashes and registry/claim blockers; browser tests exercise the manual confirmation flow at desktop/mobile sizes.

Latest fallback validation: 189 Python tests passed using `/tmp/trustcart-readme-audit-venv/bin/python -m pytest -q`; 134 DOM tests passed using `npm test`; 50 desktop/mobile browser tests passed using `npm run test:browser -- --config /tmp/trustcart-core-acceptance.config.cjs`. The temporary config runs the same suite on isolated port 8771 with a disposable database and synthetic assessors, avoiding another local run on port 8768. The standard command remains `npm run test:browser`. No live OpenAI or Supabase calls were used.
