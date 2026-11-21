# TrustCart Mock-up, Test Data and Verification Plan

The plan maps every judging criterion, judge perspective, rule and demo path to synthetic data, an expected result and a check that proves it. Use it to build mock-ups and test data, and to verify the product before code freeze at **17:00 on 21 Nov 2026**.

> **Data policy:** every record is synthetic. The plan contains no real seller, product, registration or personal data, and no live Thai FDA or marketplace connection. TrustCart results are decision support only. They are not certification, legal advice or medical advice.

---

## Status snapshot (checked at `5c29e82`, 12:16, 21 Nov 2026)

| Item | Now in the repository | Target in this plan | Gap |
| --- | --- | --- | --- |
| Tests | 32 passing | + coverage, fixture-integrity and invariant tests (§3.10) | 3 test files |
| Registry fixtures | 4 (`DEMO-001`, `DEMO-REVOKED`, `DEMO-COLLAGEN`, `DEMO-FISH-OIL`) | 18 (§3.1 + §3.7), 13-digit synthetic format | 14 records, format check |
| Listing fixtures | 7 (L1–L7) | 40 (L1–L40, §3.2 + §3.8) | 33 listings |
| Evidence fixtures | Generated in tests (E1–E4 behaviour) | E1–E16 (§3.3 + §3.9) | 12 cases |
| R-03 phrases | 9 Thai phrases + English pattern + required term | + weight-loss, fast-result, group G1–G12 phrases; Thai negatives | §3.6 phrase list |
| High-risk groups | Diabetes and anti-ageing only | G1–G13 | 11 groups |
| Endpoints | All 11 core endpoints + demo routes | Agency dashboard aggregate (§9.0) | 1 view |
| Open gaps | — | G1–G11 (§13) | 11 |

### Build order for the dataset (each step test-first, one commit each)

1. Add the 13-digit synthetic numbers and an R-01 format check (G1, L8, L36, L37).
2. Add the EXPIRED and drug-category registry records (G4, L9, L29, L30).
3. Extend `claim_rules.json` with the G1–G12 phrases and add the Thai negative tests (G2, L12, L24, L27).
4. Add listings L15–L40 with tags `group`, `language`, `expected_status`, `expected_failures`, `llm_dependent`.
5. Add the coverage, fixture-integrity and invariant tests (§3.10).
6. Add the policy decisions for permits and foreign registries (G9, G10), then evidence types E5–E16 (G8; G7 as roadmap).
7. Build the agency dashboard aggregate from stored verifications (§9.0).

---

## 0. Sources and how far to trust them

| Source | Used for | Reliability |
| --- | --- | --- |
| `Hackathon Information.pdf` (official, 18 pages) | Agenda, rules, criteria, judges, submission | **Authoritative** |
| Pitch deck (Google Slides, 50 slides) | Product story, rules, demo paths, pricing | Prepared before the event; verify against the code |
| War-Room Playbook (TH/EN PDF + summary) | Strategy, Q&A, gaps | Prepared before the event; some facts are out of date (see below) |
| Repository at commit `5c29e82` | What is actually built | **Ground truth for demo claims** |

**Conflicts to resolve. The official PDF wins in each case.**

| Topic | Playbook / deck says | Official PDF says |
| --- | --- | --- |
| Hacking start | 08:30 | **10:25** |
| Pitch length | 3 minutes | **6 min demo + 2 min Q&A** (final round: 6 + 4) |
| People to address | MDES Deputy Minister, Sea Thailand CEO, OpenAI APAC GTM | **13 judges:** Shopee ×4, Monee ×3, Garena ×1, OpenAI Ambassador ×2; final round Tadcha Anunrojwong, Kevin Chan, Dr. Napat Jatusripitak |
| Name spelling | "Thatcha Ananrojwong", "Naphat" | **Tadcha Anunrojwong**, **Napat Jatusripitak** |
| Test count | "11+" or "20" | Use the count at code freeze (32 passed at `5c29e82`) |

The Google Drive file linked by the team (`1GynsI…`) was not accessible for this plan and is not reflected here.

---

## 1. Judge perspective matrix

Each row says what a judge is likely to probe, how to check it, and the artefact that proves it. The perspectives are inferred from published titles only.

### 1.1 First round (pairs of judges, 6 + 2 min)

| Judge (role) | Likely probe | What to verify | Evidence artefact |
| --- | --- | --- | --- |
| Bhuvit Jotikasthira, AI Transformation Lead, Shopee | Does AI change the listing workflow, or is it bolted on? | Pre-publish `POST /v1/verifications` runs at listing time; the seller fixes copy before publishing | Demo path D4 (copy fix → approved); before/after workflow mock-up |
| Panthon Imemkamon, Data Science Lead, BI, Shopee | Accuracy, false positives, data source | Positive and negative R-03 regression tests; confusion table on the fixture set | §6 test tables; `tests/test_rule_regressions.py`; §4.3 metrics |
| Nutchaphol Chaivorapongsa, BI & Planning, Shopee | KPI impact | Illustrative KPI model, clearly labelled as an assumption | §10 KPI sheet |
| Natwarat Techahuasingh, BD AI Champion, Shopee | Seller value, adoption, regional scale | SME Free → Brand tier; one engine with a swappable registry and rule pack | Pricing slide (labelled illustrative); rule pack JSON |
| Shawisa Yuyong, Competitive Intelligence, Monee | Difference from what already exists | Comparison: manual lookup vs keyword filter vs LLM auto-approve vs TrustCart | §9 Q8 answer card |
| **Varis Moovoravit, CS & Merchant Ops, Monee** | Wrongly flagged honest seller? Appeal? Who decides? | `PENDING` (not takedown) on a mismatch; evidence → recheck; reviewer with `chain_hash`; reasons in Thai and English | Demo D1 full loop; review screen; stale-hash 409 test |
| Theerayut Sueverachai, BI Manager, Monee | Risk signals, auditability | RISK-v1 versioned; risk ranks the queue only; policy hash in the trace | `risk_policy.json`; trace step `risk_policy` |
| Potcharaphol Chat-anan, RoV Producer, Garena | Is it clear in 10 seconds? UX | Badge readable at a glance; one "wow" moment (tamper detected) | Shopper mock-up; demo D2 |
| Nutchanon Yongsatianchot, OpenAI Ambassador | How deep is the Codex usage? | `AGENTS.md`, `[codex]` commits, test-first tasks | `git log`; README "How we used Codex" |
| PiyaLitt Ittichaiwong, OpenAI Ambassador | Correct OpenAI usage | Structured output plus a grounding guard; the LLM never sets a status; works without a key | `tests/test_grounding.py`; `backend/app/llm.py` |

