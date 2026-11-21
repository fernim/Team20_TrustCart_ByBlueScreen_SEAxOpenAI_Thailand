# TrustCart — Reproduce & Deploy Guide (English)

> Current checkout: the public storefront no longer uses the shared demo password. Role selection needs no passwords; anyone can choose a demo role. This is not production identity authentication. New verification requires private document storage and additive tc_* tables; use persistent PostgreSQL for a shared deployment. OPENAI_API_KEY and TRUSTCART_AI_TRANSFER_APPROVED=true enable Live document checks; Replay remains explicit. This role-workflow change has not been deployed. Older shared-gate instructions below apply only to the legacy diagnostic surface; see README for the current contract.

Every step to rebuild the project on your machine, test it, and deploy it to Vercel
(including the problems we actually hit during deployment and how we fixed them).

> All demo data is **synthetic** · never put passwords or API keys in committed files

---

## 0. Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Python | 3.9+ (tested on 3.9.13) | Vercel can run a newer Python |
| Node.js | 18+ (tested on 24) | Used for the Vercel CLI and to build slides/diagrams |
| Git | Any | |
| Vercel account | Hobby (free) is enough | Must be a member of the Team you deploy to |
| (Optional) OpenAI API key | | Enables AI text extraction and translation of user-typed text |

---

## 1. Clone and install

```bash
git clone https://github.com/zhunbeiboshi-del/TrustCart-BlueScreen.git
```

```bash
cd TrustCart-BlueScreen
```

```bash
git checkout dev_fenDB
```

```bash
python -m venv .venv
```

Windows:

```bash
.venv/Scripts/python -m pip install -r requirements.txt "uvicorn[standard]" pytest
```

macOS / Linux:

```bash
.venv/bin/python -m pip install -r requirements.txt "uvicorn[standard]" pytest
```

> The commands below use `.venv/Scripts/python` (Windows); on macOS/Linux use `.venv/bin/python`

---

## 2. Local environment (optional)

Create `.env.local` at the project root (it is already in `.gitignore` and `.vercelignore`, so it is never committed or uploaded):

```dotenv
# Turn on the local login page (leave out = open without a password)
TRUSTCART_PASSWORD=<set your password>

# Turn on AI text extraction and translation of user-typed text (leave out = keyword rules only)
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
```

| Variable | When set | When not set |
|---|---|---|
| `TRUSTCART_PASSWORD` | Every page and API needs login (cookie lasts 8 hours, logout button) | Open access |
| `OPENAI_API_KEY` | AI extracts extra claims + translates user text automatically | Keyword rules; user-typed text is not translated |
| `OPENAI_MODEL` | Chooses the model | `gpt-4o-mini` |
| `TRUSTCART_CLIENTS` | Turns on OAuth 2.0 for external systems: `client_id:secret:scope scope;...` | `/oauth/token` returns 503 (not configured) |
| `TRUSTCART_TOKEN_KEY` | Token signing key (random, ≥ 32 characters) | Derived from the client list |
| `TRUSTCART_TOKEN_TTL` | Token lifetime (seconds) | `900` |
| `REGISTRY_SOURCE` | Chooses the registry source (Registry Adapter) | `mock` |

> The server reads `.env.local` at startup but **does not override** values already set in the real environment

---

## 3. Run and test locally

```bash
.venv/Scripts/python -m pytest -q
```

Expect `20 passed` (tests turn off the gate and AI automatically and make no network calls)

```bash
.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000
```

| URL | Purpose |
|---|---|
| http://localhost:8000 | Demo page (Shopper / Seller / Reviewer / API plug-in) |
| http://localhost:8000/docs | API docs (Swagger) |
| http://localhost:8000/login | Login page (when `TRUSTCART_PASSWORD` is set) |

