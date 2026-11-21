"use strict";
window.TrustCartFlow = (() => {
  const stages = {
    NOT_REQUESTED: "ยังไม่ขอตรวจ / Not requested",
    WAITING_DOCUMENTS: "รอเอกสาร / Waiting for documents",
    AI_CHECKING: "AI กำลังตรวจ / AI checking",
    REVIEWER_REQUIRED: "รอเจ้าหน้าที่ / Reviewer required",
    SELLER_ACTION: "ผู้ขายต้องแก้ไข / Seller action",
    COMPLETED: "ตรวจเสร็จแล้ว / Completed",
    UNAVAILABLE: "ยังตรวจไม่ได้ / Unavailable",
    SUPERSEDED: "ฉบับก่อนหน้า / Previous revision",
  };
  const kinds = {
    label: "ฉลากสินค้า / Product label",
    certificate: "เอกสารทะเบียน / Registration document",
    permit: "ใบอนุญาตโฆษณา / Advertising permit",
    supporting: "เอกสารเพิ่มเติม / Supporting document",
  };
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  function render(target, result, { reviewer = false } = {}) {
    target.replaceChildren();
    if (!result) {
      target.append(
        node(
          "p",
          "ยังไม่ได้ขอตรวจสินค้า · เผยแพร่ได้โดยไม่มีเครื่องหมาย / Verification not requested.",
        ),
      );
      return;
    }
    target.append(
      node("h2", result.listing_title),
      node(
        "p",
        `${result.status} · ${stages[result.stage] || result.stage}`,
        "flow-status",
      ),
    );
    target.append(
      node(
        "p",
        `Submission ${result.revision} · ${result.mode === "replay" ? "REPLAY · Synthetic fixture assessment" : result.mode === "live" ? "LIVE · OpenAI document assessment" : "Not assessed"}`,
        "dialog-note",
      ),
    );
    const pipeline = node("ol", undefined, "submission-progress");
    const current =
      {
        WAITING_DOCUMENTS: 0,
        SELLER_ACTION: 0,
        AI_CHECKING: 1,
        UNAVAILABLE: 3,
        REVIEWER_REQUIRED: 3,
        COMPLETED: 4,
        SUPERSEDED: 4,
      }[result.stage] ?? 0;
    [
      "เอกสาร / Documents",
      "AI readiness",
      "Policy checks",
      "เจ้าหน้าที่ / Reviewer",
      "ผลตรวจ / Result",
    ].forEach((label, index) => {
      const step = node("li", `${index + 1}. ${label}`);
      if (index === current) step.setAttribute("aria-current", "step");
      step.dataset.state =
        index === current
          ? "current"
          : index < current
            ? "previous"
            : "waiting";
      pipeline.append(step);
    });
    target.append(pipeline);
    if (result.review_note)
      target.append(node("p", result.review_note, "workspace-notice"));
    if (result.listing) {
      const snapshot = node("details");
      snapshot.append(node("summary", "Listing snapshot / ข้อมูลสินค้าที่ส่งตรวจ"));
      for (const key of [
        "title",
        "description",
        "category",
        "product_name",
        "registration_reference",
        "license_holder",
        "advertising_permit",
      ])
        snapshot.append(node("p", `${key}: ${result.listing[key] || "—"}`));
      target.append(snapshot);
    }
    const missing = (
      result.required_documents || ["label", "certificate"]
    ).filter((kind) => !result.documents.some((doc) => doc.kind === kind));
    const action =
      result.stage === "WAITING_DOCUMENTS"
        ? missing.length
          ? "Upload: " + missing.map((k) => kinds[k]).join(", ")
          : "Documents ready. Choose Live or Replay and start checking."
        : result.stage === "REVIEWER_REQUIRED"
          ? "Next action: Reviewer — inspect document findings."
          : result.stage === "SELLER_ACTION"
            ? "Next action: Seller — correct the listing or start a new submission with clearer documents."
            : result.stage === "UNAVAILABLE"
              ? "Next action: Retry the check or ask a reviewer. No approval is assumed."
              : result.status === "DENIED"
                ? "Next action: Seller — correct the listed failures, then submit a new revision."
                : result.status === "APPROVED"
                  ? "The current listing passed the supported demo checks. This is not proof of physical authenticity."
                  : result.stage === "AI_CHECKING"
                    ? result.lease_until * 1000 < Date.now()
                      ? "Check timed out. Seller can retry, or a reviewer can inspect the documents."
                      : "Checking documents. Refresh to see the latest result."
                    : "See the current product revision.";
    target.append(node("p", action, "flow-action"));
    const list = node("ol", undefined, "flow-steps");
    for (const [rule, label] of [
      ["R-01", "Product identity / ตัวตนสินค้า"],
      ["R-02", "Category / หมวดหมู่"],
      ["R-03", "Advertising claims / คำโฆษณา"],
      ["R-04", "Advertising permit / ใบอนุญาตโฆษณา"],
      ["R-05", "Supporting evidence / หลักฐาน"],
    ]) {
      const outcome = result.rule_results.find((r) => r.rule === rule);
      const state = !outcome
        ? "waiting"
        : outcome.result === "skip"
          ? "not_checked"
          : outcome.result;
      const item = node("li", undefined, "flow-step");
      item.dataset.state = state;
      item.append(
        node("strong", `${rule} · ${label}`),
        node(
          "span",
          state === "pass"
            ? "ผ่าน / Passed"
            : state === "fail"
              ? "ติดขัด / Failed"
              : state === "waiting"
                ? "รอตรวจ / Waiting"
                : rule === "R-04" &&
                    result.rule_results.some(
                      (r) => r.rule === "R-01" && r.result === "pass",
                    ) &&
                    !result.required_documents?.includes("permit")
                  ? "ไม่จำเป็น / Not required"
                  : "ยังตรวจไม่ได้ / Not checked",
        ),
        node(
          "p",
          outcome
            ? `${outcome.reason_th} · ${outcome.reason_en}`
            : "Awaiting document and registry checks.",
        ),
      );
      if (outcome?.evidence) {
        for (const match of [
          ...(outcome.evidence.matches || []),
          ...(outcome.evidence.overclaims || []),
        ])
          item.append(
            node(
              "p",
              `“${match.phrase}”${match.reason_en ? " · " + match.reason_en : ""}`,
            ),
          );
        if (outcome.evidence.missing_required_term)
          item.append(
            node(
              "p",
              "Missing required supplement category wording: ผลิตภัณฑ์เสริมอาหาร",
            ),
          );
      }
      list.append(item);
    }
    target.append(list);
    const docs = node("div", undefined, "document-list");
    for (const doc of result.documents) {
      const a = node("a", `${kinds[doc.kind]} · ${doc.filename}`);
      a.href = "/v1/documents/" + doc.id;
      a.target = "_blank";
      a.rel = "noopener";
      docs.append(a);
    }
    target.append(node("h3", "เอกสาร / Private documents"), docs);
    if (result.assessment) {
      const section = node("section", undefined, "assessment-findings");
      section.append(
        node("h3", "AI document findings / สิ่งที่ AI พบ"),
        node(
          "p",
          `Extraction confidence: ${Math.round(result.assessment.confidence * 100)}% · not authenticity probability`,
        ),
      );
      for (const text of [
        ...result.assessment.missing,
        ...result.assessment.inconsistencies,
      ])
        section.append(node("p", text));
      for (const finding of result.assessment.documents) {
        const block = node("div", undefined, "document-finding");
        block.append(
          node(
            "strong",
            result.documents.find((d) => d.id === finding.document_id)
              ?.filename || finding.document_id,
          ),
        );
        for (const [key, value] of Object.entries(finding.fields))
          block.append(node("p", `${key}: ${value}`));
        if (finding.advertising_permit)
          block.append(
            node("p", "advertising_permit: " + finding.advertising_permit),
          );
        for (const uncertainty of finding.uncertainties)
          block.append(node("p", uncertainty, "flow-action"));
        if (reviewer)
          for (const quote of finding.quotes)
            block.append(
              node(
                "small",
                `Page ${quote.page} · ${quote.field}: “${quote.quote}”`,
              ),
            );
        section.append(block);
      }
      target.append(section);
    }
    if (reviewer) {
      const details = node("details");
      details.append(node("summary", "Audit trace / ประวัติการตรวจ"));
      const trace = node("pre", JSON.stringify(result.trace, null, 2));
      details.append(trace);
      target.append(
        details,
        node(
          "p",
          result.audit?.valid === false
            ? "Audit invalid — actions blocked"
            : "Hash-chained audit history retained.",
        ),
      );
    }
  }
  return { render, stages, kinds, node };
})();
