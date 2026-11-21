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
