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
        result.status === "APPROVED" && result.stage === "COMPLETED"
          ? text(
              "ผ่านการตรวจตามกฎและเกณฑ์ความมั่นใจแล้ว ไม่ต้องอนุมัติซ้ำ ข้อมูลทะเบียนเป็นข้อมูลจำลอง",
              "Passed the required rules and confidence threshold. No additional approval is needed. Registry data is synthetic.",
            )
          : result.status === "DENIED"
            ? text(
                "พบข้อที่ไม่ผ่าน ต้องแก้ไขและส่งตรวจฉบับใหม่",
                "Required checks failed. Correct the listing and submit a new revision.",
              )
            : text(
                "กรณีไม่แน่ใจหรือข้อมูลไม่ครบจะส่งให้ Agency ตรวจ ผลที่ยังยืนยันไม่ได้ไม่มีเครื่องหมาย",
                "Uncertain or incomplete evidence goes to Agency. Unconfirmed results receive no badge.",
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
