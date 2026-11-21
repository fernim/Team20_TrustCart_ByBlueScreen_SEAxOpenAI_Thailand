# TrustCart — Product Brief

**One line:** TrustCart checks that a health product's registration number belongs to the product being sold, before a shopper buys it.
**Hook:** เลข อย. จริง ≠ สินค้าจริง (a real registration number is not a verified product).
**Built by:** Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand, 21 November 2026.

## Delivered demo and remaining scope

The connected three-role workflow is implemented locally. Registry data and subscriptions are synthetic; replay and live document assessment are distinct modes. Live provider and hosted PostgreSQL validation are separate operational checks. The agency workspace, real billing and marketplace OAuth remain future work. See README and DEMO.en.md for the supported workflow. Older sections below also describe the broader target.

## What is TrustCart?

TrustCart is an AI verification agent offered as an API (APIaaS) that marketplaces plug into their listing flow. It checks health and supplement listings when a seller requests verification; normal publication remains available without a badge.

- **For shoppers:** a clickable product tick only after a current passing check; a short status explanation, with no private report.
- **For sellers:** shop-owned listings, a demo ฿299/month unlimited verification plan, required private documents per submission, visible blockers and resubmission after review.
- **For reviewers:** a cross-shop queue filtered by stage and required action, original documents, AI readiness findings, and audited decisions.

What it checks, as five deterministic rules:

| Rule | Check |
|---|---|
| R-01 Registration identity | The number exists, is active, and belongs to this product and licence holder |
| R-02 Product category | Claims stay within the registered category (a supplement making drug claims fails) |
| R-03 Advertising claims | No treat, cure, prevent or reverse claims, in Thai or English; the "ผลิตภัณฑ์เสริมอาหาร" term is present |
| R-04 Advertising permit | A permit shown on the listing matches the record |
| R-05 Seller evidence | Label and certificate match the product name, number and licence holder |

Results are Approved, Pending, Denied or Unknown. Unknown means the system could not check (for example, the registry is down) and is never shown as a pass.

## Who is it for?

| User | Need | What TrustCart gives |
|---|---|---|
| Thai online shoppers buying supplements from unfamiliar sellers | Know whether a listing is genuine before paying | A badge and short status on passing listings |
| Small and medium sellers | Know what a compliant listing needs before a takedown | Optional verification, evidence requests and resubmission |
| Marketplace trust and safety teams, Thai FDA officers | Act on thousands of listings with evidence | Risk-ranked queue and a tamper-evident audit trail |
| Marketplaces (Shopee first) | Fewer takedowns and complaints without building a rule engine | A plug-in verification API |

## Where does it run?

- **In the marketplace listing flow:** the marketplace calls `POST /v1/verifications` when a seller creates or edits a listing, and shows the badge from `GET /v1/widgets/{id}`.
- **On the product page:** the Trust Badge and report for shoppers.
- **In the reviewer console:** the queue, replay of every step, and the audit check.
- **Prototype:** live on Vercel at trustcart-bluescreen.vercel.app (password protected), with API documentation at `/docs`.
- **Markets:** Thailand first. Each Sea market has a health-product regulator and a registry (Singapore HSA, Indonesia BPOM, Malaysia NPRA, Vietnam VFA), so the same agent runs with a different registry adapter and rule pack.

## When does it act?

- **Before publication:** at listing creation or edit, which is earlier than today's takedowns after products are already live.
- **When evidence arrives:** the agent rechecks automatically after a seller uploads a label or certificate.
- **When the registry is unavailable:** every listing becomes Unknown and goes to a human until the registry is back.
- **Roadmap:** hackathon prototype now; Thai FDA sandbox connector, marketplace pilot and persistence in the next three to six months; more product categories and countries after that.

## Why is it needed?

- A manual registry lookup confirms that a number exists. It does not confirm that the number belongs to the product on the page or supports its claims, so a real number can be borrowed from another product.
- Enforcement happens after harm: the Thai FDA closed 121,494 illegal health-product advertisements from 2023 to April 2026, and Lazada removed 9,454 noncompliant listings in one year with the Thai FDA.
- Shoppers complain: ETDA's 1212 centre received 39,112 online complaints in 2025, 36.4% about online shopping.
- Sellers learn the rules by takedown, and reviewers see lists without evidence they can defend.
- The Thai FDA announced in October 2025 that it will connect its product database to marketplaces by API, so a verification layer that uses that data is timely.

## Why TrustCart and not something else?

| Alternative | Problem | TrustCart's answer |
|---|---|---|
| Manual registry lookup | Proves the number exists, not that it belongs here | R-01 identity match against product and licence holder |
| Keyword filters | Flag without a reason a reviewer can check | Rule IDs, evidence and a replayable trace for every verdict |
| A general chatbot | Can state things it did not retrieve | AI only extracts claims; deterministic rules decide |
| Scraping marketplace or Thai FDA pages | Breaks terms of service and fails on stage | Registry Adapter over authorised or mock data |
| A single-marketplace app | Cannot serve several markets | One API with swappable registries and rule packs |

## How does it work?

1. **Ingest** the listing and its registration number; record who called (marketplace client, seller or reviewer).
2. **Extract** claims with AI (OpenAI structured output). Phrases that are not literally in the listing are dropped.
3. **Look up** the registry through the Registry Adapter (mock data in the prototype).
4. **Validate** rules R-01 to R-05.
5. **Decide** the status with a confidence score. Below 0.75, or with conflicting data, the case goes to a human.
6. **Request evidence** from the seller when the number does not match.
7. **Recheck** the uploaded evidence (each file hashed with SHA-256).
8. **Report** to shopper, seller and reviewer, with every step written to a hash-chained audit trail that shows any later edit.

Supporting design:

- **Security:** OAuth 2.0 client credentials give each marketplace a 15-minute token limited by scope; tokens that are forged, expired or out of scope are rejected.
- **Risk ranking:** a versioned additive score (RISK-v1) orders the reviewer queue only and never changes a verdict.
- **Languages:** formal Thai and formal English, with no mixing.
- **Privacy:** seller documents are collected for a stated purpose and minimised (PDPA).

## How does it make money?

Illustrative pricing for the pitch, not real prices:

| Tier | Price | Includes |
|---|---|---|
| SME seller | Free | 20 pre-publication checks per month |
| Brand | THB 1,990 per month | Trust Badge, evidence vault, copy assistant |
| Marketplace | Per API call | Full API with service levels, reviewer queue, audit export |

## What it is not

- Not a live Thai FDA integration during the hackathon: there is no public supplement registry API yet, so the prototype uses a mock registry and synthetic listings.
- Not legal or medical advice: it reports what a listing may lawfully claim, never what to take.
- Not official Shopee software: the Shopee plug-in is a concept integration.
- Never a silent pass: low confidence or an unavailable registry always goes to a human.

## Proof in the prototype

- 20 automated tests pass, covering registry outage, tamper detection, OAuth scopes, language separation and the password gate.
- Live demo paths: borrowed number → evidence → reviewer; registry outage → Unknown; tamper → detected at the edited step; copy fix → Approved; conflicting permit → reviewer.

## What we ask for

- **Thai FDA:** sandbox access to the product database API, food supplements first.
- **Shopee Thailand:** a pre-publication pilot with health and supplement sellers, measuring takedowns avoided and time to a compliant listing.
- **Judges and partners:** where a check like this would fail, and what evidence they would trust.

Sources for the figures: Thai FDA news (9 Oct 2025, 30 Apr 2026), Tilleke & Gibbins (2025), ETDA 1212 statistics (2025). Full list in `GAPS_AND_QA.md` and the deck's references slide.
