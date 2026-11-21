# TrustCart — Reproduce & Deploy Guide

ขั้นตอนทั้งหมดสำหรับสร้างโปรเจกต์ใหม่บนเครื่อง ทดสอบ และ deploy ขึ้น Vercel
(รวมปัญหาที่เจอจริงระหว่าง deploy และวิธีแก้)

> ข้อมูลทั้งหมดในเดโมเป็น **ข้อมูลจำลอง** · ห้ามใส่รหัสผ่านหรือ API key ลงในไฟล์ที่ commit

---

## 0. สิ่งที่ต้องมี

| เครื่องมือ | เวอร์ชันที่ใช้ | หมายเหตุ |
|---|---|---|
| Python | 3.9+ (ทดสอบบน 3.9.13) | Vercel ใช้ Python รุ่นใหม่กว่าได้ |
| Node.js | 18+ (ทดสอบบน 24) | ใช้สำหรับ Vercel CLI และสร้างสไลด์/ไดอะแกรม |
| Git | ใดก็ได้ | |
| บัญชี Vercel | Hobby (ฟรี) พอ | ต้องเป็นสมาชิกของ Team ที่จะ deploy |
| (ไม่บังคับ) OpenAI API key | | เปิดการสกัดข้อความด้วย AI และแปลข้อความที่ผู้ใช้พิมพ์ |

---

## 1. Clone และติดตั้ง

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

> ตัวอย่างคำสั่งต่อจากนี้ใช้ `.venv/Scripts/python` (Windows) — บน macOS/Linux ให้เปลี่ยนเป็น `.venv/bin/python`

---

## 2. ตั้งค่า environment บนเครื่อง (ไม่บังคับ)

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์ (ไฟล์นี้ถูก `.gitignore` และ `.vercelignore` แล้ว จะไม่ถูก commit หรืออัปโหลด):

```dotenv
# เปิดหน้าล็อกอินบนเครื่อง (ไม่ใส่ = เปิดให้เข้าได้โดยไม่มีรหัสผ่าน)
TRUSTCART_PASSWORD=<ตั้งรหัสผ่านของคุณ>

# เปิดการสกัดข้อความด้วย AI และแปลข้อความที่ผู้ใช้พิมพ์ (ไม่ใส่ = ใช้กฎคำสำคัญอย่างเดียว)
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
```

| ตัวแปร | ผลเมื่อตั้งค่า | ผลเมื่อไม่ตั้งค่า |
|---|---|---|
| `TRUSTCART_PASSWORD` | ทุกหน้าและทุก API ต้องล็อกอิน (คุกกี้อยู่ได้ 8 ชั่วโมง, มีปุ่มออกจากระบบ) | เข้าได้ทันที |
| `OPENAI_API_KEY` | AI สกัดคำกล่าวอ้างเพิ่ม + แปลข้อความผู้ใช้อัตโนมัติ | ใช้กฎคำสำคัญ; ข้อความที่ผู้ใช้พิมพ์จะไม่ถูกแปล |
| `OPENAI_MODEL` | เลือกโมเดล | `gpt-4o-mini` |
| `TRUSTCART_CLIENTS` | เปิด OAuth 2.0 สำหรับระบบภายนอก: `client_id:secret:scope scope;...` | `/oauth/token` ตอบ 503 (ยังไม่ตั้งค่า) |
| `TRUSTCART_TOKEN_KEY` | กุญแจลงนามโทเคน (สุ่มยาว ≥ 32 ตัวอักษร) | สร้างจากรายการ client |
| `TRUSTCART_TOKEN_TTL` | อายุโทเคน (วินาที) | `900` |
| `REGISTRY_SOURCE` | เลือกแหล่งทะเบียน (Registry Adapter) | `mock` |

> server อ่าน `.env.local` ตอนเริ่มทำงาน แต่ **ไม่ทับ** ค่าที่ตั้งไว้ใน environment จริง

---

