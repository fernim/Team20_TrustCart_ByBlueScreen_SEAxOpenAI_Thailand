# Bugs and Risks

Found while reviewing commit `31ef16b`. Each item says how it was confirmed.

| ID | Severity | Status |
| --- | --- | --- |
| B1 | High | Fixed |
| B2 | Medium | Fixed |
| B3 | Low | Fixed |
| B4 | Low | Fixed |
| B5 | Low | Fixed |
| B6 | High | Open |
| B7 | Medium | Fixed |
| B8 | Medium | Fixed |
| B9 | Medium | Fixed |
| B10 | Low | Fixed |
| B11 | Low | Open (Roadmap) |
| B12 | High | Fixed |

B6 to B11 were found while reviewing `224c22a`.

---

## B1. R-03 false positives on common Thai substrings (High)

**File:** `backend/app/rules.py` `CLAIM_PATTERN`

**Confirmed by running `advertising_claims`:**

| Input | Matched | Expected |
| --- | --- | --- |
| `หายใจสะดวก` ("easy breathing") | `หาย` | No match |
| `สินค้าไม่หาย ส่งไว` ("item not lost, fast shipping") | `หาย` | No match |
| `ป้องกันแสงแดด SPF50` ("sun protection") | `ป้องกัน` | No match for cosmetics |

**Cause:** Thai has no spaces between words, so `\b` does not apply. Short substrings such as `หาย`, `ย้อน`, and `ป้องกัน` match inside ordinary words.

**Impact:** a judge who types a normal phrase gets a false `DENIED`, which undermines the trust claim.

**Fix:** match claim phrases rather than single words, for example `รักษาโรค`, `รักษา` + disease name, `หายขาด`, `ป้องกันโรค`, `ป้องกันมะเร็ง`, `ย้อนวัย`, `ย้อนกลับเบาหวาน`. Move the list to `backend/data/claim_rules.json`. Add **negative** test cases (the three inputs above) and positive ones (`ย้อนกลับเบาหวาน`, `รักษาโรคเบาหวาน`).

---

## B2. Callers can set demo flags on the public API (Medium)

**File:** `backend/app/main.py` `Listing`: `simulate_registry_outage`, `advertising_permit_conflict`

**Issue:** both flags are fields in the `POST /v1/verifications` request.
- `simulate_registry_outage` is safe, because it can only produce `UNKNOWN`.
- `advertising_permit_conflict` means R-04 relies on the seller declaring a conflict, so R-04 does not verify anything itself. A judge reading `/docs` may ask about it.

**Fix:** move the permit number into the fixture and compare `listing.advertising_permit` with `record.advertising_permit`. Expose the outage through a demo route (`/demo/registry/{state}`) or keep it limited to the demo app. At minimum, mark the fields `demo-only` in the schema description.

---

## B3. R-01 recorded twice in the trace (Low)

**File:** `backend/app/main.py`: `evaluate()` calls `trace.add("R-01", ...)`, and `evaluate_rules()` adds R-01 again as a rule result.

**Impact:** the same step appears twice when the trace is shown to judges.

**Fix:** rename the step in `evaluate()` to `registry_identity`, or record only the step from `evaluate_rules()`. Update the tests that check step names.

---

## B4. L3 fixture data contradicts itself (Low)

**File:** `backend/data/listings.json` L3

**Issue:** the category is `cosmetic`, but the description contains `ผลิตภัณฑ์เสริมอาหาร` ("food supplement").

**Fix:** change the description to fit a cosmetic, or make L3 a supplement with a revoked registration.

---

## B5. Documentation contradicts the code (Low; affects the submission)

- `README.md` says "4 of 5 commits" and "8 of 8 tests" in one place and "18 tests" in another. The actual figures are 5 of 7 and 18.
- The "Current state" header in `IMPLEMENTATION.md` still says `PENDING` and R-03 are missing.

**Fix:** update both at code freeze with the actual counts:

```bash
git log --oneline | grep -c "\[codex\]"
.venv/Scripts/python -m pytest -q
```

## Resolution evidence

B1 uses configurable Thai claim phrases with positive and negative regression tests. B2 compares advertising_permit against registry fixtures and labels request-scoped outage simulation as demo-only. B3 uses registry_identity and registry_category for lookup checks, followed by one result entry per rule. B4 uses a cosmetic description for L3. B5 updates current-state and test-count documentation. The prior-code provenance declaration remains a team confirmation item.

---

## B6. Hosted saved-product continuity fails (High)

**Source:** README line 205. The latest hosted desktop and mobile run against the SQLite deployment passed 16 checks and failed 4 saved-product continuity checks. The PostgreSQL deployment and the hosted retest are still pending.

