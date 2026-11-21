# Automated UI checks

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

These tests cover the implemented UI workflows. They do not establish exhaustive branch coverage, official product certification, live-registry integration, authentication, real checkout, or full accessibility compliance. Browser checks use Chromium only; mobile viewport emulation is not testing on a physical phone.