### 1.2 Final round (main stage, 6 + 4 min)

| Judge | Likely probe | What to verify | Evidence |
| --- | --- | --- | --- |
| Tadcha Anunrojwong, Director, Data Analytics & Regional Financial Strategy, Shopee | Unit economics, regional scale, measurable value | Cost per verification (deterministic path costs no tokens); per-country registry adapter | §10 economics; architecture slide |
| Kevin Chan, Head of Technical Success (ASEAN), OpenAI | Production reliability, hallucination control, cost and latency | Grounding guard drops invented phrases; outage → `UNKNOWN`; latency measured | §7 safety tests; §8 latency check |
| Dr. Napat Jatusripitak, CEO, Siametrics & ViaLink | Business viability, moat, data quality, explainability | Feedback loop (reviewer decisions); versioned policy; honest limits | §9 Q-cards; "what it is not" slide |

---

## 2. Judging criteria → proof checklist

| # | Criterion | Must be true in the live demo | How to verify | Owner |
| --- | --- | --- | --- | --- |
| 1 | Problem & Solution Fit | A real-format number belonging to *another* product is caught | D1 shows R-01 fail with the reason "registered to a different product" | Ju |
| 2 | Build Quality | All 4 demo paths run on the **hosted** demo with no errors | §8 run sheet ticked on `trustcart-bluescreen-demo.vercel.app` | Thomaz |
| 3 | Insight & Originality | Extraction, rules and human review are separated, and the hash chain is checked live | D2 tamper → `valid=false, broken_at=N` | Big |
| 4 | Real-World Value | All three users see value from one record | Shopper badge, seller fix, reviewer queue on one verification ID | Fen |
| 5 | Build Direction | 03 Deep Domain (Thai supplement rules) + 01 Autonomous (runs alone, escalates) | Rule table with Thai terms; outage/low confidence → human | All |
| 6 | Use of Codex | Commits are inspectable; `AGENTS.md`; tests first | `git log --oneline | grep -c "\[codex\]"`; test count | Big |

### Build Direction proof points

| Direction | Judge question | TrustCart answer to demonstrate |
| --- | --- | --- |
| 01 Autonomous & Adaptive | Can it run alone and improve? | It processes listings unattended and escalates only on low confidence, a conflict or an outage. Reviewer decisions are logged as labelled data for a later policy version (RISK-v2): **planned**, say so honestly. |
| 02 AI-Native | What is possible now that wasn't before? | Pre-publication checks at listing time instead of takedown after harm. |
| 03 Deep Domain | Would an expert trust it? | Thai supplement categories, prohibited claim phrases, สบ.5 / ฆอ. evidence, reviewer always final on uncertain cases. |

---

## 2A. Customer segments (team decision, 21 Nov 2026)

### Primary customers: agencies, marketing and government (public and private sector)

They align Shopee and OpenAI with Thai regulation and policy, fund scale-up, and can subsidise adoption.

| Segment | Examples (no affiliation claimed) | What they need | What TrustCart gives them | Who pays / funds |
| --- | --- | --- | --- | --- |
| Regulators and public agencies | Thai FDA (MoPH), DES / ETDA (1212), DGA, OCPB / Consumer Council | Prevention before harm; evidence they can act on; policy metrics | Pre-publication checks, hash-chained audit records, aggregate dashboards (violations by rule, category, time) | Public budget, pilot grant, digital-economy subsidy |
| Policy and standards partners | Industry associations, standards bodies | One rule pack that platforms share | Versioned rule pack JSON and a registry adapter interface | Association membership, co-funding |
| Marketing and brand agencies | Agencies running health and supplement campaigns | Compliant copy before ads go live | `suggest-copy` + R-03 screening + compliance report per campaign | Per-campaign or seat licence |
| Platform policy teams (public–private) | Marketplace trust & safety and government-affairs teams | Show regulators the platform screens listings | API + audit export that matches the regulator's evidence needs | Platform contract, possibly co-funded |

**Subsidy logic:** public or programme funding covers the free SME tier and the regulator dashboard. That lowers the adoption barrier for sellers and builds the network effect for the paid platform and agency tiers.

### Secondary customers: SME sellers, buyers, Shopee reviewers

| Segment | Need | TrustCart feature | Price (illustrative) |
| --- | --- | --- | --- |
| SME seller / brand | Know the rules before publishing; avoid takedowns | Pre-publish check, evidence upload, copy fix, badge | SME Free 20 checks/month (subsidised); Brand THB 1,990/month |
| Buyer (shopper) | A clear verdict inside the listing | Trust Badge + report; decision support only | Free |
| Shopee reviewer (T&S) | Fewer cases, ranked, with evidence | Risk-ranked queue, rule results, audit, `chain_hash` decisions | Part of the platform contract |

### Judge alignment for this segmentation

| Judge | Why this framing matters to them | Point to make or verify |
| --- | --- | --- |
| Tadcha Anunrojwong (Shopee, Regional BI & Finance) | Who funds it and how it scales across SEA | Subsidy offsets SME cost; same engine, per-country regulator adapter (FDA, HSA, BPOM, NPRA, VFA) |
| Kevin Chan (OpenAI) | Responsible AI that is acceptable to government | Grounding guard, human final decision, audit trail suitable for a regulator |
| Dr. Napat Jatusripitak (Siametrics & ViaLink) | B2G viability, sales cycle, moat | Pilot-first path, open rule pack standard, labelled decision data |
| Bhuvit / Natwarat (Shopee AI & BD) | Platform–regulator alignment | Pre-publication checks shift enforcement earlier, which reduces takedown workload |
| Varis (Monee CS & Merchant Ops) | Seller fairness | Subsidised free tier; `PENDING` + evidence instead of takedown |
| Shawisa (Monee CI) | Difference from in-house tools | A neutral shared layer that several platforms and regulators trust, not one platform's internal filter |

### Risks of a government-first framing (prepare answers)

| Risk a judge may raise | Answer |
| --- | --- |
| Government sales cycles are slow | Start with a platform + regulator **pilot** (sandbox), and use agencies and brands for early revenue |
| Dependence on subsidy | Subsidy funds the free tier only; platform and agency tiers are paid |
| Implied official endorsement | State clearly: no affiliation and no live Thai FDA access; synthetic data |
| Data protection when sharing with agencies | Aggregate dashboards; evidence stored as hashes; PDPA minimisation |

