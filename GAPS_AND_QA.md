# TrustCart — Gap Closure, Judge Q&A & Source Reuse

Status of every gap raised in the War-Room Playbook (EN/TH), the BlueScreen prep notes, the old
"Hackathon Pitch & Playbook" deck, the Tech doc and the research — checked against the code on `dev_fenDB`.

**Core thesis:** *AI extracts & suggests; deterministic rules R-01..R-05 decide; humans govern.*
**Hook:** เลข อย. จริง ≠ สินค้าจริง — a real registration number is not a verified product.

---

## 1. Gap status

| # | Gap (source) | Status | Where |
|---|---|---|---|
| 1 | Risk score double-counted revoked numbers; weights hard-coded (Playbook §8, prep notes) | ✅ Closed | `backend/data/risk_policy.json` (RISK-v1), `score_risk()` in `agent.py`, reviewer breakdown |
| 2 | Registry Adapter, not a hard dependency (Playbook rule 2, research) | ✅ Closed | `backend/app/registry.py` — one `lookup()` interface, `MockRegistry` default, `REGISTRY_SOURCE` switch, snapshot hash in every trace |
| 3 | OAuth 2.0 / scoped, short-lived tokens for APIaaS (Playbook §7, prep notes) | ✅ Closed (prototype) | `backend/app/oauth.py`, `POST /oauth/token` — client credentials, HS256 JWT, 15-min TTL, scopes `verifications:write` · `reports:read` · `review:write` |
| 4 | Caller/action logging in the audit chain (Playbook §7) | ✅ Closed | caller recorded in the `ingest` step and in reviewer decisions; `engine.caller` in every report |
| 5 | No silent pass on outage; Unknown ≠ Denied | ✅ Closed | registry switch → every listing `UNKNOWN` + human review |
| 6 | Grounded AI — AI never decides | ✅ Closed | `llm.py` grounding guard; rules decide; tests |
| 7 | Tamper-evident audit | ✅ Closed | hash chain + `/v1/audit/{id}` + `/demo/tamper/{id}` |
| 8 | Bilingual, no language mixing | ✅ Closed | `{th, en}` pairs; `test_no_language_mixing_in_reports` |
| 9 | Password-protected demo + logout | ✅ Closed | `gate.py`, 8-hour session |
| 10 | Business figures labelled illustrative (Playbook §8) | ✅ Closed in app & deck | API Plugin tab, deck APIaaS slide |
| 11 | Exact `[codex]` task count (Playbook §1 rule 5) | ⏳ At code freeze | count `git log --grep "\[codex\]"` on event day |
| 12 | Only work built on 21 Nov is judged (Playbook §1 rule 1) | ⚠️ Team decision | this repo is preparation; rebuild/prove the loop on the day with Codex using `AGENTS.md` |
| 13 | OAuth credentials on Vercel | ⏳ Owner action | add `TRUSTCART_CLIENTS`, `TRUSTCART_TOKEN_KEY` in Vercel env (see `DEPLOY.md`) |
| 14 | MoPH 448 ingredient ceilings, GMP (ISO 9001 alone not accepted), Lab COA | 🔜 Next rule packs | listed as "next" in the evidence table; not built |
| 15 | Real Thai FDA supplement data | 🔜 Ask | no public supplement API found; ask `itcenter@fda.moph.go.th` (listed on data.go.th) for coverage and terms |
| 16 | Persistence | 🔜 Production | in-memory demo; Supabase planned |
| 17 | AI extraction/translation live | ⏳ Owner action | set `OPENAI_API_KEY` on Vercel |

Tests: `pytest -q` → **20 passed** (adds OAuth flow, scope enforcement, forged and expired tokens).

---

## 2. Judge Q&A — the "why" questions

### Why APIaaS — and why not the alternatives?
- **Why:** marketplaces and brands plug pre-publication checks into listing creation (`POST /v1/verifications`), show a badge (`GET /v1/widgets/{id}`) and route risky listings to reviewers — without rebuilding rule logic. Enforcement moves from post-publication takedown to pre-publication.
- **Why not a chatbot:** ungrounded answers; no auditable verdict.
- **Why not scraping marketplaces or the Thai FDA site:** breaks terms of service and fails on stage; we use a Registry Adapter over mock data instead.
- **Why not a single app:** a silo cannot serve several marketplaces or Sea markets; an API can.
- **Prototype → production:** REST over mock data with outage and tamper toggles → API keys/OAuth gateway, rate limits, webhooks, SLAs, authorised registry connectors.