## 3. รันและทดสอบบนเครื่อง

```bash
.venv/Scripts/python -m pytest -q
```

ต้องได้ `20 passed` (เทสต์ปิด gate และ AI ให้อัตโนมัติ ไม่เรียกเครือข่าย)

```bash
.venv/Scripts/python -m uvicorn backend.app.main:app --port 8000
```

| URL | ใช้ทำอะไร |
|---|---|
| http://localhost:8000 | หน้าเดโม (ผู้ซื้อ / ผู้ขาย / เจ้าหน้าที่ / ปลั๊กอินเอพีไอ) |
| http://localhost:8000/docs | เอกสาร API (Swagger) |
| http://localhost:8000/login | หน้าล็อกอิน (เมื่อตั้ง `TRUSTCART_PASSWORD`) |

ตรวจด่วนด้วย curl:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/v1/listings
```

ได้ `200` = ไม่มีรหัสผ่าน · ได้ `401` = gate ทำงาน

---

## 4. Deploy ขึ้น Vercel (ครั้งแรก)

### 4.1 ไฟล์ที่ Vercel ใช้ (มีใน repo แล้ว)

| ไฟล์ | หน้าที่ |
|---|---|
| `api/index.py` | entrypoint: `from backend.app.main import app` |
| `vercel.json` | รวม `backend/` และ `frontend/` เข้าไปในฟังก์ชัน (`includeFiles`) — **ไม่มี rewrites** |
| `requirements.txt` | dependency ที่ Vercel ติดตั้ง (`fastapi`, `python-multipart`, `httpx`) |
| `.vercelignore` | ไม่อัปโหลด `.venv`, `tests`, `docs`, `.env*`, `.git` |

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

### 4.2 ล็อกอิน Vercel CLI

```bash
npx --yes vercel@latest login
```

เปิดลิงก์ที่ CLI แสดง แล้วกด Approve ในเบราว์เซอร์ รอจนขึ้น *Congratulations! You are now signed in*

> ต้องใส่ `--yes` ไม่อย่างนั้น npm จะถามว่า "Ok to proceed? (y)" ก่อน และถ้ายกเลิก การล็อกอินจะไม่เกิดขึ้น

ตรวจสอบ:

```bash
npx --yes vercel@latest whoami
```

### 4.3 สร้างและผูกโปรเจกต์ (ชื่อต้องเป็นตัวพิมพ์เล็ก)

```bash
npx --yes vercel@latest link --yes --project trustcart-bluescreen
```

> ⚠️ `vercel link` อาจเชื่อม GitHub repo ให้อัตโนมัติ ถ้าไม่ต้องการ auto-deploy จาก Git ให้ตัดการเชื่อม:

```bash
npx --yes vercel@latest git disconnect --yes
```

### 4.4 ตั้งค่า Environment Variables บน Vercel

ตั้งรหัสผ่าน (พิมพ์ค่าเมื่อ CLI ถาม — อย่าใส่ค่าไว้ในคำสั่งที่ถูกบันทึกในประวัติ shell):

```bash
npx --yes vercel@latest env add TRUSTCART_PASSWORD production
```

(ไม่บังคับ) เปิด OAuth 2.0 สำหรับ API client — สร้างค่าลับแบบสุ่มก่อน แล้วพิมพ์เมื่อ CLI ถาม:

```bash
python -c "import secrets;print('shopee-sandbox-demo:'+secrets.token_urlsafe(24)+':verifications:write reports:read')"
```

```bash
npx --yes vercel@latest env add TRUSTCART_CLIENTS production
```

```bash
npx --yes vercel@latest env add TRUSTCART_TOKEN_KEY production
```

ทดสอบ (แทนค่า client_id/secret ของคุณ):

```bash
curl -s -X POST https://trustcart-bluescreen.vercel.app/oauth/token -d grant_type=client_credentials -d client_id=$CLIENT_ID -d client_secret=$CLIENT_SECRET
```

(ไม่บังคับ) เปิด AI:

```bash
npx --yes vercel@latest env add OPENAI_API_KEY production
```

หรือตั้งผ่านหน้าเว็บ: **Vercel → Project → Settings → Environment Variables** แล้ว redeploy

### 4.5 Deploy

```bash
npx --yes vercel@latest deploy --prod --yes
```

ผลลัพธ์จะมีบรรทัด `Production URL: https://trustcart-bluescreen.vercel.app`