### Mock-up and test additions for primary customers

| Item | Spec | Verify |
| --- | --- | --- |
| **Agency / regulator dashboard** (mock-up) | Counts by status, failing rule, category and day; top claim phrases; audit validity rate | Numbers equal an aggregate over `GET /v1/verifications`; no seller personal data shown |
| Audit export | Report JSON per case with trace and evidence hashes | `GET /v1/audit/{id}` valid; export reproduces the hash chain |
| Agency campaign check | Batch of ad copies through `suggest-copy` and R-03 | Each item gets pass/fail and matched phrases |
| Policy versioning | Rule pack and risk policy versions in each trace | Trace contains the policy hash; changing the JSON changes the hash |
| Disclaimer for public-sector viewers | "Synthetic data, not an official Thai FDA result" | Visible on the dashboard and in the export |

Add Q-cards Q13–Q15 (§11) to the rehearsal.

---

## 3. Mock data specification

### 3.1 Registry fixtures (`backend/data/registry.json`)

The current fixtures use `DEMO-*` references. The deck and playbook describe the **13-digit Thai format `XX-X-XXXXX-X-XXXX`**. Add synthetic numbers in that format so that the R-01 format check is visible, and keep the `DEMO-*` aliases for backward compatibility. Every number below is fictional. Before use, check that none appears in the public Thai FDA search.

| Ref (synthetic) | Product | Licence holder | Category | Status | Ad permit |
| --- | --- | --- | --- | --- | --- |
| `10-1-90001-5-0001` (alias `DEMO-001`) | Demo Supplement | Demo Brand | supplement | ACTIVE | DEMO-AD-001 |
| `10-1-90002-5-0002` (`DEMO-COLLAGEN`) | Demo Collagen | Demo Brand | supplement | ACTIVE | DEMO-AD-COLLAGEN |
| `10-1-90003-5-0003` (`DEMO-FISH-OIL`) | Demo Fish Oil | Demo Brand | supplement | ACTIVE | DEMO-AD-FISH |
| `10-1-90004-1-0004` (`DEMO-REVOKED`) | Firming Serum | Demo Brand | cosmetic | REVOKED | — |
| `10-1-90005-5-0005` | Demo Fibre | Demo Brand | supplement | EXPIRED | — |
| `10-1-90006-5-0006` | Demo Herbal Drug | Demo Pharma | drug | ACTIVE | — |

### 3.2 Listing fixtures (`backend/data/listings.json`)

L1–L7 exist. L8–L14 are **proposed** to cover gaps that judges are likely to probe.

| ID | Scenario | Key inputs | Expected status | Failing rules | Confidence | Human review |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Real number, wrong product, disease claim | ref DEMO-001, name "Turmeric Blend", title "reverses diabetes" | `PENDING` | R-01, R-03 | 0.60 | Yes |
| L2 | Clean collagen | DEMO-COLLAGEN, required term present | `APPROVED` | — | 1.0 | No |
| L3 | Revoked registration | DEMO-REVOKED | `DENIED` | R-01 | 1.0 | No |
| L4 | Valid number, "prevents obesity" | DEMO-COLLAGEN | `DENIED`, then `APPROVED` after copy fix | R-03 | 1.0 | No |
| L5 | Unknown reference | MISSING | `UNKNOWN` | — (skip) | 0.0 | Yes |
| L6 | Clean fish oil | DEMO-FISH-OIL | `APPROVED` | — | 1.0 | No |
| L7 | Ad permit conflict | DEMO-FISH-OIL, permit DEMO-AD-CONFLICT | `PENDING` | R-04 | 0.60 | Yes |
| L8 *(new)* | Malformed number | `10-1-9000-5-01` | `UNKNOWN` or `DENIED` per policy (decide and document) | R-01 format | — | Yes if `UNKNOWN` |
| L9 *(new)* | Expired registration | `10-1-90005-5-0005` | `DENIED` | R-01 | 1.0 | No |
| L10 *(new)* | Supplement number on a drug-claim listing | registered supplement, copy "ยารักษาความดัน" | `DENIED` | R-02, R-03 | 1.0 | No |
| L11 *(new)* | Missing "ผลิตภัณฑ์เสริมอาหาร" | DEMO-COLLAGEN, plain description | `DENIED` | R-03 (term) | 1.0 | No |
| L12 *(new)* | Thai negatives (must pass) | "หายใจสะดวก ส่งไว สินค้าไม่หาย" + term | `APPROVED` | — | 1.0 | No |
| L13 *(new)* | Weight-loss and fast-result claims | "ลดน้ำหนักทันที เห็นผลใน 3 วัน" | `DENIED` | R-03 | 1.0 | No |
| L14 *(new)* | Valid listing during a registry outage | L2 + outage | `UNKNOWN` | — | 0.0 | Yes |

### 3.3 Evidence fixtures (synthetic files, generated in tests)

| ID | For | Declared fields | Expected R-05 |
| --- | --- | --- | --- |
| E1 | L1 | label name "Turmeric Blend", holder "Other Co" | fail (holder mismatch), confidence 0.60 |
| E2 | L1 | name/ref/holder match registry | pass → recheck can approve, subject to R-03 |
| E3 | any | an empty file | 422 validation error |
| E4 | any | the same bytes uploaded twice | identical SHA-256; both entries in the trace |

Use generated bytes (for example `b"synthetic-label-L1"`). Never use a real label photo or certificate.

### 3.4 Seller and shopper mock records

| Seller | Shop age | Use |
| --- | --- | --- |
| Demo Store 1–5 | 1 day to 6 years | Risk-tier variety in the reviewer queue |

There are no personal names, phone numbers, addresses or IDs (PDPA by design).

### 3.5 Domain considerations the dataset must encode

Collected from the playbook, the deck and the source inventory. Exact legal wording must be validated with Thai FDA; prototype rules are predefined and synthetic.

