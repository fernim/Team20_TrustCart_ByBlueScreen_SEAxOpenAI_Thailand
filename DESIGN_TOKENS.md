# Marketplace UI design system

The customer (`/`), seller (`/seller`) and reviewer (`/reviewer`) pages share `frontend/tokens.css` and `frontend/marketplace-ui.css`. This is a UI-only update: existing APIs, persistence and decision rules remain unchanged.

| Token | Value |
|---|---|
| Primary / gradient end | `#ee4d2d` / `#ff6633` |
| Canvas / surface | `#f5f5f5` / `#ffffff` |
| Text / secondary | `#333333` / `#757575` |
| Border | `#e8e8e8` |
| Font | Locally bundled Roboto 400, 500, 700; Helvetica Neue, Arial, Tahoma, sans-serif fallback |
| Caption / body / section / title | 12 / 14 / 20 / 24 px |
| Spacing | 4, 8, 12, 16, 24, 32 px |
| Control / panel radius | 2 / 3 px |
| Storefront / workspace sidebar | 1200 / 220 px |
| Mobile workspace breakpoint | 760 px |

Roboto files come from Google Fonts, with the SIL Open Font License in `frontend/assets/fonts/OFL.txt`. Thai characters use system fallback; exact appearance depends on installed Thai fonts. Tokens are a reference-informed approximation, not an exported official Shopee specification.

## Reference and comparison

- Customer reference: https://shopee.co.th/ (visited 21 November 2026). Live screenshot captured, but the promotional overlay/assets were partially loaded.
- Seller reference: public Shopee Seller Education screenshots at https://seller.shopee.co.th/edu/article/263 and https://seller.shopee.co.th/edu/article/26959.
- Customer screenshot reference: https://krubom.com/blog/technology/website-types-examples-thailand.
- Reviewer is a custom read-only TrustCart workspace following the Seller Centre visual system; it is not a reproduced Shopee reviewer product.
- Existing locally stored campaign/category imagery is retained; provenance is in `frontend/assets/sources.json`.

Playwright MCP was not exposed to this chat. Local Playwright Chromium captured `artifacts/ui/shopee-reference.png` and customer, seller and reviewer screenshots at widths 1440 and 390. Screenshots were visually inspected for typography, spacing, panel hierarchy and mobile wrapping; the mobile draft button was refined to fill the action panel. All six views reported no document horizontal overflow. Browser interaction checked seller draft saving and keyboard focus. Frontend DOM tests cover the existing shopper, seller and reviewer flows and the shared navigation contract.

Synthetic-registry limitations remain visible in the workspaces. The reviewer stays read-only, and product badges retain the existing eligibility rules. No authentication, evidence workflow or new backend functionality is added.


## Homepage reference refresh (21 November 2026)

The public Shopee Thailand homepage was inspected through the browser’s Playwright controls. Playwright MCP is not exposed in this session. At a 1280px viewport, the reference header measured 119px tall and its main banner began at y=149px. The storefront now uses those proportions, keeps the 1200px content width and 2:1 banner split, and presents categories in two rows with 12 columns and ten visible at desktop width. Narrow screens retain horizontal scrolling within each rail.

The customer/reviewer/seller view navigation lives in the customer footer so it does not shift the reference header and banner. Seller and reviewer workspace navigation remains at the top. Keyboard focus, native dialogs, language switching, product creation/editing, current inventory and verification eligibility retain their existing behavior.

A Shopee Mall reference showcase uses nine locally bundled campaign/brand images recorded in `frontend/assets/sources.json`. Its tiles explicitly open the corresponding Shopee pages in a separate tab; these are reference shops, not TrustCart seller endorsements or product verification. A popular-product rail uses the local catalog’s recorded demo sales and opens local product details. It does not assert live weekly sales. Promotions remain illustrative and checkout remains unavailable.

Validation includes DOM component tests and desktop/mobile Playwright flows for navigation, image loading, language changes, product details and layout overflow. The current visual match covers the storefront homepage; authenticated Shopee accounts, checkout and other remote pages are not cloned.

## Product detail pages

Products have shareable `/products/{id}` URLs for both numeric demo IDs and stable seller product UUIDs. FastAPI serves the storefront shell for direct visits and reloads. The client resolves the selected listing, updates the document title, and renders a full page under the shared header. Product images, titles, flash-sale entries and popular-product entries are actual links that support native new-tab and copy-link actions. Normal clicks use browser history navigation, preserving the local cart and catalog filters; Back/Forward and the breadcrumb return to the appropriate view. Header search returns to catalog results.

The detail page follows the public Shopee layout observed at `https://shopee.co.th/product/38793442/783511072`: breadcrumb, large left gallery, right purchase panel with title, price and quantity, then separate specification and description sections. Layout reference only: registry details, ratings, shipping promises and medical copy are not imported.

The content is capped at 1200px with a 450px gallery column and collapses to one column at 760px. Price uses a pale surface and orange 32px type (28px on mobile). Thumbnail buttons expose their selected state and an image counter. Plus/minus controls and direct entry retain stock and cart limits. Zero or missing seller stock disables quantity controls and adding to cart. Adding a product stays on its detail page. “View cart” opens the existing cart without placing an order. Full browser reloads reset this in-memory demo cart.

Saved product images, prices, stock and descriptions remain the source of the rendered listing. Only qualifying passing products have the clickable blue product badge; its popup remains a short customer status. The reviewer retains the detailed report and audit trace. Source-listing links remain in descriptions for the existing reference products. Seller descriptions preserve line breaks and render as plain text.

Direct seller URLs show a loading state until saved listings arrive. Missing/deleted products show a not-found state; connection failures without a loaded product show a retry action. These states never show a verified badge. Existing loaded product pages continue polling for saved changes and remove badges when current verification cannot be confirmed.

Validation covers direct URLs and reloads, browser Back/Forward, header search, missing/deleted listings, failure/retry, bounded quantity controls, thumbnail switching, badge eligibility and popup, inventory edits, cart navigation, language switching, native popup dismissal/focus, and desktop/mobile overflow.

Validation covers bounded plus/minus controls, thumbnail switching, badge eligibility and popup, stock edits, cart handoff, language switching, native dialog dismissal/focus, and desktop/mobile dialog overflow.


## TrustCart integration update

The integrated application uses TrustCart branding, a teal palette, shield/check logo, independent verification hero, and rounded panels. The copied promotion and brand showcase sections are hidden in the live storefront. Shared design tokens live in frontend/tokens.css and integration overrides live in frontend/marketplace-ui.css. Historical reference measurements above describe the earlier branch state.
