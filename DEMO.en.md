# TrustCart — Demo Script & Judge Test Cases (English)

For the current rehearsal, use the [judge Q&A and run sheet](docs/JUDGE_QA.md). This script records the earlier design and includes roadmap scenarios.

**One line to remember:** A real registration number is not a real product.

Every team will build "check the FDA number + check the ad wording". TrustCart is different because it checks **who the number belongs to (R-01)**,
has an **AI agent that asks the seller for evidence by itself**, keeps a **record that proves it was not altered (hash chain)**, and ships as an **APIaaS plug-in for Shopee**.

Live: https://trustcart-bluescreen.vercel.app (login required; the password is in the Vercel Environment Variables)
All data is **synthetic** · results are not a Thai FDA certification · the integration concept has no official affiliation with Shopee

## Before going on stage (2 minutes)
1. Open the site in an incognito window → log in
2. Press ↺ (reset) to restore the starting data
3. Check that the registry button is 🟢 and the language is the one you will present in
4. Afterwards: press 🚪 to log out (the session also expires after 8 hours)

## Statuses
| Status | Meaning |
|---|---|
| Approved | Passes every required rule |
| Pending | Waiting for evidence · waiting for a copy fix · waiting for a reviewer |
| Denied | A key rule failed (number not found or revoked, prohibited claim, or confirmed by a reviewer) |
| Unknown | The system could not check (registry not responding); this does not mean the product failed |

> Number belongs to another product → **Pending (evidence requested) first**, then Denied once evidence or a reviewer confirms it. This is fair to sellers who mistyped a number, and it shows the agent loop.

Rules: R-01 Registration identity · R-02 Product category · R-03 Advertising claims · R-04 Advertising permit · R-05 Seller evidence

## Demo flow, 3–4 minutes
| # | Tab | Action | What the judges see |
|---|---|---|---|
| 1 | Shopper | Open L1 "Turmeric reverses diabetes" | Card **13-1-02954-5-0088 ≠ OfficeCare** + R-01…R-04 table + highlighted prohibited words |
| 2 | Shopper | Open the agent trace | Extract text → registry lookup → rules → decision → risk score, each with a hash |
| 3 | Top bar | Press English / ภาษาไทย | The whole page switches language with no leftover words from the other language |
| 4 | Seller | Submit evidence for L1 | R-05 fails → Pending · waiting for a reviewer (confidence 0.6) |
| 5 | Seller | L4 "Use suggested copy" | Denied → **Approved** immediately (in both languages) |
| 6 | Shopper | L7 OceanHealth Outlet | R-04 advertising permit conflict → Pending · reviewer |
| 7 | Top bar | Switch registry 🟢 → 🔴 | Every listing becomes **Unknown**; nothing passes silently (switch back to 🟢) |
| 8 | Reviewer | Look back at L1 | **Risk score breakdown** by factor + every step recorded |
| 9 | Reviewer | Verify audit, simulate tampering, verify saved audit again | The simulated copy fails the audit. The saved chain stays valid. |
| 10 | API plug-in | ▶ Call the real API | JSON matching the Tech document + revenue table (APIaaS for Shopee) |
| 11 | `/docs` | Swagger | Full `/v1` API |

## Risk score (orders reviewer work only; never changes the verdict)
Policy `backend/data/risk_policy.json` (RISK-v1; its version and hash are recorded in every report):
not found / revoked +100 · high-risk claim group +25 per group · number belongs to another product +30 · registry not responding +40 ·
conflicting permit +20 · shop open less than 60 days +10 · sales +1 per 500 units (max 20) · Approved = 0
Tiers: ≥80 high · 30–79 medium · <30 low. **The weights are assumptions and must be calibrated against real Thai FDA and platform data.**

| Listing | Score | Breakdown |
|---|---|---|
| L5 Liver Detox (number not found) | 160 | 100 + 50 + 10 |
| L3 FastFirm (revoked) | 136 | 100 + 25 + 10 + 1 |
| L1 Turmeric (borrowed number) | 119 | 75 + 30 + 10 + 4 |
| L4 SlimDee | 60 | 50 + 10 |
| L7 conflicting permit | 31 | 20 + 10 + 1 |
| L2, L6 | 0 | Approved |

## Test-case matrix (`pytest -q` → 20 passed)
| Case | Listing | Expected | Test |
|---|---|---|---|
| Clean product | L2, L6 | Approved | `test_clean_listings_approved` |
| Registration number mismatch | L1 | Pending(evidence) | `test_borrowed_number_pending_evidence` |
| Evidence does not match | L1 + evidence | Pending(human) | `test_mismatched_evidence_escalates_to_human` |
| Ad copy fails → fixed and passes | L4 | Denied → Approved | `test_prohibited_claim_denied_then_fix_approved` |
| Conflicting data | L7 | Pending(human), R-04 FAIL | `test_conflicting_permit_goes_to_human` |
| Registry unavailable | All | Unknown | `test_registry_outage_is_unknown_never_approved` |
| Revoked / not found | L3, L5 | Denied | `test_revoked_and_unknown_number_denied` |
| AI extracts hidden claims + guard against invented text | API | AI may only add phrases that really appear | `test_ai_extraction_...`, `test_llm_grounding_guard_...` |
| Risk ordering + score breakdown | queue | Correct order, sums match, no double counting | `test_queue_is_risk_ranked` |
| Log tampering detected | any | chain broken | `test_tamper_detected` |
| No language mixing | All | EN has no Thai / TH has no English | `test_no_language_mixing_in_reports` |
| Password + logout | gate | 401 → 200 → 401 | `test_password_gate` |
| API matches the Tech document | API | Complete shape | `test_response_matches_doc_shape` |
| OAuth 2.0 + scope + caller in the log | API | 401/403/200 by permission | `test_oauth_client_credentials_flow_and_audit` |
| Forged / expired token | API | 401 | `test_oauth_rejects_tampered_and_expired_tokens` |

## Questions judges are likely to ask
- **"Does the AI decide?"** → No. The AI only extracts text, and can only add phrases that literally appear in the listing; the rules engine decides.
- **"What if the Thai FDA API is down?"** → Unknown + sent to a reviewer (demo step 7).
- **"Where does the risk score come from?"** → An explainable additive formula, version RISK-v1, kept in a config file and written to the trace every time; used only to order work.
- **"Why would Shopee buy it?"** → It checks at listing time instead of removing after publication (Thai FDA closed 121,494 illegal ads; Lazada removed 9,454 listings).
- **"Can it use real data?"** → It uses a mock registry today; the Thai FDA announced connecting its database to platforms through an API (9 Oct 2025). What we ask for is a sandbox.

## Limitations
Mock registry · legal wording must be checked with the Thai FDA · risk weights are not yet calibrated on real data · data is kept in memory (resets when the server restarts) ·
user-typed text is translated automatically only when `OPENAI_API_KEY` is set · not medical advice