| # | Consideration | Source | Rule / check | Dataset implication |
| --- | --- | --- | --- | --- |
| C1 | **A real registration number ≠ a verified product** (borrowed numbers) | Core thesis | R-01 identity | Several listings reuse one valid number with a different name or holder |
| C2 | 13-digit food registration format `XX-X-XXXXX-X-XXXX` (สบ.5 / อย.) | Deck, playbook §8 | R-01 format | Valid, malformed, too short, letters, and spaces-instead-of-dashes cases |
| C3 | Registration status ACTIVE vs REVOKED vs EXPIRED | Playbook §1 | R-01 active | At least one fixture per status |
| C4 | Registered category: food supplement / drug / cosmetic / medical device | Deck slide 13 | R-02 | Supplements with drug claims; cosmetics with supplement claims; device claims |
| C5 | **MoPH Notification No. 447**: prohibited claims (treat, cure, prevent, reverse disease) | Playbook §8 | R-03 | Thai, English, mixed-language and euphemistic claims |
| C6 | **MoPH Notification No. 448**: active-ingredient ceilings | Playbook §5B, §8 | R-05 evidence (Lab COA) | COA values below, at and above a synthetic ceiling (*planned check*) |
| C7 | Mandatory Thai term "ผลิตภัณฑ์เสริมอาหาร" on supplement labels and listings | Playbook §5B | R-03 term | Missing, misspelled and present variants |
| C8 | Advertising permit (ฆอ.) must match the record | Deck R-04 | R-04 | Matching, conflicting, missing and expired permits |
| C9 | Manufacturing standards GMP / GHPs / HACCP / ISO 22000; **ISO 9001 alone is not accepted** | Playbook §5B | R-05 evidence | Certificates of each type, including ISO 9001 only |
| C10 | Evidence = front-label photo, สบ.5 certificate, ad permit, standards certificate, Lab COA, each SHA-256 hashed | Playbook §5B | R-05 + audit | Matching, mismatched, expired, duplicate and empty files |
| C11 | Thai/English euphemisms evade keyword filters | Playbook Q&A | R-03 + LLM extraction (grounded) | Euphemism cases flagged as "LLM-dependent"; deterministic tests must not rely on them |
| C12 | Registry snapshot hash recorded per lookup | Data model | Audit | Trace contains the registry snapshot hash |
| C13 | Risk tiers High ≥ 80, Medium 30–79, Low < 30 rank the queue only; **no double counting on REVOKED** | Playbook §5B, §8 | RISK-v1 | Revoked cases with several failures to test single counting |
| C14 | Confidence < 0.75, conflicting data or outage → human review / `UNKNOWN`; never a silent pass | Core thesis | Status policy | Every risky group includes an outage and a conflict variant |
| C15 | No medical advice; decision support only | Guardrail 4 | UI / report text | Report text checked for dosage or recommendation wording |
| C16 | No live scraping of Shopee, Lazada or Thai FDA; synthetic data only; no false affiliation | Guardrails 2–3 | Registry adapter | All references fictional; no real brand names |
| C17 | PDPA by default: minimised evidence, hashes, no personal data | Judge focus (privacy) | Evidence storage | Seller records carry no personal identifiers |
| C18 | Illustrative economics: THB 1,990/month brand tier, THB 850 AOV, conversion, gross margin and LTV:CAC are **assumptions** | Playbook §8 | Pitch only | Never mixed into test data or shown as measured results |

### 3.6 High-risk product groups

Every product, number and shop below is fictional. Claim phrases are examples of what the rules must catch; they are not health statements.

| Group | Why it is high risk | Typical prohibited claims (TH / EN) | Euphemisms (LLM-dependent) | Risk signals | Rules | Evidence to request |
| --- | --- | --- | --- | --- | --- | --- |
| G1 Weight loss / slimming | Most common illegal ads; undeclared drug substances are a known risk | ลดน้ำหนักทันที, ลด 10 กก. ใน 2 สัปดาห์, เผาผลาญไขมันถาวร / instant weight loss | "หุ่นปัง ไม่ต้องคุม", "ดื้อยาก็ลง" | New shop, very low price, before/after wording | R-01, R-03 | สบ.5, COA, standards certificate |
| G2 Blood sugar / diabetes | Patients may replace medicine | รักษาเบาหวาน, ย้อนกลับเบาหวาน, ลดน้ำตาลแทนยา / reverses diabetes | "คุมน้ำตาลได้เองไม่ต้องพึ่งหมอ" | "ทานแทนยา", doctor-endorsement wording | R-03, R-02 | สบ.5, label |
| G3 Liver detox / cancer | Life-threatening disease claims | ล้างพิษตับ, ฟื้นฟูตับอักเสบ, ป้องกันมะเร็ง / prevents cancer | "ดูแลตับจากโรคร้าย" | Imported, no Thai label | R-03, R-01 | สบ.5, Thai label |
| G4 Sexual enhancement | High adulteration risk; often drug-like claims | เพิ่มสมรรถภาพทันที, รักษาหย่อนสมรรถภาพ / cures ED | "ปลุกความเป็นชาย 100%" | Discreet shipping wording, no registration shown | R-02, R-03, R-01 | COA, สบ.5 |
| G5 Immunity / viral | Spikes during outbreaks | ป้องกันไวรัส, ฆ่าเชื้อโควิด / prevents infection | "เกราะป้องกันร่างกาย" | Trend keywords | R-03 | สบ.5 |
| G6 Joint / bone (elderly) | Vulnerable buyers | รักษาข้อเสื่อม, หายปวดเข่าถาวร / cures arthritis | "เดินได้เหมือนวัยหนุ่ม" | Testimonial-heavy copy | R-03 | สบ.5, label |
| G7 Whitening / anti-ageing (cosmetic boundary) | Category confusion between cosmetic and supplement | ขาวถาวรใน 7 วัน, ย้อนวัย / reverses ageing | "ผิวใหม่ใน 3 วัน" | Supplement registered, cosmetic claims | R-02, R-03 | สบ.5 or cosmetic notification |
| G8 Children's growth | Vulnerable buyers | เพิ่มความสูงแน่นอน, รักษาสมาธิสั้น / cures ADHD | "สูงทันเพื่อน" | Parent-targeted wording | R-03 | สบ.5, COA (ingredient ceilings) |
| G9 Sleep / stress | Borderline drug claims | รักษาโรคนอนไม่หลับ, หายเครียดถาวร / treats insomnia | "หลับลึกแทนยานอนหลับ" | "แทนยา" wording | R-03, R-02 | สบ.5 |
| G10 Herbal / traditional | Drug-vs-food registration boundary | รักษาความดัน, ขับนิ่ว / treats hypertension | "สูตรโบราณหายทุกโรค" | Traditional-medicine number on a food listing | R-02, R-01 | Registration certificate |
| G11 Sports / muscle | Ingredient ceilings and undeclared stimulants | เพิ่มกล้ามทันที / instant muscle | "ฟิตเร็วไม่ต้องเล่นหนัก" | Imported, foreign label only | R-03, R-05 (COA) | COA, Thai label |
| G12 Imported / cross-border | Foreign registration only; no Thai number | — | — | Foreign label, no Thai number | R-01 (missing), C7 | Thai registration, Thai label |
| G13 Low-risk control (vitamins, fibre, fish oil) | Needed to measure false positives | None | — | Long-established shop | All pass | — |

