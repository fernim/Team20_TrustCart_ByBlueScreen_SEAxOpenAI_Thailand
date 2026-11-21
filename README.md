# TrustCart Baseline Lead

**Repository** `Team20_TrustCart_ByBlueScreen_SEAxOpenAI_Thailand`

Built by Team BlueScreen for the Sea × OpenAI Regional Codex Hackathon Thailand. The `[codex]` stamp credits OpenAI Codex with initiating this baseline implementation.

TrustCart gives marketplaces a pre-publication verification API for health-product listings. A marketplace submits a listing and receives a status, a reason, an audit trace, and a URL for retrieving the decision. The baseline runs end to end with a synthetic registry and a local SQLite database. Its approvals apply only to synthetic fixtures.

> **All data is synthetic.** TrustCart does not connect to the Thai FDA registry or any marketplace. It is not affiliated with Shopee or Thai FDA, and its results are decision support. They are not certification, legal advice, or medical advice.

## Problem

A real 13-digit Thai FDA registration number does not prove that the listed product holds it. Shoppers cannot tell whether the number on a health-product listing belongs to that product. Listings also claim to treat, prevent, or reverse disease. Enforcement happens after publication: Thai FDA reports 121,494 illegal health-product ads closed between 2023 and April 2026. Sources are listed in the pitch deck. Small sellers usually learn the rules when a listing is taken down.

## Solution

TrustCart checks a listing **before publication** through an API. The design rule is *AI extracts and suggests, deterministic rules decide, humans govern*:

- Rules R-01 to R-05 decide the status. A language model is never allowed to set one.
- A registry outage, missing reference, or unmapped category returns `UNKNOWN` with human review. TrustCart never approves a case it could not verify.
- Every decision step is written to a SHA-256 hash-chained audit trace.

## Build direction

- **03 Deep Domain AI (primary).** Checks follow Thai supplement compliance practice: registration identity, licence holder, category, and prohibited claims. The test is whether a trust-and-safety reviewer would rely on the result.
- **01 Autonomous & Adaptive AI (secondary).** The agent runs without supervision and escalates to a person only when it cannot verify a case.

## Declarations (what was built during the hackathon)

**Built on 21 November 2026, on site, in this repository.** The first commit, `1d8b004`, was made at 10:44 +07:00, after hacking started at 10:25. `git log` shows the full timeline.

| Built today | Files |
| --- | --- |
| Verification API, synthetic registry adapter, SQLite persistence, hash-chained trace | `backend/app/main.py`, `backend/app/registry.py` |
| Password-protected web demo and interactive API docs | `app.py`, `demo.html`, `vercel.json` |
| Tests | `tests/` |
| Codex instructions | `AGENTS.md`, `BASELINE.md` |

**Prepared before the event (existing personal project).**

- Prior prototype repository: <!-- TODO: add the link. The current repository is private; make it public or explain this in the submission form. --> `zhunbeiboshi-del/TrustCart-BlueScreen`
- Seven planning documents were copied unchanged from that project as product specification and reference: `PRODUCT.md`, `REGISTRATION.md`, `DEMO.md`, `DEMO.en.md`, `DEPLOY.md`, `DEPLOY.en.md`, and `GAPS_AND_QA.md`. They describe the target product. Features they list are delivered only when this repository's code and tests contain them.
- Research, the pitch deck, and diagrams were also prepared before the event.
- No code from the earlier prototype was copied. This repository's code was rewritten during the hackathon.
- Commit `514f11e` has no message. It was part of the same day's work.

**Open-source libraries:** FastAPI, Uvicorn, Pydantic, and pytest. `requirements.txt` lists them.

## How we used Codex

- **`AGENTS.md` first.** It gives Codex the stack, run and test commands, eight safety rules, and the status policy, so every task starts from the same constraints.
- **One task per rule, endpoint, or component, with the test written first.** Codex implements the task against a named acceptance test.
- **Visible log.** Commits made through Codex carry the `[codex]` tag. At the time of writing, 4 of 5 commits are tagged. <!-- TODO: update counts at code freeze: git log --oneline | grep -c "\[codex\]" -->
- **Human review.** Team members review every diff that touches rules, safety, or data handling.
- **Test results.** `pytest` passes 8 of 8 tests. <!-- TODO: update at code freeze -->

## Run locally

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API contract. In another PowerShell terminal, submit the sample marketplace listing and retrieve the stored result.

```powershell
$listing = @{
    registration_reference = 'DEMO-001'
    product_name = 'Demo Supplement'
    license_holder = 'Demo Brand'
    category = 'supplement'
} | ConvertTo-Json

$submission = Invoke-WebRequest -Method Post `
    -Uri 'http://127.0.0.1:8000/v1/verifications' `
    -ContentType 'application/json' -Body $listing

Invoke-RestMethod -Uri ('http://127.0.0.1:8000' + $submission.Headers.Location)
```

| Status | Meaning in the baseline |
| --- | --- |
| `APPROVED` | The synthetic fixture is active and its product, licence holder, and category match. |
| `DENIED` | A supported category or registration identity check failed against the fixture. |
| `UNKNOWN` | The reference is missing, the category is unmapped, or the registry is unavailable. The response flags the case for human review. |

The API covers R-01 registration identity and the registry category match from R-02. Each decision step contributes to the SHA-256 trace. SQLite preserves results across app restarts. Confidence is `1.0` for a conclusive fixture check and `0.0` when the result is unknown.

## Marketplace service roadmap

An authorized registry connector, marketplace authentication, claims and evidence checks, and a reviewer workflow are future integration work. The public source repository and any future hosted API are separate deliverables.

## Tests

```powershell
.venv/Scripts/python -m pytest -q
```

## Web demo and API documentation

The [hosted demo](https://trustcart-bluescreen-demo.vercel.app) includes 20 synthetic marketplace transactions, status filters, decision reports, and a sample verification request.

Open the [interactive API documentation](https://trustcart-bluescreen-demo.vercel.app/docs) to authorize with HTTP Basic authentication, inspect request examples, and try the endpoints. Use username `demo` and the shared password supplied separately.

To run the web app locally, set `TRUSTCART_DEMO_PASSWORD` in the process environment, then run:

```powershell
.venv/Scripts/python -m uvicorn app:app --port 8000
```

The password gate covers the dashboard, API, and documentation. Access fails closed if the environment variable is missing. Vercel uses the root `app.py` entrypoint and the configuration in `vercel.json`.

Hosted SQLite storage is temporary. Saved verification results can disappear after a function restart or be unavailable on another instance. R-03 through R-05 transaction scenarios illustrate planned product behavior.