Quick check with curl:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/v1/listings
```

`200` = no password · `401` = the gate is working

---

## 4. Deploy to Vercel (first time)

### 4.1 Files Vercel uses (already in the repo)

| File | Role |
|---|---|
| `api/index.py` | Entrypoint: `from backend.app.main import app` |
| `vercel.json` | Bundles `backend/` and `frontend/` into the function (`includeFiles`); **no rewrites** |
| `requirements.txt` | Dependencies Vercel installs (`fastapi`, `python-multipart`, `httpx`) |
| `.vercelignore` | Does not upload `.venv`, `tests`, `docs`, `.env*`, `.git` |

`vercel.json`:

```json
{
  "functions": {
    "api/index.py": {
      "includeFiles": "{backend,frontend}/**"
    }
  }
}
```

### 4.2 Log in to the Vercel CLI

```bash
npx --yes vercel@latest login
```

Open the link the CLI shows, press Approve in the browser, and wait for "Congratulations! You are now signed in"

> `--yes` is required; otherwise npm first asks "Ok to proceed? (y)", and if that is cancelled the login never happens

Check:

```bash
npx --yes vercel@latest whoami
```

### 4.3 Create and link the project (name must be lowercase)

```bash
npx --yes vercel@latest link --yes --project trustcart-bluescreen
```

> ⚠️ `vercel link` may connect the GitHub repo automatically. If you do not want auto-deploys from Git, disconnect it:

```bash
npx --yes vercel@latest git disconnect --yes
```

### 4.4 Set Environment Variables on Vercel

Set the password (type the value when the CLI asks; do not put it in a command that ends up in shell history):

```bash
npx --yes vercel@latest env add TRUSTCART_PASSWORD production
```

(Optional) Turn on OAuth 2.0 for API clients: generate a random secret first, then type it when the CLI asks:

```bash
python -c "import secrets;print('shopee-sandbox-demo:'+secrets.token_urlsafe(24)+':verifications:write reports:read')"
```

```bash
npx --yes vercel@latest env add TRUSTCART_CLIENTS production
```

```bash
npx --yes vercel@latest env add TRUSTCART_TOKEN_KEY production
```

Test (replace with your client_id/secret):

```bash
curl -s -X POST https://trustcart-bluescreen.vercel.app/oauth/token -d grant_type=client_credentials -d client_id=$CLIENT_ID -d client_secret=$CLIENT_SECRET
```

(Optional) Turn on AI:

```bash
npx --yes vercel@latest env add OPENAI_API_KEY production
```

Or set them on the web: **Vercel → Project → Settings → Environment Variables**, then redeploy

### 4.5 Deploy

```bash
npx --yes vercel@latest deploy --prod --yes
```

The output includes the line `Production URL: https://trustcart-bluescreen.vercel.app`

> If you see "The commit author doesn't have access to this team", see 6.3

---

## 5. Check after deploy

```bash
curl -s -o /dev/null -w "API without login: %{http_code}\n" https://trustcart-bluescreen.vercel.app/v1/listings
```

Expect `401` (if a password is set)

```bash
curl -s -o /dev/null -w "Page: %{http_code} -> %{redirect_url}\n" -H "accept: text/html" https://trustcart-bluescreen.vercel.app/
```

Expect `303 -> .../login`

Then open the site in an **incognito** window → log in → check:

- [ ] 7 product cards show a status
- [ ] Opening L1 shows the card **13-1-02954-5-0088 ≠ OfficeCare Turmeric**
- [ ] Switching Thai ↔ English leaves no words from the other language
- [ ] Reviewer tab → replay steps → 🔐 verify log → 🧪 simulate tampering → tampering detected
- [ ] The 🟢/🔴 registry button turns every listing Unknown
- [ ] API plug-in tab → calling the real API returns JSON
- [ ] The logout button returns to the login page
- [ ] `/docs` opens after login

> After a new deploy, if you still see old results (for example a 404 on a new endpoint), wait 10–30 seconds for the domain to switch to the new deployment

---

