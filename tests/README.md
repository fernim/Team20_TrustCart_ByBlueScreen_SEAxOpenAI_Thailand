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
| Shared page shell | Shared tokens, current-page navigation, and skip links. |

## Real browser checks

```sh
npx playwright install chromium
npm run test:browser
```

Playwright starts FastAPI on port 8766 against a disposable SQLite database. It refuses to reuse an existing server. It runs Chromium at desktop (1440 px) and mobile (390 px) viewport sizes. No marketplace or registry site is contacted; the backend uses its synthetic adapter. A preinstalled Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The browser suite checks shopper search/language/sorting/cart, native dialog opening and Escape/focus restoration, seller creation and correction, persistence after reload, reviewer audit expansion, customer badges, native draft-discard confirmations, cross-page navigation, stylesheet loading, and viewport overflow. These scenarios complement the larger mocked failure-path suite.

Failure traces are retained under `test-results/`; inspect one with `npx playwright show-trace <trace.zip>`. Generated results are ignored by Git.

The reference brand showcase is hidden in the integrated interface. Browser checks verify the visible TrustCart hero and popular-product images, plus navigation and product behavior.

## Hosted desktop and mobile checks

Set TRUSTCART_BASE_URL to the target Vercel origin and TRUSTCART_DEMO_PASSWORD in the process environment, then run npm run test:browser. Leave these variables unset to run the isolated local suite. Keep the password value out of command output and source files.

Hosted mode runs 20 checks across desktop and mobile Chromium contexts. It covers the existing storefront flows and adds password protection, evidence/recheck/reviewer actions, stale hashes, agency totals, outage simulation, copy correction and authenticated Swagger. Each created product title is unique so earlier hosted runs do not create ambiguous selectors.

The unauthenticated request context explicitly overrides the configured credentials. Hosted traces are disabled to avoid writing authentication headers into trace artifacts. The suite creates synthetic products and reviews, and leaves the saved audit history available for inspection.

Shared persistent storage is required for saved-product and report continuity across hosted requests. A disappearing product or report remains a test failure. Temporary instance-local SQLite cannot guarantee those flows on Vercel.

These tests cover the implemented UI workflows and, in hosted mode, the demo password gate. They do not establish exhaustive branch coverage, official product certification, live-registry integration, production identity management, real checkout, or full accessibility compliance. Browser checks use Chromium only; mobile viewport emulation is not testing on a physical phone.
