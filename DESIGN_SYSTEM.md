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

Fictional overclaim fixtures remain separate from real source references. Short title excerpts and factual pack-size summaries are drawn from Shopee listings 38793442/783511072 and 224681664/40201061048, observed 2026-11-21. Full seller descriptions were not retrievable and are not claimed to have been copied. Source links appear in product details. Source references receive no verified badge or verdict. Synthetic prices/artwork do not represent the source listings.

The reviewer remains an unauthenticated, read-only local demo. UI separation is not authorization. No medical advice or official certification claims appear in the interface.

## Seller workspace

`/seller` reuses the orange brand header, white form sections, thin neutral borders and existing primary buttons. A 220px navigation rail sits beside the form on desktop and becomes a compact navigation row on small screens. Required fields have explicit labels; textareas resize vertically. Draft and verification are distinct actions. The form is not a marketplace publication flow.

Seller progress uses `verification-view.js`, shared with the reviewer. Seller rendering disables raw audit details while retaining the backend status, check outcomes and concrete fixes. Editing invalidates the on-screen result immediately; loading and error messages are announced in a live region.


## TrustCart integration update

The integrated application uses TrustCart branding, a teal palette, shield/check logo, independent verification hero, and rounded panels. The copied promotion and brand showcase sections are hidden in the live storefront. Shared design tokens live in frontend/tokens.css and integration overrides live in frontend/marketplace-ui.css. Historical reference measurements above describe the earlier branch state.