## 6. Problems we actually hit, and fixes

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 6.1 | `Error: No existing credentials found` | CLI not logged in (web login does not count), or login was cancelled at the npm prompt | Run `npx --yes vercel@latest login` to completion |
| 6.2 | `Project names ... must be lowercase` | Folder name has capitals (`TrustCart_BlueScreen`) | `vercel link --yes --project trustcart-bluescreen` |
| 6.3 | `The commit author doesn't have access to this team` | Vercel reads the committer from `.git`, and that person is not a Team member | **Permanent:** add that GitHub account/email to the Team · **Quick:** deploy from a copy without `.git` (below) |
| 6.4 | Every path returns `{"detail":"Not Found"}` | `vercel.json` rewrote to `/api/index`, so FastAPI saw the wrong path | Remove `rewrites` and let Vercel's built-in FastAPI support handle routing |
| 6.5 | 500 / file not found (`index.html`, `registry.json`) | Files were not bundled into the function | `includeFiles: "{backend,frontend}/**"` in `vercel.json` |
| 6.6 | Evidence upload errors with `python-multipart` | Missing form dependency | Already in `requirements.txt` |
| 6.7 | `TypeError: unsupported operand type(s) for \|` | Python 3.9 does not support `str \| None` in FastAPI signatures | Use `Optional[str]` (see `AGENTS.md`) |
| 6.8 | Local site opens without a password | `TRUSTCART_PASSWORD` not set locally | Put it in `.env.local` (section 2) |
| 6.9 | Demo data resets by itself | Data is in memory and serverless can restart (cold start) | Press ↺ before presenting · long term, use Supabase |

### Deploy from a copy without `.git` (fix for 6.3)

macOS / Linux / Git Bash:

```bash
D=$(mktemp -d) && cp -r api backend frontend .vercel requirements.txt vercel.json .vercelignore "$D"/ && (cd "$D" && npx --yes vercel@latest deploy --prod --yes)
```

> Copy `.vercel/` too so it deploys to the same project · **do not copy `.env.local`**

---

## 7. Extras (not needed to deploy)

### 7.1 Rebuild diagrams from Mermaid

Sources are in `docs/diagrams/*.mmd` (GitHub renders them automatically)

```bash
npx -p @mermaid-js/mermaid-cli@11.4.2 mmdc -i docs/diagrams/01-infrastructure.mmd -o docs/diagrams/01-infrastructure.svg -b white
```

> If you see "Could not find Chrome", create a `puppeteer.json` pointing to an installed Chrome/Edge and add `-p puppeteer.json`:
> `{"executablePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "headless": "shell"}`

### 7.2 Rebuild the slides

```bash
npm install pptxgenjs@3.12.0
```

```bash
node docs/deck/build_deck.js --full
```

Produces `docs/deck/TrustCart_Pitch_Full.pptx` (25 slides) · without `--full` you get `TrustCart_Research_Architecture.pptx` (12 slides)

> Close the file in PowerPoint first, or you will get `EBUSY` · upload it to Google Drive with "Convert to Google Slides" so the team can edit together

---

## 8. Security checklist before push / deploy

- [ ] `git status` shows no `.env*`
- [ ] `git ls-files | grep -i env` lists no env files
- [ ] Passwords and API keys live only in Vercel Environment Variables or `.env.local`
- [ ] `.vercelignore` contains `.env*` (prevents uploading secrets when deploying from the repo folder)
- [ ] Change the demo password after the event (Vercel → Settings → Environment Variables → edit → Redeploy)

---

## Appendix: project structure

```
TrustCart_BlueScreen/
├── api/index.py              # Vercel entrypoint
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI: /v1 API, demo endpoints, login/logout
│   │   ├── agent.py          # Verification agent: R-01..R-05, policy, hash-chained trace
│   │   ├── llm.py            # OpenAI extraction + translation (optional)
│   │   ├── gate.py           # Password gate + bearer-token routing
│   │   ├── oauth.py          # OAuth 2.0 client credentials (JWT, TTL, scopes)
│   │   └── registry.py       # Registry Adapter (mock default, swappable)
│   └── data/                 # Synthetic registry, listings, claim rules (TH/EN pairs)
├── frontend/index.html       # Shopper / Seller / Reviewer / API plugin UI (TH/EN)
├── tests/test_agent.py       # 20 pytest cases
├── docs/
│   ├── diagrams/             # Mermaid sources + SVG/PNG
│   ├── deck/                 # pptxgenjs build scripts + generated decks
│   └── brand/                # BlueScreen logo (SVG/PNG)
├── vercel.json · requirements.txt · .vercelignore
├── README.md · DEMO.md · DEMO.en.md · AGENTS.md · DEPLOY.md · DEPLOY.en.md · GAPS_AND_QA.md
```
