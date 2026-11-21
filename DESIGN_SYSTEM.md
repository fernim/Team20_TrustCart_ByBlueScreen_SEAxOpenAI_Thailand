# TrustCart shared design system

Customer storefront and reviewer workspace use one buildless CSS system in `frontend/styles.css`.

## Foundations

| Token | Value | Use |
|---|---|---|
| `--brand-primary` | `#ee4d2d` | Header, primary actions, selected controls |
| `--brand-soft` | `#fff2ed` | Next-action panel |
| `--surface` | `#fff` | Content panels |
| `--canvas` | `#f5f5f5` | Page background |
| `--text-primary` | `#333` | Main content |
| `--text-secondary` | `#757575` | Supporting text |
| `--border-subtle` | `#e8e8e8` | Dividers and connectors |
| `--status-pass` | `#18845b` | Passed reviewer checks |
| `--status-block` | `#b53521` | Blocked reviewer checks |
| `--focus-ring` | `#176cba` | Visible keyboard focus |

Use Arial/Tahoma/system sans-serif for Thai/English continuity with the storefront. Titles: 24–30px; section headings: 17–23px; body: 14–16px; secondary metadata: 12–13px. Space in 4px increments. Maximum workspace width: 1200px. Panels have 4px corners and 16–24px padding.

## Components and behavior

- Orange brand header shared across customer and reviewer contexts. Navigation explicitly names the current view.
- Primary actions use the brand orange, white text, and visible focus rings.
- Product verification: only qualifying backend APPROVED results show a blue check button. DENIED, UNKNOWN, PENDING, failures and low confidence render as normal products with no status badge.
- Reviewer stepper: R-01 identity → R-02 category → R-03 claims → confirmation. This is a summary of recorded checks, not an assertion that the backend pauses execution at each stage. All failed checks remain visible, even when multiple checks ran.
- Each step has a symbol, textual state and explanation. A missing trace entry is “ยังไม่ได้ตรวจ”, never a pass. “อะไรทำให้ไปต่อไม่ได้?” states concrete fixes. Corrections require a new API verification; the UI does not alter verdicts.
- Approval requires all recorded stages to pass, APPROVED, confidence ≥0.75 and no human review. Missing or conflicting evidence blocks confirmation.
- Desktop: horizontal four-stage stepper. Below 700px: vertical stepper. Long evidence and hashes wrap; native disclosure controls preserve audit detail.
- Loading, invalid ID, missing report and network failure are explicit; failed lookups clear stale reports. Untrusted listing text uses textContent.

## Content provenance

Supplement reference photos and names now match DHC, NeoCell and Deva C products. Overclaim fixtures deliberately append test copy to real reference names; descriptions identify that copy as requiring correction and do not quote source-seller claims. Short title excerpts and factual pack-size summaries are drawn from Shopee listings 38793442/783511072 and 224681664/40201061048, observed 2026-11-21. Full seller descriptions were not retrievable and are not claimed to have been copied. Source links appear in product details. Source references receive no verified badge or verdict. Prices remain demo values or observed reference snapshots, not live marketplace offers. Photo source URLs are recorded in `frontend/assets/sources.json`. Reference products never borrow the synthetic registry approval.

The reviewer product list is read-only; authorized review actions remain in the integrated workspace. The deployed entrypoint uses the shared demo gate. UI separation is not authorization. No medical advice or official certification claims appear in the interface.

## Seller workspace

`/seller` reuses the orange brand header, white form sections, thin neutral borders and existing primary buttons. A 220px navigation rail sits beside the form on desktop and becomes a compact navigation row on small screens. Required fields have explicit labels; textareas resize vertically. Draft and verification are distinct actions. The form is not a marketplace publication flow.

Seller progress uses `verification-view.js`, shared with the reviewer. Seller rendering disables raw audit details while retaining the backend status, check outcomes and concrete fixes. Editing invalidates the on-screen result immediately; loading and error messages are announced in a live region.

Seller summaries use 88px saved-image thumbnails, product titles, price/stock/status metadata, and distinct Edit/View product actions. Below 760px actions wrap beneath the summary. Status pills in the seller workspace are separate from the customer’s product-only verification badge. Shop-level “ร้านแนะนำ” labels are absent because this app has no seller recommendation records.

The reviewer’s latest-product list reuses seller thumbnail and metadata styles, with an Open report action in place of Edit/View product. It displays persisted verification statuses only. Mobile actions span the row. Unchanged refreshes preserve DOM controls and focus; report lookup, list loading, and list errors have separate states. Detailed reports remain reviewer-only.


## TrustCart integration update

The integrated application retains the Shopee-style orange gradient, shopping-bag mark, campaign hero, brand showcase and compact panels. Shared design tokens live in frontend/tokens.css and integration overrides live in frontend/marketplace-ui.css. Historical reference measurements above describe the earlier branch state.

The shared visual theme remains Shopee-style after backend merges: orange tokens, compact corners, campaign imagery and consistent seller/reviewer controls. Evidence workspace and API links remain available.
