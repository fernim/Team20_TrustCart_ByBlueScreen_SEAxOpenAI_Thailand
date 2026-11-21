# TrustCart Baseline Lead

TrustCart demonstrates how a marketplace can verify a health-product listing before publication through an API. Team BlueScreen built the baseline for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating the baseline implementation in commit `1d8b004`.

## What works

1. Submit a listing with `POST /v1/verifications`. TrustCart checks the registration reference, product name, licence holder, and category against its synthetic registry.
2. Retrieve the saved decision with `GET /v1/verifications/{id}` using the URL in the submission response's `Location` header.
3. Read the status, reason, human review flag, and hash-chained audit trace. Results persist in SQLite across app restarts.
4. Open `/` for a responsive Shopee-style storefront UI with synthetic catalog data, search, category filters, promotional controls, product details, and a local demo cart. A product-only blue checkmark on LumaVale Vitamin C reflects a successful synthetic identity/category check from the API. Only passing products have a clickable badge; other products have no status badge. `/reviewer` displays the saved detailed report and audit trace as a read-only, unauthenticated local demo. Three fictional-brand supplement listings illustrate explicitly labeled unsupported overclaims; R-03 detects their overclaims and the backend returns DENIED with matched-phrase reasons and a hash-chained trace. They have no status badge. The reviewer stepper explains failed checks and required corrections. The storefront does not process orders.

| Status | Meaning |
| --- | --- |
| `APPROVED` | The listing matches an active synthetic registration fixture. |
| `DENIED` | The identity or category check failed against the fixture. |
| `UNKNOWN` | The reference is missing, the category is unmapped, or the registry is unavailable. The case is flagged for human review. |

Follow the [README](README.md) to run the service locally and try the API at `/docs`. Integration tests cover decision outcomes, result retrieval after restart, audit hash verification, registry outages, and storefront/static serving. Run `npm test` for frontend component behavior.

## Remaining product work

The baseline runs locally with synthetic data. Integrating an authorized live registry, completing the regulatory rule pack, hosting the API with marketplace authentication, and authorized reviewer actions remain future work.