**Impact:** saved products can disappear between requests during the live demo.

**Fix:** deploy the PostgreSQL storage from `224c22a`, rerun the hosted browser checks, and record the result in the README.

## B7. README test counts contradict each other (Medium; affects the submission)

**Source:** README line 175 says "105 tests pass", but line 205 says "108 Python tests".

**Fix:** at code freeze, run `pytest -q` and the Node and browser suites, then write one set of figures.

**Resolution evidence (B7):** The full local suites pass 137 Python, 108 Node, and 22 desktop/mobile browser tests; every current README count matches. A browser trace exposed a pre-existing Edit-focus race that typed a price into the title; the test now waits for Edit completion before filling the price. Historical hosted results are labeled separately, with no live-service retest or deployment claimed.

## B8. ISO 9001 alone is accepted as evidence (Medium)

**Source:** `evidence_fixtures.json` has ISO 9001 and ISO 22000 fixtures, but `backend/app` and `tests` contain no logic or test that uses them. A search for `ISO` found nothing.

**Expected:** ISO 9001 is a quality-management standard, not a product-safety certificate, so it cannot satisfy R-05 by itself.

**Fix:** add a failing test that expects ISO 9001 evidence alone to fail R-05 (or go to review) and ISO 22000 evidence to pass, then implement the check.

**Resolution evidence (B8):** `tests/test_evidence_standards.py` reproduced the incorrect ISO 9001 approval and missing stored standards, then passed all four fixture-based cases. Uploads accept optional `standards` declarations; ISO 9001 alone fails R-05 with PENDING/0.60, while ISO 22000 passes matching identity checks. Rechecks retain the declaration and outages remain UNKNOWN. File authenticity is not asserted.

## B9. Duplicate evidence hashes are not flagged (Medium)

**Source:** the `duplicate_hash` fixture exists, but no code checks whether the same `sha256` was already stored for another verification. A search for `duplicate` in `backend/app` found nothing.

**Impact:** one certificate can be reused across unrelated listings.

**Fix:** on upload, look up the hash in the `evidence` table. If it belongs to another verification, record it in the trace and send the case to human review.

**Resolution evidence (B9):** `tests/test_duplicate_evidence.py` first reproduced two incorrect APPROVED responses, then passed cross-case label/certificate reuse and negative controls. The upload appends `duplicate_evidence`; unresolved duplicates remain in human review at confidence 0.60 after restart/recheck. Same-verification reuse is not flagged, stale uploads return 409, audit hashes remain valid, and outages retain UNKNOWN.

## B10. R-02 category claims are hardcoded (Low)

**File:** `backend/app/verification.py:106`, which holds 4 phrases inline: `ยารักษา`, `ขาวถาวร`, `treats hypertension`, `cures adhd`.

**Issue:** this repeats the pattern that B1 fixed for R-03. The check also applies only to supplements and does not compare claims with the registered category.

**Fix:** move the phrases to `claim_rules.json` (for example `category_claims` by category) and add positive and negative tests.

**Resolution evidence (B10):** `tests/test_category_claims.py` first failed five configuration/category cases, then passed all nine tests. R-02 reads the four phrases from `category_claims` using the registry category, supports configured categories without code changes, preserves ordinary copy, and never approves an outage.

## B11. No MoPH 448 ingredient-ceiling check (Low; Roadmap)

**Issue:** the code does not compare declared ingredient amounts with the limits.

**Fix:** label it "Roadmap" in the slides. If time remains, add a small `ingredient_limits.json` with synthetic limits and one test.

## B12. The production commit cannot be verified (High; affects the demo)

**Source:** on 21 Nov 2026 at 14:04 +07:00, every path on `trustcart-bluescreen-demo.vercel.app` returned `401`, including `/`, `/health`, `/version`, and `/openapi.json`. The code has no version endpoint, and the repository has no `.vercel` link. Nobody outside the Vercel project can tell whether Production runs `224c22a` (13:51). The README still reports the hosted deployment on SQLite with PostgreSQL pending.

**Impact:** the team may demo an older build or temporary storage (see B6) without noticing.

**Fix:** follow the deploy steps under P0 in [TODO.md](TODO.md). Add an unauthenticated `GET /version` that returns only the commit SHA, and confirm it on stage before the demo.

**Resolution evidence (B12):** `tests/test_version.py` first failed all four cases, then passed for public GET, exact response fields, local fallback, and the unchanged gate on other routes. The endpoint fix is local; production deployment and on-stage confirmation remain the Vercel team member's task.
