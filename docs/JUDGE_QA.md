# TrustCart judge Q&A

**Team BlueScreen · Sea × OpenAI Regional Codex Hackathon Thailand**

TrustCart helps marketplaces verify health-product listings before publication. It checks registration ownership and claims, gives sellers a way to resolve uncertainty with evidence, and gives reviewers an auditable decision. The demo uses synthetic data and a mock registry.

## Six-minute demo run sheet

First round allows six minutes for the demo and pitch plus two minutes of Q&A. The final allows six minutes plus four minutes of Q&A. Code freeze and submission are at **17:00 Bangkok time**.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:45 | Product card and synthetic-data banner | A valid registration number can belong to a different product. Checking before publication lets an honest seller correct the listing. |
| 0:45–2:15 | Submit L1 in `/workspace` | The product identity differs from the registry fixture. TrustCart returns `PENDING` and requests evidence. |
| 2:15–3:30 | Upload synthetic evidence, recheck, then record a reviewer denial | The system re-runs the checks, keeps the old trace, and uses the latest audit hash for the reviewer action. Show the reason and reviewer note in the report. |
| 3:30–4:30 | Open the report, run the audit simulation, then toggle the registry outage. | The simulated trace fails, the saved audit stays valid, and unavailable verification returns `UNKNOWN` with human review. |
| 4:30–5:15 | Show the Agency summary and Swagger | The dashboard counts stored outcomes, rule failures, and audit validity. The API exposes the same workflow to a marketplace. |
| 5:15–6:00 | Show the test and commit evidence. Close with the pilot ask. | Ask for access to an authorized registry and a labelled dataset to evaluate a controlled marketplace pilot. |

Use a fresh synthetic case for the run. Verify the case survives reload and subsequent requests before presenting from the hosted demo. If continuity fails, use the local demo and show the corresponding API and test evidence. Keep a screenshot or recording as a clearly labelled backup. If the rehearsal uses a separate reviewer credential, sign in as `reviewer` in a separate browser profile before the demo.

## Product, rules, and AI

**Why build an API?** Marketplace listing tools can call it when the seller submits or edits a product. The same verification ID links the seller evidence workflow, reviewer decision, shopper result, and audit. This gives an operational step that can run before publication. [Verification API](../backend/app/api/verifications.py) · [Reports and badges](../backend/app/api/reports.py)

**Which checks decide the result?** R-01 checks registration identity and active status. R-02 checks the registered category and relevant category claims. R-03 screens advertising text. R-04 checks applicable advertising permits. R-05 compares seller-declared evidence fields with the registry record. A conflicting identity or permit can require human review. Missing or inconclusive registry information is `UNKNOWN`. An approval applies to the synthetic listing and the checks run. [Verification rules](../backend/app/verification.py) · [Status policy](../AGENTS.md)

**Where would you use OpenAI?** R-03 claim extraction is the first place to use it. The optional Responses API client receives listing text and returns candidate phrases in a structured format. This can help surface Thai and English wording that the keyword list misses. Demonstrate it with a labelled synthetic listing and compare the extracted phrase and rule result with the deterministic baseline. Use the fake-client test as evidence if an approved live call is unavailable. [Extraction boundary](../backend/app/llm.py) · [Grounding tests](../tests/test_grounding.py)

**What if the model hallucinates or times out?** The backend retains phrases that appear literally in the listing and applies its own status rules. A model-proposed verdict is discarded. Without approved provider access, or if extraction fails, the deterministic rules still run. Grounding validates the quotation, and a labelled test set is still needed to assess the model's claim classification and Thai-English coverage. [Verification rules](../backend/app/verification.py) · [Grounding tests](../tests/test_grounding.py)

**What makes this adaptive?** The system updates a case after new evidence and sends uncertainty to a reviewer. Policy and rule changes can be versioned from labelled outcomes in a later iteration. The demo does not automatically train from reviewer decisions. [Workflow](../backend/app/workflow.py) · [Risk policy](../backend/data/risk_policy.json)

**What does uploading evidence prove?** The API compares declared identity fields with the synthetic registry. It stores SHA-256 digests and declarations, then discards raw document uploads. A digest lets us compare file contents later. The prototype does not certify document origin, perform OCR-based authentication, or validate a lab certificate. [Evidence endpoint](../backend/app/api/seller.py) · [Evidence tests](../tests/test_evidence.py)

## Security and reliability