### Why OAuth 2.0?
- Marketplace ↔ TrustCart calls need **scoped, least-privilege, short-lived** access, not a shared static secret.
- **Built now:** client credentials → HS256 JWT (15-minute TTL) in the `Authorization: Bearer` header; scope checked per endpoint (`403 insufficient_scope`); tampered or expired tokens rejected (`401`); the caller is written into the audit chain; token responses are `Cache-Control: no-store`.
- **Production:** API gateway (rate limits, tenant isolation, billing metering), key rotation, Authorization Code + PKCE with RBAC for seller and reviewer portals, PDPA-minimised evidence.

### Why TrustCart?
- A valid 13-digit number does not prove it belongs to the listed product or supports disease claims; takedowns happen after harm.
- TrustCart combines: (1) AI extraction separated from rules R-01..R-05, (2) human escalation below 0.75 confidence, (3) a tamper-evident hash-chained audit, (4) pre-publication compliant copy.

### Recheck — what are we building, and what is it not?
- **Is:** a human-in-the-loop compliance and risk-prioritisation workflow for health/supplement listings, on synthetic data.
- **Is not:** a live Thai FDA integration, legal or medical advice, or official Shopee software. Never a silent pass when confidence is low or the registry is down.

### Other likely questions
| Question | Answer |
|---|---|
| Does the AI decide? | No. It extracts phrases; phrases not in the listing are dropped; rules decide. |
| Where does the risk ranking come from? | A versioned, additive policy (RISK-v1) that orders the reviewer queue only and is recorded in every trace; weights are assumptions to calibrate. |
| What if the Thai FDA registry is down? | Every listing becomes Unknown and goes to a human. |
| How do you scale across Sea? | Swap the Registry Adapter (Thai FDA, Singapore HSA, Indonesia BPOM, Malaysia NPRA, Vietnam VFA) and the versioned rule pack; the agent stays the same. |
| Is the data real? | No — synthetic listings and a mock registry, labelled in the app. |

---

## 3. What to reuse from the older sources

| Source | Reusable | Already in the deck/app | Add / note |
|---|---|---|---|
| Old *Hackathon Pitch & Playbook* (.pptx, 14 slides) | Problem, Why Now, Gap, Users, 7-step agent, Demo, Deep Domain, Responsible, Codex, Think Beyond, Ask | ✅ all, updated to R-01..R-05, 4 statuses, AI step | its demo slide used the old statuses ("Needs evidence / Under review") — do not reuse that text |
| War-Room Playbook §1 rules | on-site build, no scraping, synthetic data, grounded AI, Codex proof | ✅ guardrails slide | team must decide how to treat prepared code (gap 12) |
| War-Room Playbook §2 regional lessons | white-box traces (Evoloop), one full loop (TripCanvas), deep domain over wrappers | ✅ "Why we win" slide | — |
| War-Room Playbook §4–5 | branch/folder ownership, 08:30–17:30 schedule | ✅ execution slide | folder names in the playbook (`backend/api/`, `frontend/` Next.js) differ from this repo — align on the day |
| War-Room Playbook §6 | 10-slide blueprint + GIF loops | deck covers the same story in 25 slides | GIF loops not built — record from the live demo if wanted |
| War-Room Playbook §7 | Q&A: APIaaS, OAuth 2.0, Why TrustCart, Recheck | ✅ Q&A slides + this file | — |
| BlueScreen prep notes | unit economics (AOV THB 850, margin, LTV:CAC 5.3×/21.2×) | — | keep as **illustrative**; not shown as facts |
| BlueScreen prep notes | MoPH 447/448, GMP (ISO 9001 alone not accepted), 13-digit format | 447 + 13-digit in R-01/R-03 | 448 ceilings and GMP as next rule packs |
| Research note | ask Thai FDA IT contact; registry adapter; no scraping; cached snapshot | ✅ adapter, snapshot hash | contact before the event |

---

## 4. Pre-stage checklist (T-60 minutes)

- [ ] `pytest -q` → all pass; write the count on the Codex slide
- [ ] `git log --oneline --grep "\[codex\]" | wc -l` → write the count on the Codex slide
- [ ] Incognito → log in → ↺ reset → registry 🟢
- [ ] Rehearse twice: L1 evidence → reviewer · registry 🔴 → Unknown → 🟢 · tamper → detected · L4 copy fix → Approved · L7 permit conflict
- [ ] API Plugin tab → call the live API
- [ ] Synthetic-data and "not affiliated with Shopee" notices visible
- [ ] Log out after the pitch
