"use strict";
window.TrustCartChecklist = (() => {
  function render(result, language = "th") {
    const en = language === "en";
    const text = (th, english) => (en ? english : th);
    const node = (tag, value, className) => {
      const element = document.createElement(tag);
      if (value !== undefined) element.textContent = value;
      if (className) element.className = className;
      return element;
    };
    const section = node("section", undefined, "automated-checklist");
    section.append(
      node("h3", text("เช็กลิสต์ก่อนส่ง Agency", "Pre-review checklist")),
    );
    const list = node("ul");
    for (const [key, label] of [
      [
        "document_check",
        text(
          "เอกสาร: ความครบถ้วนและข้อมูลที่อ่านได้",
          "Documents: completeness and extracted fields",
        ),
      ],
      [
        "claim_check",
        text(
          "คำกล่าวอ้าง: ข้อความตรงกับรายการสินค้า",
          "Claims: grounded listing text",
        ),
      ],
    ]) {
      const check = result[key] || {};
      const state =
        check.state === "unavailable"
          ? "unavailable"
          : check.state === "checking"
            ? "checking"
            : check.state === "completed"
              ? check.result || "review"
              : "not_run";
      const labels = {
        pass: text("ผ่านการตรวจเบื้องต้น", "Pre-check passed"),
        fail: text("พบข้อที่ไม่ผ่าน", "Failed findings"),
        review: text("ต้องให้เจ้าหน้าที่ตรวจ", "Needs human review"),
        unavailable: text("ตรวจไม่ได้ ต้องลองใหม่", "Unavailable — retry required"),
        checking: text("กำลังตรวจ", "Checking"),
        not_run: text("ยังไม่ได้ตรวจ", "Not checked"),
      };
      const item = node("li");
      item.dataset.check = key;
      item.dataset.state = state;
      item.append(
        node("strong", label),
        node("span", labels[state] || labels.review),
      );
      list.append(item);
    }
    section.append(list);
    if (result.claim_check?.state === "completed") {
      for (const claim of result.claim_check.claims || [])
        section.append(node("blockquote", claim.phrase));
    }
    section.append(
      node(
        "p",
        text(
          "ผลเบื้องต้นไม่ใช่การอนุมัติ ต้องให้ Agency ตรวจและยืนยันก่อนแสดงเครื่องหมาย",
          "Pre-checks are not approval. Agency must review and confirm before a badge is granted.",
        ),
      ),
    );
    if (result.mode === "replay")
      section.append(
        node(
          "p",
          text(
            "Replay ใช้ข้อมูลจำลอง ไม่ได้เรียก OpenAI",
            "Replay uses synthetic fixtures and does not call OpenAI.",
          ),
        ),
      );
    return section;
  }
  return { render };
})();