**Who can access the hosted demo?** The published demo uses an HTTP Basic gate. The hardening branch supports a separate reviewer credential and rejects authenticated browser writes from another origin when the browser reports its origin. Verify the exact hosted configuration before claiming those protections are live. Individual marketplace identities, object ownership, and tenant isolation remain production requirements. [Demo entry point](../app.py) · [Security workflow tests](../tests/test_demo_workflow.py)

**What protects a reviewer decision?** With a distinct reviewer credential configured, the shared demo identity receives `403` on the queue, decision, and agency endpoints. Review also requires the latest `chain_hash` and a valid audit chain. Approval is blocked when a required rule fails or confidence is too low. Seller uploads and rechecks return `409` after review completes, so sellers submit a fresh case for changed evidence. The separate demo role records its actor label in the trace. A real pilot needs per-user identity and record-level authorization. [Reviewer endpoint](../backend/app/api/reviewer.py) · [Workflow tests](../tests/test_demo_workflow.py)

**Is the audit immutable?** The SHA-256 chain links each recorded step to the preceding entry. The hardening branch's demo simulates corruption on a copy. If a saved chain is actually invalid, the API blocks mutations and the shopper badge displays `UNKNOWN`. A privileged storage operator could rewrite the trace and recompute hashes, so production needs independently protected signing or append-only audit storage. [Audit validation](../backend/app/workflow.py) · [Tamper and badge tests](../tests/test_demo_workflow.py)

**What if a dependency fails?** An unavailable registry returns `UNKNOWN` and routes to a human. Optional AI extraction can fall back to deterministic checks. The opt-in PostgreSQL adapter fails the request if the configured database is unavailable. [Dataset outage tests](../tests/test_dataset.py) · [Database adapter](../backend/app/database.py)

**Does the demo save results across hosted requests?** Instance-local SQLite can lose cases when requests reach different instances. The repository supports opt-in shared PostgreSQL. Confirm the hosted configuration and complete a persistence run before claiming the database is active. Earlier local SQLite records need a separate migration to PostgreSQL. A production pilot would also need backups and tested restores. [Shared storage setup](../README.md#shared-production-storage)

**What would you harden before a real pilot?** Use independently authenticated services, role permissions, and record ownership checks. Remove demo-only controls from the pilot surface. Enforce request quotas and size limits at ingress, verify shared storage, and define evidence retention. Confirm data-transfer approval before enabling external extraction or registry integration. [API guidance](../ThomazAgents.md) · [Roadmap](../README.md#marketplace-service-roadmap)

## API metrics and competition evidence

**How accurate is the system?** The repository has 40 labelled synthetic listings. The test checks expected status and failed rules for each fixture, then verifies that every fixture becomes `UNKNOWN` in an outage. These are deterministic scenario tests. A real accuracy claim needs a representative, separately labelled dataset and per-category false approvals, false denials, and review rates. [Dataset tests](../tests/test_dataset.py)

**What does Agency summary measure?** It counts saved synthetic decisions by status, category, day, failed rule, and common matched claim phrases. It reports audit validity and records with an `APPROVED` verdict despite a failed rule or low confidence. The risk score helps order reviewer work and does not set the decision. Totals from a demo session do not establish market-wide accuracy or impact. [Agency endpoint](../backend/app/api/agency.py) · [Agency test](../tests/test_agency.py)

**How did the team use Codex?** Show a tagged commit and a corresponding test. Evidence upload, stale-hash rejection, outage behavior, grounding, and dashboard aggregation are concrete examples. Describe the code shipped during the event and disclose the earlier prototype and reused material in the submission. [Codex workflow and declarations](../README.md#declarations-what-was-built-during-the-hackathon) · [CI workflow](../.github/workflows/pytest.yml)

## Release evidence

Use the exact revision presented by the team. Record actual results before submission.

Local checks after the storage merge passed 112 Python tests, 94 Node component tests, and 16 desktop/mobile browser tests in Chrome. Separate authenticated browser checks passed the reviewer workflow. A local PostgreSQL 15 run preserved the decision and evidence across two app instances. Use the live URL and deployed commit when describing what judges can access.

| Evidence | What to record |
| --- | --- |
| Code | Git SHA, release status, and linked CI result |
| Automated checks | Python, frontend component, and browser test results for that revision. Record any checks that could not run. |
| Hosted demo | URL, source SHA if available, authenticated docs and workflow, unauthenticated rejection, and saved-case continuity |
| Security controls | Which controls are deployed, which are verified only in the checkout, and any environment configuration the demo requires |
| Competition submission | Public repository, project summary, demo link, and declarations on reused work |
