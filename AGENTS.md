# AGENTS.md (for Codex)

- Stack: FastAPI (Python 3.9 — use `Optional[...]`, not `X | None`, in request signatures), vanilla JS frontend served by FastAPI.
- Run: `.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000`. Test: `.venv/Scripts/python -m pytest -q`.
- Safety rules (never break):
  1. Registry facts come only from `tool_registry_lookup`; never generate a registration number.
  2. Unknown / outage / unmapped category ⇒ `UNKNOWN` or escalate, never `APPROVED`.
  3. Confidence < 0.75 ⇒ human review.
  4. No medical advice in any user-facing text.
  5. Every decision step goes through `Trace.add` (hash-chained); human actions use `chain_hash`.
  6. The LLM (backend/app/llm.py) only extracts claims; phrases not literally in the listing are dropped. It never sets a status.
  7. Registry access only through `backend/app/registry.py` (adapter); never scrape marketplace or Thai FDA pages.
  8. Secrets (passwords, client secrets, token keys, API keys) only in environment variables; never in code or docs.
- Statuses: APPROVED / PENDING / DENIED / UNKNOWN. Rules: R-01..R-05. API under `/v1`.
- Workflow: one rule / endpoint / component per task; write the test first; tag commits `[codex]`.
