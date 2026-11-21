# Thomaz · TrustCart API Agent Guidance

- **Owner** Thomaz
- **Scope** FastAPI, deterministic verification, registry access, grounded claim extraction, and seller evidence workflows.
- **Method** Universal AGD v2.1 lifecycle with requirement-to-evidence traceability.

## Start here

1. Read [AGENTS.md](AGENTS.md) for the team's safety rules, status policy, and test-first requirements. Apply this guide within those rules and the user's current task.
2. Check the branch, working tree, relevant routes, consumers, and tests before editing. Preserve teammates' work.
3. Read the relevant task in [IMPLEMENTATION.md](IMPLEMENTATION.md) and the API contract in [README.md](README.md). Use [PRODUCT.md](PRODUCT.md) for the product target and [REGISTRATION.md](REGISTRATION.md) for the promised demo. Verify present behavior against the checkout and tests.
4. Resolve material policy or contract conflicts with the relevant owner before implementing the dependent behavior. Record pending decisions as pending.

## API boundaries and ownership

| Path | Responsibility |
| --- | --- |
| [backend/app/main.py](backend/app/main.py) | FastAPI setup, startup, shared app state, and router registration |
| [backend/app/api/verifications.py](backend/app/api/verifications.py) | Listing submission and result retrieval |
| [backend/app/api/seller.py](backend/app/api/seller.py) | Evidence upload, recheck, and copy suggestions |
| [backend/app/api/reviewer.py](backend/app/api/reviewer.py) | Reviewer queue and decisions |
| [backend/app/api/reports.py](backend/app/api/reports.py) | Reports, badges, comparison, and audit endpoints |
| [backend/app/verification.py](backend/app/verification.py) | Verification models, deterministic evaluation, and hash-chained trace |
| [backend/app/workflow.py](backend/app/workflow.py) | SQLite schema and migration, shared mutation handling, audit verification, and risk scoring |
| [backend/app/registry.py](backend/app/registry.py) and [backend/app/llm.py](backend/app/llm.py) | Registry adapter and grounded claim extraction |
| [app.py](app.py) | Password-protected demo entry point and demo-only routes |

Put routes in the matching `APIRouter`. Keep registry and decision logic in the existing backend modules. Use Python 3.9-compatible FastAPI signatures, including `Optional[...]` for optional request types. Coordinate fixtures and rule wording with Ju, audit and reviewer changes with Big, and public response changes with Fen. Follow the ownership paths in the current checkout.

## Contract and decision rules

- Preserve `/v1` methods, paths, status codes, and response fields unless the task changes the contract. For structural changes, compare the OpenAPI schema and run the relevant API flow through its normal entry point.
- Read registry facts through `tool_registry_lookup`. Missing or inconclusive data and outages produce `UNKNOWN` with human review. Apply the shared status policy when required checks conflict or confidence is below 0.75.
- For an active-record identity mismatch, return `PENDING` and request evidence. Keep unresolved evidence conflicts in human review. Deterministic rules decide status. Ground generated claim phrases in the original listing. Send listing text to the extraction provider only under the approved transfer configuration.
- For evidence, recheck, and review mutations, validate the current `chain_hash` and audit integrity before updating data. Treat stale revisions as `409`. Append decision steps with `Trace.add`, retain previous entries, and keep related SQLite writes atomic. Check compatibility with existing records whenever the schema changes.
- Store the declared evidence fields and the SHA-256 digests needed for the synthetic demo. Present R-05 as a comparison of seller declarations against the synthetic registry. Keep risk scores limited to queue ordering. Preserve the demo password gate and keep credentials in environment variables.

## AGD v2.1 workflow

1. **Discover and specify.** Identify the governing requirement or task, the endpoint or component, its callers, and the observable acceptance criteria.
2. **Plan.** Work on one rule, endpoint, or component at a time. For a behavior-preserving refactor, capture a passing baseline and state the invariants. For a change to API semantics, decision policy, or data retention, record the decision and affected consumers in the task or PR.
3. **RED → GREEN → REFACTOR.** Run a failing test that demonstrates the missing behavior, implement the smallest complete change, and refactor after the test passes. Keep automated tests on synthetic fixtures and fake clients.
4. **Verify by impact.** For documentation, check links and factual claims. For API behavior, run the targeted tests and full suite. For decisions or persistence, include the applicable outage, conflicting evidence, ungrounded claims, stale hash, tamper, restart, or migration checks. Verify the demo gate when the change affects exposure.
5. **Review and hand off.** Review the diff and report the requirement, decision, contract, files, tests, and actual results. Use `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, or `NOT APPLICABLE` with a reason where needed. Identify outstanding risks and approvals. Pushes, deployments, and live integrations follow the user's authorization for this repo.

Record the chain in the change description or PR as **Requirement → Decision → API contract → Code → Test → Evidence**. For example, a recheck change cites T8, states how the latest evidence and audit hash are handled, points to the seller route and [tests/test_evidence.py](tests/test_evidence.py), and records the command and result.

## Local verification

On macOS or Linux, set up the Python environment using the commands in [AGENTS.md](AGENTS.md), then run the relevant checks.

```bash
.venv/bin/python -m pytest -q tests/test_evidence.py tests/test_workflow.py
.venv/bin/python -m pytest -q tests/test_demo.py tests/test_demo_workflow.py
.venv/bin/python -m pytest -q
```

Use the first command for evidence, recheck, and reviewer changes, and the second for router registration and the password-protected demo. For claim extraction, target [tests/test_grounding.py](tests/test_grounding.py) and [tests/test_rule_regressions.py](tests/test_rule_regressions.py).

This guide applies the AGD workflow in Markdown. TrustCart currently uses pytest for executable checks.