### 3.7 Extended registry fixtures (synthetic)

The reserved synthetic range uses the middle block `9xxxx`. Check that no number exists in the public registry before use.

| Ref | Product | Holder | Category | Status | Permit (ฆอ.) | Group |
| --- | --- | --- | --- | --- | --- | --- |
| `10-1-90007-5-0007` | Demo Slim Fibre | Demo Nutrition | supplement | ACTIVE | DEMO-AD-SLIM | G1 |
| `10-1-90008-5-0008` | Demo Bitter Melon | Demo Herbal Foods | supplement | ACTIVE | DEMO-AD-MELON | G2 |
| `10-1-90009-5-0009` | Demo Milk Thistle | Demo Import Co | supplement | ACTIVE | — | G3 |
| `10-1-90010-5-0010` | Demo Ginseng Plus | Demo Vital | supplement | REVOKED | — | G4 |
| `10-1-90011-5-0011` | Demo Vitamin C 1000 | Demo Brand | supplement | ACTIVE | DEMO-AD-VITC | G5 / G13 |
| `10-1-90012-5-0012` | Demo Collagen Joint | Demo Senior Care | supplement | ACTIVE | DEMO-AD-JOINT | G6 |
| `10-1-90013-5-0013` | Demo Glow Drink | Demo Beauty Foods | supplement | ACTIVE | DEMO-AD-GLOW | G7 |
| `10-1-90014-5-0014` | Demo Kids Calcium | Demo Family | supplement | ACTIVE | DEMO-AD-KIDS | G8 |
| `10-1-90015-5-0015` | Demo Sleep Tea | Demo Herbal Foods | supplement | EXPIRED | — | G9 |
| `TM-90016` (traditional medicine, synthetic) | Demo Herbal Tonic | Demo Traditional | drug | ACTIVE | — | G10 |
| `10-1-90017-5-0017` | Demo Whey Booster | Demo Sports | supplement | ACTIVE | — | G11 |
| `10-1-90018-5-0018` | Demo Oat Fibre | Demo Brand | supplement | ACTIVE | DEMO-AD-OAT | G13 |

### 3.8 Extended listing fixtures (L15–L40)

| ID | Group | Scenario | Key input | Expected | Rules failing | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| L15 | G1 | Borrowed slim number, new shop | ref 90007, name "Super Slim X", holder "Other Co", "ลดน้ำหนักทันที" | `PENDING` | R-01, R-03 | Shop age 3 days |
| L16 | G1 | Correct identity, extreme claim | ref 90007 exact, "ลด 10 กก. ใน 2 สัปดาห์" | `DENIED` | R-03 | |
| L17 | G1 | Compliant slim fibre | ref 90007, "ใยอาหาร ควบคู่การออกกำลังกาย" + term | `APPROVED` | — | Negative control |
| L18 | G2 | Diabetes reversal | ref 90008, "ย้อนกลับเบาหวาน ทานแทนยาได้" | `DENIED` | R-03 | Includes "แทนยา" |
| L19 | G2 | Mixed language | "Bitter melon cures diabetes ลดน้ำตาล" | `DENIED` | R-03 | EN + TH |
| L20 | G3 | Imported, no Thai term | ref 90009, English-only copy, "prevents liver cancer" | `DENIED` | R-03 (claim + term) | |
| L21 | G4 | Revoked number | ref 90010, enhancement claim | `DENIED` | R-01 (+R-03) | Check risk counted once (C13) |
| L22 | G4 | No registration shown | ref empty/missing | `UNKNOWN` | — | Human review |
| L23 | G5 | Outbreak claim | ref 90011, "ป้องกันไวรัส" | `DENIED` | R-03 | |
| L24 | G5 / G13 | Plain vitamin C | ref 90011, "วิตามินซีมีส่วนช่วยในการทำงานของระบบภูมิคุ้มกัน" + term | `APPROVED` | — | Must not flag "ภูมิคุ้มกัน" |
| L25 | G6 | Arthritis cure | ref 90012, "รักษาข้อเสื่อม หายปวดเข่าถาวร" | `DENIED` | R-03 | |
| L26 | G7 | Supplement with whitening claim | ref 90013, "ขาวถาวรใน 7 วัน ย้อนวัย" | `DENIED` | R-02, R-03 | Category boundary |
| L27 | G7 | Cosmetic "ป้องกันแสงแดด" | cosmetic fixture, "ป้องกันแสงแดด SPF50" | `APPROVED` | — | Negative control (B1) |
| L28 | G8 | Kids height guarantee | ref 90014, "เพิ่มความสูงแน่นอน" | `DENIED` | R-03 | Vulnerable group |
| L29 | G9 | Expired number | ref 90015 | `DENIED` | R-01 | EXPIRED status |
| L30 | G10 | Drug-registered tonic sold as food | `TM-90016`, category supplement | `DENIED` | R-02 | Registry category = drug |
| L31 | G11 | Imported booster, foreign label | ref 90017, English-only | `DENIED` | R-03 (term) | |
| L32 | G12 | Foreign registration only | ref "FDA-US-XXXX" | `UNKNOWN` | — | Unsupported registry → human |
| L33 | G13 | Oat fibre clean | ref 90018 + term | `APPROVED` | — | |
| L34 | G13 | Same number as L33, second shop, same identity | ref 90018, shop "Outlet" | `APPROVED` | — | Reuse by a legitimate reseller is allowed |
| L35 | G1 | Same number, different holder | ref 90018, holder "Unknown Trader" | `PENDING` | R-01 | Borrowed number (C1) |
| L36 | any | Format with spaces | `10 1 90018 5 0018` | Normalise → as L33, or `UNKNOWN` per policy | R-01 format | Decide and document |
| L37 | any | Letters in number | `10-1-9OO18-5-0018` (letter O) | `UNKNOWN` / `DENIED` per policy | R-01 format | Typo-squatting |
| L38 | G2 | Permit expired | ref 90008, permit marked expired | `PENDING` | R-04 | |
| L39 | G6 | Permit missing on an ad-heavy listing | ref 90012, no permit | `PENDING` or skip per policy | R-04 | Decide and document |
| L40 | any | Outage on a risky listing | L18 + outage | `UNKNOWN` | — | Outage overrides; never `APPROVED` |

