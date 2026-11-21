# Agency workspace / พื้นที่งานเจ้าหน้าที่

## Marketplace queue / คิวแยกตาม Marketplace

`GET /v1/reviewer/queue` requires the existing reviewer session. It lists only current verification submissions, with marketplace, work-queue, result and product/reference search filters. Queue counts respect marketplace/search/result filters and do not depend on the selected work queue. Seller edits remove superseded submissions from the queue.

API นี้ใช้ session ของ reviewer และแสดงเฉพาะคำขอตรวจฉบับปัจจุบัน กรอง marketplace กลุ่มงาน ผลตรวจ และชื่อสินค้าหรือเลขอ้างอิงได้ จำนวนในแต่ละกลุ่มคำนวณตามตัวกรองอื่นโดยไม่ขึ้นกับกลุ่มที่เลือก เมื่อผู้ขายแก้ไขสินค้า คำขอฉบับเก่าจะไม่แสดงในคิว

Existing local products are additively backfilled as `shopee` in their persisted metadata; product versions and verification snapshots are preserved. New local storefront products are Shopee products. Sellers cannot change marketplace attribution through listing input. Lazada is a supported filter with no seeded products or live connection.

ข้อมูลสินค้าท้องถิ่นเดิมและสินค้าใหม่ระบุเป็น `shopee` โดยเก็บข้อมูลไว้ในฐานข้อมูลเดิม ไม่เปลี่ยนเวอร์ชันหรือผลตรวจ ผู้ขายเปลี่ยน marketplace ผ่านแบบฟอร์มสินค้าไม่ได้ Lazada เป็นตัวกรองที่รองรับแต่ยังไม่มีสินค้าตัวอย่างหรือการเชื่อมต่อจริง

Work queues: To review (`REVIEWER_REQUIRED`, `UNAVAILABLE`); In progress (`AI_CHECKING`, `IN_REVIEW`); Waiting for documents (`WAITING_DOCUMENTS`); Seller correction (`SELLER_ACTION`); Completed (`COMPLETED`). Verification results remain APPROVED / PENDING / DENIED / UNKNOWN independently of these work groups. Registry data remains synthetic, not official certification.

กลุ่มงาน: รอเจ้าหน้าที่ตรวจ, กำลังดำเนินการ, รอเอกสาร, รอผู้ขายแก้ไข และเสร็จสิ้น แยกจากผลตรวจ APPROVED / PENDING / DENIED / UNKNOWN ข้อมูลทะเบียนเป็นข้อมูลจำลอง ไม่ใช่การรับรองอย่างเป็นทางการ

## Start review / เริ่มตรวจ

`POST /v1/reviewer/submissions/{id}/start-review` accepts the current `chain_hash`. Only current cases in `REVIEWER_REQUIRED` or `UNAVAILABLE` can enter `IN_REVIEW`. The reviewer identity and supplied hash are appended through `Trace.add`; status, confidence and recorded rule results do not change. Stale hashes, invalid audits, completed/waiting cases and superseded products are rejected. Staff may use the existing decision endpoint after starting review.

การเริ่มตรวจต้องใช้ `chain_hash` ล่าสุด และใช้ได้เฉพาะคำขอปัจจุบันที่รอเจ้าหน้าที่หรือยังตรวจไม่ได้ ระบบบันทึกผู้ตรวจและ hash ในประวัติ และเปลี่ยนเฉพาะกลุ่มงานเป็น `IN_REVIEW` โดยไม่เปลี่ยนผลตรวจ ความมั่นใจ หรือผลกฎ hash เก่า ประวัติไม่ถูกต้อง งานที่ยังรอเอกสาร งานเสร็จแล้ว และฉบับเก่าจะถูกปฏิเสธ หลังเริ่มตรวจใช้ endpoint ตัดสินใจเดิมได้

## Dashboard / แดชบอร์ด

`/agency` is protected by the existing reviewer role in local and hosted entrypoints. The Thai-first dashboard remembers a Thai/English preference, defaults to To review, preserves filters in its URL and refreshes the queue every ten seconds while visible. Marketplace and verification result are independent filters. The Agency page has no cross-role demo tabs. Loading, empty and failed refresh states are explicit; failed requests hide stale results.

หน้า `/agency` ใช้สิทธิ์ reviewer ทั้งการรันในเครื่องและ entrypoint สำหรับโฮสต์ เริ่มต้นเป็นภาษาไทยและจำภาษาที่เลือก กรองกลุ่มงาน Marketplace และผลตรวจแยกกัน เก็บตัวกรองใน URL และรีเฟรชทุกสิบวินาทีเมื่อเปิดหน้านี้อยู่ ไม่มีแท็บสลับบทบาทบนหน้า Agency และแสดงสถานะกำลังโหลด ไม่มีข้อมูล หรือโหลดล้มเหลวอย่างชัดเจน

## Product reports / รายงานสินค้า