> ถ้าเจอ *"The commit author doesn't have access to this team"* ดูข้อ 6.3

---

## 5. ตรวจสอบหลัง deploy

```bash
curl -s -o /dev/null -w "API without login: %{http_code}\n" https://trustcart-bluescreen.vercel.app/v1/listings
```

ต้องได้ `401` (ถ้าตั้งรหัสผ่าน)

```bash
curl -s -o /dev/null -w "Page: %{http_code} -> %{redirect_url}\n" -H "accept: text/html" https://trustcart-bluescreen.vercel.app/
```

ต้องได้ `303 -> .../login`

จากนั้นเปิดเว็บในหน้าต่าง **ไม่ระบุตัวตน (incognito)** → ล็อกอิน → ตรวจ:

- [ ] การ์ดสินค้า 7 รายการแสดงสถานะ
- [ ] เปิด L1 เห็นการ์ด **13-1-02954-5-0088 ≠ OfficeCare Turmeric**
- [ ] สลับภาษา ไทย ↔ English แล้วไม่มีคำของอีกภาษาหลงเหลือ
- [ ] แท็บผู้ตรวจ → ย้อนดูขั้นตอน → 🔐 ตรวจบันทึก → 🧪 จำลองการแก้ไข → ตรวจพบการแก้ไข
- [ ] ปุ่ม 🟢/🔴 ทะเบียน ทำให้ทุกรายการเป็น Unknown
- [ ] แท็บปลั๊กอินเอพีไอ → เรียกเอพีไอจริงได้ผล JSON
- [ ] ปุ่มออกจากระบบ พากลับไปหน้าล็อกอิน
- [ ] `/docs` เปิดได้หลังล็อกอิน

> หลัง deploy ใหม่ ถ้าเห็นผลเก่าอยู่ (เช่น 404 ที่ endpoint ใหม่) ให้รอ 10–30 วินาทีให้โดเมนสลับไปยัง deployment ใหม่

---

## 6. ปัญหาที่เจอจริง และวิธีแก้

| # | อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|---|
| 6.1 | `Error: No existing credentials found` | CLI ยังไม่ได้ล็อกอิน (ล็อกอินบนเว็บไม่นับ) หรือคำสั่ง login ถูกยกเลิกที่ prompt ของ npm | รัน `npx --yes vercel@latest login` ให้จบ |
| 6.2 | `Project names ... must be lowercase` | ชื่อโฟลเดอร์มีตัวพิมพ์ใหญ่ (`TrustCart_BlueScreen`) | `vercel link --yes --project trustcart-bluescreen` |
| 6.3 | `The commit author doesn't have access to this team` | Vercel อ่านผู้ commit จาก `.git` แล้วผู้นั้นไม่ได้เป็นสมาชิก Team | **ทางถาวร:** เพิ่มบัญชี GitHub/อีเมลนั้นเข้า Team · **ทางเร็ว:** deploy จากสำเนาที่ไม่มี `.git` (ดูด้านล่าง) |
| 6.4 | ทุก path ได้ `{"detail":"Not Found"}` | `vercel.json` มี rewrite ไป `/api/index` ทำให้ FastAPI เห็น path ผิด | ลบ `rewrites` ออก ให้ Vercel ใช้การรองรับ FastAPI ในตัว |
| 6.5 | 500 / หาไฟล์ไม่เจอ (`index.html`, `registry.json`) | ไฟล์ไม่ได้ถูกรวมเข้าฟังก์ชัน | `includeFiles: "{backend,frontend}/**"` ใน `vercel.json` |
| 6.6 | อัปโหลดหลักฐานแล้ว error `python-multipart` | ลืม dependency สำหรับ form | มีใน `requirements.txt` แล้ว |
| 6.7 | `TypeError: unsupported operand type(s) for \|` | Python 3.9 ไม่รองรับ `str \| None` ใน signature ของ FastAPI | ใช้ `Optional[str]` (ดู `AGENTS.md`) |
| 6.8 | หน้าเว็บบนเครื่องเข้าได้โดยไม่ต้องใช้รหัส | ไม่ได้ตั้ง `TRUSTCART_PASSWORD` บนเครื่อง | ใส่ใน `.env.local` (ข้อ 2) |
| 6.9 | ข้อมูลเดโมรีเซ็ตเอง | ข้อมูลอยู่ในหน่วยความจำ และ serverless อาจเริ่มใหม่ (cold start) | กด ↺ ก่อนนำเสนอ · ระยะยาวใช้ Supabase |