### 3.9 Extended evidence fixtures (E5–E16)

| ID | Type | Content (declared fields, synthetic bytes) | Expected R-05 | Consideration |
| --- | --- | --- | --- | --- |
| E5 | Front-label photo | Name and number match; Thai term present | pass | C7, C10 |
| E6 | Front-label photo | Thai term missing | fail | C7 |
| E7 | สบ.5 certificate | Matches registry | pass | C2 |
| E8 | สบ.5 certificate | Different holder | fail → `PENDING`, 0.60 | C1 |
| E9 | Standards certificate | GMP | pass | C9 |
| E10 | Standards certificate | ISO 22000 | pass | C9 |
| E11 | Standards certificate | **ISO 9001 only** | fail | C9 |
| E12 | Standards certificate | Expired date | fail | C9 |
| E13 | Lab COA | Ingredient below the synthetic ceiling | pass (*planned*) | C6 |
| E14 | Lab COA | Ingredient above the synthetic ceiling | fail → human review (*planned*) | C6 |
| E15 | Ad permit (ฆอ.) | Permit ≠ record | fail | C8 |
| E16 | Any | Same file uploaded for two different listings | Same hash flagged for the reviewer | Fraud signal |

### 3.10 Diversity coverage targets (acceptance for the dataset)

| Dimension | Minimum coverage |
| --- | --- |
| Each status (`APPROVED`, `PENDING`, `DENIED`, `UNKNOWN`) | ≥ 5 listings |
| Each rule R-01 … R-05 failing | ≥ 3 listings |
| Each high-risk group G1–G12 | ≥ 1 failing + G13 ≥ 4 passing controls |
| Language | Thai only, English only, mixed |
| Thai negatives (must pass) | ≥ 5 phrases (หายใจ, ไม่หาย, ป้องกันแสงแดด, ภูมิคุ้มกัน, ควบคู่การออกกำลังกาย) |
| Registration status | ACTIVE, REVOKED, EXPIRED, missing, malformed, foreign |
| Category boundary | supplement ↔ drug, supplement ↔ cosmetic |
| Borrowed / shared numbers | Legitimate reseller (pass) vs different holder (fail) |
| Seller signals | Shop age 1 day … 6 years (risk ranking only) |
| Failure modes | Outage, tamper, stale `chain_hash`, empty file |
| Euphemisms | Tagged `llm_dependent=true`; excluded from deterministic pass/fail assertions |

**Dataset tests to add:**
1. A coverage test that fails if any target above drops below its minimum.
2. A fixture-integrity test: every listing reference exists in the registry or is intentionally missing/foreign, and every registration number in the 13-digit format falls in the reserved `9xxxx` block.
3. The invariant across all listings × toggles: no `APPROVED` with a failing rule or confidence < 0.75.

### 3.11 Data handling rules for the dataset

- Use fictional brands (`Demo …`) and the reserved number block only. Never use a real product, shop, registration or permit.
- Claim phrases appear only as rule test inputs. Report text never repeats them as advice.
- Tag each listing with `group`, `language`, `expected_status`, `expected_failures`, `llm_dependent` so that the dashboard and the accuracy table (§4.3) can aggregate them.
- Keep economics (C18) out of fixtures.

---

## 4. Rule validation specification

### 4.1 Per-rule test cases

| Rule | Check | Positive case (should fail rule) | Negative case (should pass) | Code at `5c29e82` |
| --- | --- | --- | --- | --- |
| R-01 | Format `XX-X-XXXXX-X-XXXX` | L8 malformed | `10-1-90001-5-0001` | ❌ no format check yet |
| R-01 | Exists | L5 | L2 | ✅ |
| R-01 | Active (not REVOKED/EXPIRED) | L3, L9 | L2 | ✅ for REVOKED; EXPIRED needs a fixture |
| R-01 | Name and holder match | L1 | L2 | ✅ → `PENDING` |
| R-02 | Registered category versus claims | L10 | L2 | ⚠️ checks listing category only, not claims |
| R-03 | Thai prohibited phrases | รักษาโรค, หายขาด, ป้องกันโรค, ย้อนกลับเบาหวาน | หายใจ, ไม่หาย, ป้องกันแสงแดด | ✅ phrase list |
| R-03 | English claims | treat, cure, prevent, reverse | "prevention tips" | ✅ |
| R-03 | Fast-result / weight-loss claims | ลดน้ำหนักทันที, เห็นผลใน 3 วัน | "ควบคู่การออกกำลังกาย" | ❌ phrases missing from `claim_rules.json` |
| R-03 | Required supplement term | L11 | L2 | ✅ |
| R-04 | Permit equals the record | L7 | L6 | ✅ |
| R-05 | Evidence matches the registry | E1 | E2 | ✅ declared fields |

### 4.2 Status and confidence matrix (must hold for every case)

| Condition | Status | Confidence | `human_review_required` |
| --- | --- | --- | --- |
| All applicable rules pass | `APPROVED` | 1.0 | false |
| Mismatch awaiting evidence, permit conflict, R-05 fail | `PENDING` | 0.60 | true |
| Revoked/expired, prohibited claim, confirmed mismatch | `DENIED` | 1.0 | false |
| Outage, missing reference, unmapped category | `UNKNOWN` | 0.0 | true |
| Any confidence < 0.75 | never `APPROVED` | — | true |

**Invariant test:** for every fixture and toggle combination, `status == APPROVED ⇒ confidence ≥ 0.75 and no rule failed`.

### 4.3 Accuracy table for the Data Science judges

Run all fixtures and report:

| Metric | Formula | Target on fixtures |
| --- | --- | --- |
| R-03 precision | TP / (TP + FP) | 1.0 (L12 is the FP guard) |
| R-03 recall | TP / (TP + FN) | 1.0 on the listed phrases |
| Silent passes | `APPROVED` while any rule fails or confidence < 0.75 | **0** |

State clearly that these numbers come from a small synthetic fixture set, not field accuracy.

---

## 5. Risk score (RISK-v1) verification

Policy: `unavailable 40`; failed rule weights R-01 30, R-02 10, R-03 25, R-04 20, R-05 20; High ≥ 80, Medium ≥ 30.

| Check | Expected |
| --- | --- |
| Risk never changes a status | Same status with risk weights set to 0 and to the defaults |
| Queue order | Sorted by score descending, then ID |
| Policy traceability | Trace contains `risk_policy` = SHA-256 of `risk_policy.json` |
| No double counting | L3 (revoked) counts R-01 once (the playbook flagged double counting) |
| Labelled illustrative | Report shows "Illustrative demo weights, pending platform calibration" |

