# Bugs and Risks

Found while reviewing commit `31ef16b`. Each item says how it was confirmed.

| ID | Severity | Status |
| --- | --- | --- |
| B1 | High | Fixed |
| B2 | Medium | Fixed |
| B3 | Low | Fixed |
| B4 | Low | Fixed |
| B5 | Low | Fixed |

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
