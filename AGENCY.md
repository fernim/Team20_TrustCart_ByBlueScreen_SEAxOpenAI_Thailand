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