---

## 6. API contract tests

| Endpoint | Test | Expected |
| --- | --- | --- |
| `POST /v1/verifications` | Valid L2 | 201, `Location` header, `registry_source=synthetic` |
| | Empty field / over 200 characters | 422 |
| `GET /v1/verifications/{id}` | Existing / random UUID | 200 / 404 |
| | After app restart | Same result (SQLite) |
| `POST …/evidence` | E1 on L1 | Trace has SHA-256; R-05 fail; `PENDING` |
| `POST …/recheck` | After a fix | Trace appended; earlier entries unchanged |
| `GET /v1/review-queue` | Mixed fixtures | Only human-review cases, ranked by risk |
| `POST …/review` | Correct `chain_hash` | Status updated, `reviewer_*` reason |
| | Stale `chain_hash` | **409** |
| `GET /v1/audit/{id}` | Untouched / after tamper | `valid=true` / `valid=false, broken_at=N` |
| `GET /v1/reports/{id}` | Any | Includes listing, evidence, audit, risk, `synthetic=true` |
| `GET /v1/widgets/{id}` | Any | Badge `{status, label_th, label_en, report_url}` |
| `POST /v1/listings/suggest-copy` | L4 | Template passes R-03; no status set until resubmitted |
| `POST /v1/products/compare` | 2 IDs | Both reports, `synthetic=true` |
| `POST /demo/tamper/{id}` | Demo app only | Breaks the chain; **not** present on the core API |
| Password gate | No or wrong credentials | 401 on `/`, `/v1/*`, `/docs`; fails closed if the env var is missing |

---

## 7. Safety and responsible-AI tests (Kevin Chan, Varis, Dr. Napat)

| # | Property | Test | Expected |
| --- | --- | --- | --- |
| S1 | No silent pass on outage | L14 | `UNKNOWN`, review required, zero approvals in a dashboard outage run |
| S2 | Grounding guard | Fake LLM returns a phrase absent from the listing | Phrase dropped |
| S3 | LLM never sets a status | Fake LLM returns `"status":"APPROVED"` | Ignored |
| S4 | Works without an API key | Unset `OPENAI_API_KEY` | Deterministic R-03 only; tests pass offline |
| S5 | Tamper evidence | Edit one stored trace entry | Audit invalid at that index |
| S6 | Stale reviewer action | Old `chain_hash` | 409 |
| S7 | No medical advice | Grep user-facing strings | No dosage or "take this" text |
| S8 | Synthetic disclaimer | Every screen and report | Visible |
| S9 | Secrets | `git log -p` grep for key/password patterns | None |
| S10 | PDPA minimisation | Evidence storage | Hash plus declared fields only; no raw personal data |
| S11 | Demo flags isolated | Outage and tamper controls | Labelled demo-only; cannot produce `APPROVED` |

---

## 8. Live demo run sheet (6-minute pitch, hosted demo)

Run on **`https://trustcart-bluescreen-demo.vercel.app`**, not the old `trustcart-bluescreen.vercel.app`. Rehearse twice and time each run.

| Time | Path | Steps | Expected on screen | ✔ |
| --- | --- | --- | --- | --- |
| 0:00–1:00 | Hook | "A real number ≠ a real product" | Problem slide, 121,494 ads closed (cited) | ☐ |
| 1:00–2:30 | **D1 L1 loop** | Submit L1 → upload E1 → recheck → reviewer denies | `PENDING` (R-01, R-03) → R-05 fail 0.60 → queue → `DENIED`, trace grows | ☐ |
| 2:30–3:15 | **D2 Tamper** | Tamper L1 step → audit | `valid=false`, `broken_at` shown | ☐ |
| 3:15–3:45 | **D3 Outage** | Toggle offline → submit L2 | `UNKNOWN`, 0 approvals | ☐ |
| 3:45–4:15 | **D4 Copy fix** | L4 → suggest-copy → resubmit | `DENIED` → `APPROVED` | ☐ |
| 4:15–5:00 | Codex | `AGENTS.md`, `[codex]` count, tests | Numbers taken at code freeze | ☐ |
| 5:00–6:00 | Value + ask | 3 users, APIaaS, pilot ask | Pricing labelled illustrative | ☐ |

Optional, only if time allows: **D5 L7 permit conflict → `PENDING`**.

**Backup:** a screen recording of D1–D4 on the hosted demo, plus screenshots of each expected state.

**Latency:** record the p50 and max of `POST /v1/verifications` over 20 calls on the hosted demo, and quote the measured value only.

---

## 9. Mock-up screen specification

### 9.0 Agency / regulator view (primary customer)
| Element | Content | Verify |
| --- | --- | --- |
| KPI tiles | Total checks, % `APPROVED` / `PENDING` / `DENIED` / `UNKNOWN`, silent passes (must be 0) | Matches the aggregate of stored verifications |
| Breakdown | Failing rule × category × day | Totals reconcile with the tiles |
| Top claim phrases | Most frequent R-03 matches | Phrases come from `rule_results` evidence |
| Audit integrity | % of cases with `valid=true` | Equals per-case `/v1/audit` results |
| Export | Case report JSON | Hash chain reproducible |
| Disclaimer | Synthetic, not an official result | Always visible |

### 9.1 Shopper view
| Element | Content | Verify |
| --- | --- | --- |
| Trust Badge | Status colour plus Thai/English label | Matches `/v1/widgets/{id}` |
| Reason line | Plain-language reason | No medical advice |
| Report link | Opens `/v1/reports/{id}` | Synthetic disclaimer shown |

### 9.2 Seller view
| Element | Content | Verify |
| --- | --- | --- |
| Listing form | ref, name, holder, category, title, description, permit | Validation messages for empty or overlong fields |
| Rule results | R-01–R-05, pass/fail/skip, TH/EN reasons | Matches the API |
| Evidence upload | Label, certificate | SHA-256 shown after upload |
| Copy suggestion | Template text | Passes R-03 |

### 9.3 Reviewer view
| Element | Content | Verify |
| --- | --- | --- |
| Queue | Ranked by risk, tier High/Medium/Low | Order matches §5 |
| Case detail | Listing, rule results, evidence hashes, trace | Audit validity badge |
| Decision | Approve/Deny + note | Sends `chain_hash`; 409 on stale |
| Demo controls | Offline, tamper, reset | Labelled demo-only |

---

## 10. Business and impact figures (Tadcha, Natwarat, Dr. Napat)