### Deploy จากสำเนาที่ไม่มี `.git` (แก้ข้อ 6.3)

macOS / Linux / Git Bash:

```bash
D=$(mktemp -d) && cp -r api backend frontend .vercel requirements.txt vercel.json .vercelignore "$D"/ && (cd "$D" && npx --yes vercel@latest deploy --prod --yes)
```

> คัดลอก `.vercel/` ไปด้วยเพื่อให้ deploy เข้าโปรเจกต์เดิม · **อย่าคัดลอก `.env.local`**

---

## 7. งานเสริม (ไม่จำเป็นต่อการ deploy)

### 7.1 สร้างไดอะแกรมใหม่จาก Mermaid

ต้นฉบับอยู่ที่ `docs/diagrams/*.mmd` (GitHub แสดงผลให้อัตโนมัติ)

```bash
npx -p @mermaid-js/mermaid-cli@11.4.2 mmdc -i docs/diagrams/01-infrastructure.mmd -o docs/diagrams/01-infrastructure.svg -b white
```

> ถ้าเจอ *Could not find Chrome* ให้สร้างไฟล์ `puppeteer.json` ที่ชี้ไปยัง Chrome/Edge ที่ติดตั้งไว้ แล้วเพิ่ม `-p puppeteer.json`:
> `{"executablePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "headless": "shell"}`

### 7.2 สร้างสไลด์ใหม่

```bash
npm install pptxgenjs@3.12.0
```

```bash
node docs/deck/build_deck.js --full
```

ได้ `docs/deck/TrustCart_Pitch_Full.pptx` (25 สไลด์) · ไม่ใส่ `--full` ได้ `TrustCart_Research_Architecture.pptx` (12 สไลด์)

> ปิดไฟล์ใน PowerPoint ก่อน ไม่อย่างนั้นจะเจอ `EBUSY` · ใส่ไฟล์ขึ้น Google Drive แบบ "แปลงเป็น Google Slides" เพื่อให้ทีมแก้ไขร่วมกันได้

---

## 8. Checklist ความปลอดภัยก่อน push / deploy

- [ ] `git status` ไม่มี `.env*`
- [ ] `git ls-files | grep -i env` ไม่มีไฟล์ env
- [ ] รหัสผ่านและ API key อยู่ใน Vercel Environment Variables หรือ `.env.local` เท่านั้น
- [ ] `.vercelignore` มี `.env*` (ป้องกันการอัปโหลดไฟล์ลับเมื่อ deploy จากโฟลเดอร์ repo)
- [ ] เปลี่ยนรหัสผ่านเดโมหลังจบงาน (Vercel → Settings → Environment Variables → แก้ค่า → Redeploy)

---

## ภาคผนวก: โครงสร้างโปรเจกต์

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
├── README.md · DEMO.md · AGENTS.md · DEPLOY.md · GAPS_AND_QA.md
```
