"use strict";
window.AgencyUI = (() => {
  const words = {
    workspace: ["พื้นที่งานเจ้าหน้าที่", "Agency workspace"],
    dashboard: ["ภาพรวมการตรวจสอบ", "Verification dashboard"],
    title: ["การตรวจสอบสินค้าจาก Marketplace", "Marketplace verification"],
    subtitle: [
      "ติดตามคำขอตรวจ เอกสาร และผลตรวจสินค้าในพื้นที่เดียว",
      "Review submissions, documents and product decisions in one workspace.",
    ],
    queues: ["กลุ่มงาน", "Work queues"],
    all: ["คำขอทั้งหมด", "All submissions"],
    to_review: ["รอเจ้าหน้าที่ตรวจ", "To review"],
    in_progress: ["กำลังดำเนินการ", "In progress"],
    waiting_documents: ["รอเอกสาร", "Waiting for documents"],
    seller_correction: ["รอผู้ขายแก้ไข", "Seller correction"],
    completed: ["เสร็จสิ้น", "Completed"],
    sources: ["Marketplace", "Marketplace"],
    all_sources: ["ทุก Marketplace", "All marketplaces"],
    result: ["ผลตรวจ", "Verification result"],
    all_results: ["ทุกผลตรวจ", "All results"],
    APPROVED: ["ผ่านการตรวจ", "Approved"],
    PENDING: ["รอดำเนินการ", "Pending"],
    DENIED: ["ไม่ผ่านการตรวจ", "Denied"],
    UNKNOWN: ["ยังยืนยันไม่ได้", "Unable to verify"],
    search: [
      "ค้นหาชื่อสินค้าหรือเลขอ้างอิงทะเบียน",
      "Search product or registration reference",
    ],
    search_button: ["ค้นหา", "Search"],
    refresh: ["รีเฟรช", "Refresh"],
    reset: ["ล้างตัวกรอง", "Clear filters"],
    product: ["สินค้า / เลขอ้างอิง", "Product / reference"],
    marketplace: ["Marketplace / ร้านค้า", "Marketplace / shop"],
    stage: ["กลุ่มงาน / ขั้นตอน", "Work stage"],
    next: ["ขั้นตอนถัดไป", "Next action"],
    updated: ["อัปเดตล่าสุด", "Last activity"],
    open: ["เปิดรายงาน", "Open report"],
    loading: ["กำลังโหลดคำขอตรวจ…", "Loading submissions…"],
    error: [
      "โหลดข้อมูลไม่ได้ ผลเดิมถูกซ่อนไว้ กรุณาลองอีกครั้ง",
      "Could not load data. Previous results are hidden. Please retry.",
    ],
    retry: ["ลองอีกครั้ง", "Retry"],
    empty: ["ไม่พบคำขอตรวจที่ตรงกับตัวกรอง", "No submissions match these filters"],
    empty_hint: [
      "ปรับตัวกรองเพื่อดูคำขอตรวจอื่น",
      "Change the filters to see other submissions.",
    ],
    lazada_empty: [
      "ยังไม่มีคำขอตรวจจาก Lazada ไม่มีการเชื่อมต่อ Marketplace จริงในเวอร์ชันนี้",
      "No Lazada submissions yet. This version has no live marketplace connection.",
    ],
    demo: [
      "ข้อมูลทะเบียนจำลอง · ไม่ใช่การรับรองจาก อย.",
      "Synthetic registry · Not official Thai FDA certification",
    ],
    local: ["เชื่อมข้อมูลกับหน้าร้านท้องถิ่น", "Shared with the local storefront"],
    auto_refresh: [
      "รีเฟรชคิวอัตโนมัติทุก 10 วินาที",
      "Queue refreshes every 10 seconds",
    ],
    signout: ["ออกจากระบบ", "Sign out"],
    account: ["บัญชีเจ้าหน้าที่", "Staff account"],
    skip: ["ข้ามไปที่เนื้อหาหลัก", "Skip to main content"],
    language: ["ภาษา", "Language"],
    REVIEWER_REQUIRED: ["รอเริ่มตรวจโดยเจ้าหน้าที่", "Awaiting staff review"],
    IN_REVIEW: ["เจ้าหน้าที่กำลังตรวจ", "Staff reviewing"],
    AI_CHECKING: ["ระบบกำลังตรวจเอกสาร", "Automated checking"],
    WAITING_DOCUMENTS: ["รอผู้ขายส่งเอกสาร", "Awaiting seller documents"],
    SELLER_ACTION: ["รอผู้ขายแก้ไขข้อมูล", "Awaiting seller correction"],
    COMPLETED: ["ตรวจเสร็จแล้ว", "Review completed"],
    UNAVAILABLE: ["ระบบตรวจสอบยังไม่พร้อม", "Verification unavailable"],
    SUPERSEDED: ["คำขอฉบับก่อนหน้า", "Previous revision"],
    next_review: [
      "เริ่มตรวจและตรวจเอกสารต้นฉบับ",
      "Start review and inspect original documents",
    ],
    next_staff: [
      "ตรวจหลักฐานและบันทึกคำตัดสิน",
      "Inspect evidence and record a decision",
    ],
    next_auto: ["รอผลตรวจจากระบบ", "Wait for automated results"],
    next_docs: ["ผู้ขายต้องส่งเอกสาร", "Seller to provide documents"],
    next_correction: ["ผู้ขายต้องแก้ไขหรือส่งใหม่", "Seller to correct or resubmit"],
    next_done: ["เปิดดูรายงานผลตรวจ", "View the recorded result"],
    next_unknown: [
      "ตรวจข้อมูลที่ยังยืนยันไม่ได้",
      "Investigate unresolved verification",
    ],
    back: ["กลับไปที่คิวงาน", "Back to work queue"],
    report: ["รายงานการตรวจสอบสินค้า", "Product verification report"],
    overview: ["ข้อมูลคำขอตรวจ", "Submission overview"],
    documents: ["เอกสารต้นฉบับ", "Original documents"],
    checks: ["ผลตรวจกฎและสิ่งที่พบ", "Checks and findings"],
    history: ["ประวัติและการตรวจสอบย้อนหลัง", "History and audit trail"],
    decision: ["การตัดสินใจของเจ้าหน้าที่", "Staff decision"],
    start: ["เริ่มตรวจ", "Start review"],
    approve: ["ผ่านการตรวจ", "Approve"],
    deny: ["ไม่ผ่านการตรวจ", "Deny"],
    request: ["ขอเอกสารหรือให้ผู้ขายแก้ไข", "Request documents / correction"],
    reason: ["เหตุผล / คำแนะนำสำหรับผู้ขาย", "Reason / instructions for seller"],
    inspect: ["ฉันตรวจเอกสารต้นฉบับนี้แล้ว", "I inspected this original document"],
    product_name: ["ชื่อสินค้าตามเอกสาร", "Product name from document"],
    registration_reference: [
      "เลขอ้างอิงทะเบียนตามเอกสาร",
      "Registration reference from document",
    ],
    license_holder: ["ผู้ถือใบอนุญาตตามเอกสาร", "Licence holder from document"],
    action_help: [
      "เริ่มตรวจ แล้วตรวจเอกสารต้นฉบับและยืนยันข้อมูลก่อนอนุมัติ ผลกฎที่ไม่ผ่านไม่สามารถข้ามได้",
      "Start review, inspect original documents and confirm identity before approval. Failed rules cannot be overridden.",
    ],
    saved: [
      "บันทึกแล้ว หน้าผู้ขายและหน้าลูกค้าใช้ผลล่าสุดนี้",
      "Saved. Seller and customer views now use this result.",
    ],
    stale: [
      "ข้อมูลมีการเปลี่ยนแปลงหรือยังไม่พร้อมดำเนินการ โปรดรีเฟรชรายงานก่อนลองอีกครั้ง",
      "The case changed or is not ready for this action. Refresh the report before trying again.",
    ],
    reload_confirm: [
      "การรีเฟรชจะล้างข้อมูลที่ยังไม่บันทึก ต้องการรีเฟรชหรือไม่",
      "Refreshing clears unsaved inputs. Refresh this report?",
    ],
    not_found: [
      "ไม่พบรายงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึง",
      "Report not found or access is unavailable",
    ],
    report_loading: ["กำลังโหลดรายงาน…", "Loading report…"],
    historical: [
      "รายงานนี้เป็นฉบับก่อนหน้า ใช้สำหรับอ่านประวัติเท่านั้น",
      "This is a previous revision, available for history only.",
    ],
    no_docs: ["ยังไม่มีเอกสารแนบ", "No documents attached"],
    missing_docs: ["เอกสารที่ยังขาด", "Missing documents"],
    no_checks: ["ยังไม่มีผลตรวจที่บันทึกไว้", "No checks have been recorded yet"],
    pass: ["ผ่าน", "Passed"],
    fail: ["ไม่ผ่าน", "Failed"],
    skip_check: ["ยังไม่ได้ตรวจ / ไม่ใช้กับกรณีนี้", "Not checked / not applicable"],
    label: ["ฉลากสินค้า", "Product label"],
    certificate: ["เอกสารทะเบียน", "Registration document"],
    permit: ["ใบอนุญาตโฆษณา", "Advertising permit"],
    supporting: ["เอกสารเพิ่มเติม", "Supporting document"],
    confidence: [
      "ความมั่นใจในการสกัดข้อมูล ไม่ใช่โอกาสที่สินค้าจะเป็นของแท้",
      "Extraction confidence, not authenticity probability",
    ],
    findings: ["สิ่งที่พบในเอกสาร", "Document findings"],
    audit_valid: ["ประวัติการตรวจสอบถูกต้อง", "Audit chain valid"],
    audit_invalid: [
      "ประวัติไม่ถูกต้อง ปิดการดำเนินการ",
      "Audit invalid. Actions blocked.",
    ],
    revisions: ["ฉบับคำขอตรวจ", "Submission revisions"],
    revision: ["ฉบับที่", "Revision"],
    view_product: ["ดูหน้าสินค้า", "View product"],
    read_only: [
      "ไม่มีการดำเนินการในขั้นตอนนี้ เปิดรายงานเพื่อดูผลและขั้นตอนถัดไป",
      "No staff action is available at this stage. Review the result and next steps.",
    ],
    operation_failed: [
      "บันทึกไม่ได้ โปรดตรวจข้อมูลและเอกสาร แล้วลองอีกครั้ง",
      "Could not save. Check the inputs and documents, then retry.",
    ],
    owner: ["ร้านค้า", "Shop"],
    snapshot: ["ข้อมูลสินค้าที่ส่งตรวจ", "Submitted listing"],
    description: ["รายละเอียดสินค้า", "Description"],
    category: ["หมวดหมู่", "Category"],
    mode: ["รูปแบบการตรวจ", "Assessment mode"],
    replay: ["ข้อมูลจำลองแบบ Replay", "Synthetic replay"],
    live: ["การสกัดข้อมูลเอกสารด้วย AI", "Live document extraction"],
    not_assessed: ["ยังไม่ได้ประเมิน", "Not assessed"],
    no_history: ["ยังไม่มีประวัติ", "No history available"],
    page: ["หน้า", "Page"],
    note: ["หมายเหตุ", "Note"],
    refresh_needed: [
      "ไม่สามารถดำเนินการต่อได้จนกว่าจะโหลดรายงานใหม่",
      "Reload the report before taking further action",
    ],
    signed_in: ["เข้าสู่ระบบเป็น", "Signed in as"],
  };
  let lang = "th";
  try {
    lang =
      localStorage.getItem("trustcart-agency-language") === "en" ? "en" : "th";
  } catch (_) {}
  const t = (key) => words[key]?.[lang === "th" ? 0 : 1] || key;
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const date = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.valueOf())
      ? "—"
      : new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Bangkok",
        }).format(d);
  };
  const next = (stage) =>
    t(
      {
        REVIEWER_REQUIRED: "next_review",
        IN_REVIEW: "next_staff",
        AI_CHECKING: "next_auto",
        WAITING_DOCUMENTS: "next_docs",
        SELLER_ACTION: "next_correction",
        COMPLETED: "next_done",
        UNAVAILABLE: "next_unknown",
      }[stage] || "next_unknown",
    );
  function translate() {
    document.documentElement.lang = lang;
    document
      .querySelectorAll("[data-i18n]")
      .forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document
      .querySelectorAll("[data-placeholder]")
      .forEach((el) => (el.placeholder = t(el.dataset.placeholder)));
    document
      .querySelectorAll("[data-aria]")
      .forEach((el) => el.setAttribute("aria-label", t(el.dataset.aria)));
    document.querySelector("#agency-language").value = lang;
  }
  function setLanguage(value) {
    lang = value === "en" ? "en" : "th";
    try {
      localStorage.setItem("trustcart-agency-language", lang);
    } catch (_) {}
    translate();
    window.dispatchEvent(new Event("agency-language"));
  }
  async function session() {
    const account = await window.TrustCartSession.ready;
    if (account.role !== "reviewer") {
      location.href = "/login";
      return null;
    }
    document.querySelector("#agency-account").textContent = account.id;
    document.querySelector("#agency-signout").onclick = async () => {
      await window.TrustCartSession.api("/v1/auth/logout", { method: "POST" });
      location.href = "/login";
    };
    return account;
  }
  function init() {
    translate();
    document.querySelector("#agency-language").onchange = (e) =>
      setLanguage(e.target.value);
  }
  function returnQuery() {
    const params = new URLSearchParams(location.search);
    return new URLSearchParams(
      [...params].filter(([key]) =>
        ["marketplace", "work_queue", "status", "q"].includes(key),
      ),
    );
  }
  return {
    t,
    node,
    date,
    next,
    init,
    session,
    returnQuery,
    get lang() {
      return lang;
    },
  };
})();