| Figure | Value | Label | Verify |
| --- | --- | --- | --- |
| Illegal health ads closed | 121,494 (2023–Apr 2026) | Cited: Thai FDA, 30 Apr 2026 | Source link opens and the figure matches |
| Listings removed / legal cases | 9,454 / 134 (Sep 2023–Sep 2024) | Cited: Tilleke & Gibbins 2025 | Same |
| ETDA 1212 complaints | 39,112 in 2025, 36.4% online shopping | Cited | Same |
| Supplement market | ≈ US$2.7B | Cited estimate | Same |
| Pricing: SME Free 20/mo, Brand THB 1,990/mo | — | **Illustrative assumption** | Labelled on the slide |
| Cost per verification | Deterministic path: no LLM tokens | Measured | Count LLM calls per request in tests |
| Takedowns avoided, conversion lift | — | **Pilot hypothesis**, not measured | Never shown as a result |

---

## 11. Q&A answer cards with verifiable backing

| # | Likely question (who) | 15-second answer | Backing to show |
| --- | --- | --- | --- |
| Q1 | What did you build today? (all) | Everything in the repository after 10:25; earlier work was planning docs, declared | `git log` timeline; README Declarations |
| Q2 | Does it wrongly flag honest sellers? (Varis) | A mismatch is `PENDING` with an evidence request, never an automatic takedown | D1 |
| Q3 | False-positive rate? (Panthon) | Fixture precision 1.0 with Thai negative tests; field accuracy is not measured yet | §4.3, L12 |
| Q4 | How does Codex help? (Ambassadors) | `AGENTS.md` safety rules, test-first tasks, N `[codex]` commits | `git log` count |
| Q5 | Hallucination? (Kevin) | The LLM only extracts; phrases not literally in the listing are dropped; rules decide | S2, S3 |
| Q6 | Cost at scale? (Tadcha, Kevin) | Most checks are deterministic with no token cost; the LLM is optional | §10 |
| Q7 | Real FDA data? (all) | No; synthetic data behind a swappable adapter; FDA announced API integration on 9 Oct 2025 | Recheck slide |
| Q8 | Why not keywords or an LLM auto-approver? (Shawisa) | Keywords lack evidence and misfire on Thai; an LLM cannot carry liability; we separate the two and add human review | §4, §7 |
| Q9 | Who pays? Moat? (Dr. Napat) | Marketplaces through the API; the moat is reviewer-labelled decisions plus versioned rule packs (planned) | Roadmap slide |
| Q10 | Does it get better as it runs? (Dir. 01) | Reviewer outcomes are logged and hash-chained for policy recalibration: planned, not live | Trace review entries |
| Q11 | Other SEA markets? (Tadcha, Natwarat) | Swap the registry adapter and rule pack JSON per country (HSA, BPOM, NPRA, VFA) | `registry.py`, `claim_rules.json` |
| Q12 | Why OAuth if the demo uses Basic auth? (Kevin) | Basic auth gates the demo; OAuth client credentials with scopes is roadmap | README |
| Q13 | Why government and agencies first? (Tadcha, Dr. Napat) | They set the rules and fund adoption; a regulator-aligned rule pack makes every platform and seller follow one standard | §2A segments |
| Q14 | Isn't B2G too slow? (Dr. Napat) | Pilot with a platform + regulator sandbox first; agencies and brands pay early | §2A risks |
| Q15 | What does a regulator actually see? (Kevin, Theerayut) | An aggregate dashboard and verifiable audit records, with no personal data | Agency dashboard mock-up |

---

## 12. Hackathon rule compliance checklist

| Rule (official PDF) | Check | ✔ |
| --- | --- | --- |
| All work on site | First commit at 10:44 (after 10:25); no copied code (team confirms) | ☐ |
| New public repository | Repository URL returns 200 without login | ☐ |
| Link to the earlier repository | README + form; the earlier repository currently returns **404** | ☐ |
| State what was built today | README Declarations current | ☐ |
| One submission by 17:00 | Form submitted by 16:45 | ☐ |
| Writeup covers problem, solution, direction, Codex | README sections present | ☐ |
| Demo link | Hosted demo works; password given in the form only | ☐ |
| Declarations | OSS list (FastAPI, Uvicorn, Pydantic, pytest) + earlier project | ☐ |

---

## 13. Gaps found while writing this plan (at `5c29e82`)

| ID | Gap | Impact | Suggested fix |
| --- | --- | --- | --- |
| G1 | No R-01 13-digit format check; fixtures use `DEMO-*` | The deck promises a format check | Add a synthetic format and check (§3.1, L8) |
| G2 | `ลดน้ำหนักทันที`, `เห็นผลใน 3 วัน` missing from `claim_rules.json` | The playbook lists them as R-03 examples | Add phrases + L13 test |
| G3 | R-02 does not compare claims with the registered category | Drug claims on a supplement are not caught by R-02 | L10 test + rule |
| G4 | EXPIRED status has no fixture | R-01 "active" is only tested with REVOKED | Add L9 |
| G5 | Slides still reference the old demo URL, the 3-minute pitch and outdated judges | Rule risk and credibility | Update slides (§0) |
| G6 | "Adaptive" (Direction 01) is not live | Judges may ask | Present as planned (Q10) |
| G7 | No MoPH 448 ingredient-ceiling check (Lab COA) | C6 cases E13/E14 cannot pass yet | Add synthetic ceilings to a rule pack, or mark as roadmap |
| G8 | No standards-certificate check (ISO 9001 alone rejected) | E9–E12 | Extend R-05 declared fields |
| G9 | No expired-permit or missing-permit policy | L38, L39 | Decide the policy, then add tests |
| G10 | Unsupported foreign registry not distinguished from missing | L32 | Add reason `unsupported_registry` → `UNKNOWN` |
| G11 | Duplicate evidence hash across listings not flagged | E16 | Add a reviewer-queue signal (risk only, not status) |

---

## 14. Sign-off before 16:45

| Item | Owner | ✔ |
| --- | --- | --- |
| `pytest -q` passes; count written in README | Big | ☐ |
| Accuracy table (§4.3) produced from fixtures | Ju | ☐ |
| D1–D4 pass on the hosted demo, timed | Thomaz | ☐ |
| Backup video recorded | Fen | ☐ |
| Slides corrected (URL, judges, timing, illustrative labels) | Fen | ☐ |
| Declarations and earlier-repository link resolved | Team lead | ☐ |
| Google Form submitted | Team lead | ☐ |