Open `/agency/submissions/{id}` to inspect a submitted listing, original documents, recorded rules, AI extraction findings, submission revisions and the hash-chained trace. The Back link keeps marketplace/work/result/search filters. Reports never poll over draft decisions. Refresh asks before discarding unsaved form fields. Language switching preserves notes and inspection checkboxes. A stale action blocks further writes until an explicit reload. Previous revisions and invalid audits have no decision controls.

เปิดรายงานสินค้าที่ `/agency/submissions/{id}` เพื่อดูข้อมูลที่ส่งตรวจ เอกสารต้นฉบับ ผลกฎ สิ่งที่ AI สกัด ประวัติคำขอ และประวัติ hash ปุ่มกลับคงตัวกรองเดิม รายงานไม่รีเฟรชอัตโนมัติทับข้อมูลที่กำลังกรอก หากกดรีเฟรชจะถามก่อนทิ้งข้อมูลที่ยังไม่บันทึก การสลับภาษาไม่ล้างหมายเหตุหรือช่องยืนยันเอกสาร การใช้ hash เก่าจะปิดการเขียนจนกว่าจะโหลดรายงานใหม่ ฉบับเก่าและประวัติไม่ถูกต้องไม่มีปุ่มตัดสินใจ

The dashboard/report use the existing reviewer session, with no extra Agency role. Login redirects staff to `/agency`, and authenticated legacy `/reviewer?id={id}` links redirect to the case page. Original document access remains private. Queue refreshes update local seller submissions; recorded staff decisions update seller views and public badge eligibility through the same saved workflow. This is a local shared-database flow, not an external Shopee/Lazada connector. No PDF export, bulk decisions or reviewer assignment is added.

แดชบอร์ดและรายงานใช้ session reviewer เดิม ไม่เพิ่มบทบาท Agency บัญชีเจ้าหน้าที่เข้าสู่ `/agency` และลิงก์ `/reviewer?id={id}` เดิมส่งต่อไปยังรายงาน เอกสารยังเป็นส่วนตัว คิวอ่านคำขอล่าสุดของผู้ขายและคำตัดสินอัปเดตผลบนหน้าผู้ขายและสิทธิ์แสดงเครื่องหมายบนหน้าลูกค้าผ่านระบบบันทึกเดียวกัน ไม่ใช่การเชื่อมต่อ Shopee/Lazada ภายนอก ยังไม่มีส่งออก PDF ตัดสินใจหลายรายการ หรือมอบหมายผู้ตรวจ

## Validation / การทดสอบ

Local validation: 143 Python tests, 120 frontend tests and 28 desktop/mobile browser checks passed. Browser scenarios cover approval propagation, correction requests, original document access, language persistence, deep links and stale hashes. Screenshots are saved under `artifacts/ui/agency-*.png`. Hosted PostgreSQL and live marketplace integrations were not validated.

ทดสอบในเครื่องผ่าน 143 Python tests, 120 frontend tests และ 28 browser checks บน desktop/mobile ครอบคลุมการส่งผลอนุมัติถึงหน้าร้าน การขอแก้ไข การเปิดเอกสาร ภาษา ลิงก์รายงาน และ hash เก่า เก็บภาพใน `artifacts/ui/agency-*.png` ยังไม่ทดสอบ PostgreSQL บนโฮสต์หรือการเชื่อมต่อ Marketplace จริง

## Automatic seller pre-checks / ตรวจเบื้องต้นอัตโนมัติ

After evidence preparation, the seller chooses Submit for review. The server calls both OpenAI document and listing-claim extractors, validates/grounds the findings and runs deterministic rules before routing to Agency. Seller and Agency reports share a two-entry pre-check checklist plus R-01–R-05 results. A clean assessment remains PENDING with no badge. Every new assessed case, including explicitly selected synthetic Replay, requires Agency review. Provider errors are UNKNOWN, preserve completed findings and cannot be approved until missing checks succeed. Reviewer approvals rerun rules against saved grounded findings and confirmed original documents. No AI provider is called while holding database write locks.

หลังเตรียมเอกสาร ผู้ขายกด Submit for review เซิร์ฟเวอร์เรียก OpenAI สกัดข้อมูลเอกสารและคำกล่าวอ้าง ตรวจว่าข้อความตรงกับข้อมูลจริง แล้วใช้กฎประเมินก่อนส่ง Agency รายงานผู้ขายและ Agency ใช้เช็กลิสต์เอกสาร/คำกล่าวอ้างร่วมกับผล R-01–R-05 ผลผ่านเบื้องต้นยังเป็น PENDING ไม่มีเครื่องหมาย ทุกคำขอใหม่รวม Replay ต้องให้ Agency ตรวจ หากผู้ให้บริการไม่พร้อมเป็น UNKNOWN โดยเก็บผลส่วนที่ตรวจได้ และอนุมัติไม่ได้จนกว่าจะตรวจส่วนที่ขาดสำเร็จ การอนุมัติรันกฎซ้ำจากผลสกัดที่บันทึกและข้อมูลจากเอกสารต้นฉบับ ไม่มีการเรียก AI ขณะล็อกฐานข้อมูลเพื่อเขียน
