"use strict";
(async () => {
  const session = window.TrustCartSession,
    flow = window.TrustCartFlow,
    $ = (s) => document.querySelector(s);
  const user = await session.ready;
  if (user.role !== "seller") {
    location.href = "/login";
    return;
  }
  let selected = null,
    submission = null,
    images = [],
    busy = false,
    dirty = false,
    records = [],
    demoCases = {};
  const draftKey = "trustcart-draft-" + user.id;
  $("#shop-name").textContent =
    user.shop_id === "shop1" ? "TrustCart Demo Shop" : "BlueScreen Health Shop";
  const fields = {
    "listing-title": "title",
    "listing-description": "description",
    "listing-category": "category",
    "registration-reference": "registration_reference",
    "registered-name": "product_name",
    "license-holder": "license_holder",
    "listing-price": "price",
    "listing-stock": "stock",
    "advertising-permit": "advertising_permit",
  };
  const feedback = (text) => {
    $("#seller-feedback").textContent = text;
  };
  const payload = () => {
    const data = { images: [...images] };
    for (const [id, key] of Object.entries(fields))
      data[key] = $("#" + id).value;
    data.stock = data.stock === "" ? null : Number(data.stock);
    data.advertising_permit = data.advertising_permit || null;
    for (const key of [
      "registration_reference",
      "product_name",
      "license_holder",
    ])
      data[key] = data[key].trim() || "Not supplied";
    return data;
  };
  function renderImages() {
    const box = $("#image-previews");
    box.replaceChildren();
    images.forEach((src, index) => {
      const frame = flow.node("div");
      const img = flow.node("img");
      img.src = src;
      img.alt = "Product image " + (index + 1);
      const remove = flow.node("button", "ลบ / Remove");
      remove.type = "button";
      remove.onclick = () => {
        images.splice(index, 1);
        dirty = true;
        renderImages();
      };
      frame.append(img, remove);
      box.append(frame);
    });
  }
  function fill(data) {
    for (const [id, key] of Object.entries(fields))
      $("#" + id).value = data[key] ?? "";
    images = [...(data.images || [])];
    renderImages();
    dirty = false;
  }
  async function action(task) {
    if (busy) return;
    busy = true;
    const controls = [
      ...document.querySelectorAll(
        "#seller-form input,#seller-form textarea,#seller-form select,#seller-form button,#new-product,#load-demo,#refresh-seller-products",
      ),
    ].map((el) => [el, el.disabled]);
    controls.forEach(([el]) => (el.disabled = true));
    try {
      await task();
    } catch (error) {
      feedback(error.message);
    } finally {
      controls.forEach(([el, disabled]) => (el.disabled = disabled));
      busy = false;
    }
  }
  function showSelected() {
    const link = $("#view-product");
    link.hidden = !selected;
    if (selected) link.href = "/products/" + selected.id;
    $("#verification-controls").hidden = !selected;
    flow.render($("#seller-result"), submission);
    $("#request-verification").textContent =
      submission && submission.stage !== "WAITING_DOCUMENTS"
        ? "เตรียมเอกสารฉบับใหม่ / Prepare resubmission"
        : "เตรียมเอกสารขอตรวจ / Prepare documents";
    $("#document-form").hidden =
      !submission || submission.stage !== "WAITING_DOCUMENTS";
    const missingDocuments = (
      submission?.required_documents || ["label", "certificate"]
    ).some((kind) => !submission?.documents.some((doc) => doc.kind === kind));
    $("#run-check").disabled =
      !submission ||
      missingDocuments ||
      !(
        ["WAITING_DOCUMENTS", "UNAVAILABLE"].includes(submission.stage) ||
        (submission.stage === "AI_CHECKING" &&
          submission.lease_until * 1000 < Date.now())
      );
    $("#run-replay-check").disabled = $("#run-check").disabled;
    $("#document-links").replaceChildren();
    for (const kind of ["label", "certificate", "permit"]) {
      const a = flow.node("a", flow.kinds[kind]);
      a.href = "/v1/seller/demo-cases/" + $("#demo-case").value + "/" + kind;
      a.target = "_blank";
      $("#document-links").append(a);
    }
  }
  async function select(record) {
    selected = record;
    submission = record.verification;
    fill(record.listing);
    showSelected();
    $("#listing-title").focus();
  }
  async function loadProducts() {
    const data = await (await session.api("/v1/seller/products")).json();
    records = data;
    const list = $("#seller-product-list");
    list.replaceChildren();
    for (const record of data) {
      const row = flow.node("article", undefined, "seller-product-entry");
      row.dataset.product = record.id;
      const img = flow.node("img");
      img.className = "seller-item-image";
      img.src =
        record.listing.images?.[0] || "/static/assets/no-product-image.svg";
      img.alt = record.listing.title;
      const summary = flow.node("div", undefined, "seller-item-summary");
      summary.append(
        flow.node("h3", record.listing.title),
        flow.node(
          "p",
          `฿${Number(record.listing.price).toFixed(2)} · Stock ${record.listing.stock ?? "—"}`,
        ),
        flow.node(
          "p",
          `${record.verification?.status || "NOT_REQUESTED"} · ${flow.stages[record.workflow.stage]}`,
        ),
      );
      const controls = flow.node("div", undefined, "seller-item-actions");
      const edit = flow.node("button", "แก้ไข / Edit", "seller-product-row");
      edit.type = "button";
      edit.onclick = () =>
        action(async () => {
          if (dirty && !confirm("Discard unsaved edits?")) return;
          await select(
            await (
              await session.api("/v1/seller/products/" + record.id)
            ).json(),
          );
        });
      const view = flow.node("a", "ดูสินค้า / View product", "seller-view-action");
      view.href = "/products/" + record.id;
      view.target = "_blank";
      view.rel = "noopener";
      controls.append(edit, view);
      row.append(img, summary, controls);
      list.append(row);
    }
    if (!data.length)
      list.append(flow.node("p", "ยังไม่มีสินค้า / No products yet"));
  }
  async function refreshSelected() {
    if (!selected) return;
    const latest = await (
      await session.api("/v1/seller/products/" + selected.id)
    ).json();
    selected = latest;
    submission = latest.verification;
    showSelected();
    await loadProducts();
  }
  async function loadPlan() {
    const plan = await (await session.api("/v1/seller/subscription")).json();
    $("#plan-status").textContent = plan.active
      ? "Active until " + new Date(plan.active_until).toLocaleDateString()
      : "Inactive · Normal listings remain available";
    $("#activate-plan").disabled = plan.active;
    $("#verification-plan").hidden = plan.active;
    if (plan.active) $("#verification-plan").open = false;
  }
  async function requestVerification() {
    if (!selected) throw Error("Save the product first");
    if (dirty)
      throw Error("Save your product edits before requesting verification");
    submission = await session.json(
      "/v1/seller/products/" + selected.id + "/submissions",
      {
        expected_version: selected.version,
        chain_hash: submission?.chain_hash,
      },
    );
    showSelected();
    await loadProducts();
    feedback(
      "Upload required documents, then Submit for review. Live OpenAI document and claim checks run automatically before Agency review.",
    );
  }
  async function upload(kind, file) {
    const body = new FormData();
    body.append("kind", kind);
    body.append("chain_hash", submission.chain_hash);
    body.append("file", file);
    submission = await (
      await session.api(
        "/v1/seller/submissions/" + submission.id + "/documents",
        { method: "POST", body },
      )
    ).json();
    showSelected();
  }
  $("#seller-form").addEventListener("input", () => {
    dirty = true;
  });
  $("#seller-form").onsubmit = (event) => {
    event.preventDefault();
    action(async () => {
      const data = payload();
      selected = await session.json(
        "/v1/seller/products" + (selected ? "/" + selected.id : ""),
        selected ? { ...data, expected_version: selected.version } : data,
        selected ? "PUT" : "POST",
      );
      submission = null;
      dirty = false;
      showSelected();
      let message =
        "เผยแพร่สินค้าแล้ว / Product published. Customers can view it now without a verification badge.";
      feedback(message);
      try {
        await loadProducts();
      } catch (error) {
        message += " The product list could not refresh: " + error.message;
      }
      if ($("#verify-on-save").checked) {
        try {
          await requestVerification();
          message +=
            " Verification is waiting for documents; publication is already complete.";
        } catch (error) {
          message += " Verification could not start: " + error.message;
        }
      }
      feedback(message);
      try {
        localStorage.setItem("trustcart-products-updated", Date.now());
      } catch (_) {
        // Browser storage restrictions must not hide successful publication.
      }
    });
  };
  $("#listing-images").onchange = (event) =>
    action(async () => {
      const files = [...event.target.files];
      if (
        images.length + files.length > 5 ||
        files.some(
          (f) =>
            !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
            f.size > 2 * 1024 * 1024,
        )
      )
        throw Error("Use up to five PNG/JPEG/WebP images, 2 MiB each");
      for (const file of files)
        images.push(
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
        );
      event.target.value = "";
      dirty = true;
      renderImages();
    });
  $("#new-product").onclick = () => {
    if (dirty && !confirm("Discard unsaved edits?")) return;
    selected = null;
    submission = null;
    $("#seller-form").reset();
    images = [];
    dirty = false;
    renderImages();
    showSelected();
  };
  $("#save-draft").onclick = () => {
    localStorage.setItem(draftKey, JSON.stringify(payload()));
    feedback("Draft saved for this account on this browser.");
  };
  $("#activate-plan").onclick = () =>
    action(async () => {
      await session.json("/v1/seller/subscription/activate", {});
      await loadPlan();
      feedback("Demo plan activated. No payment collected.");
    });
  $("#request-verification").onclick = () => action(requestVerification);
  $("#refresh-verification").onclick = () => action(refreshSelected);
  $("#document-form").onsubmit = (event) => {
    event.preventDefault();
    action(async () => {
      const file = $("#document-file").files[0];
      if (!file) throw Error("Choose a document");
      await upload($("#document-kind").value, file);
      $("#document-file").value = "";
      feedback("Private document saved.");
    });
  };
  async function submitForReview(mode = "live") {
    if (dirty) throw Error("Save edited listing before checking");
    if (!submission) throw Error("Prepare and upload documents first");
    $("#run-check").disabled = true;
    $("#run-replay-check").disabled = true;
    feedback(
      "Checking documents and claims before Agency review… no approval is assumed.",
    );
    flow.render($("#seller-result"), {
      ...submission,
      status: "PENDING",
      stage: "AI_CHECKING",
      document_check: { state: "checking" },
      claim_check: { state: "checking" },
    });
    try {
      submission = await session.json(
        "/v1/seller/submissions/" +
          submission.id +
          (mode === "live" ? "/submit-review" : "/run"),
        mode === "live"
          ? { chain_hash: submission.chain_hash }
          : { chain_hash: submission.chain_hash, mode: "replay" },
      );
      showSelected();
      await loadProducts();
      try {
        localStorage.setItem("trustcart-products-updated", Date.now());
      } catch (_) {}
      feedback(
        submission.manual_review_checks?.length
          ? `Check complete: ${submission.status}. AI checks skipped; sent to Agency for manual review. No approval is assumed.`
          : submission.stage === "UNAVAILABLE"
          ? "Check complete: UNKNOWN. Verification unavailable; sent to Agency. Unresolved registry or evidence checks still block approval."
          : submission.status === "APPROVED"
            ? "Check complete: APPROVED. Required checks passed with sufficient confidence; no further approval is needed."
            : submission.status === "DENIED"
              ? "Check complete: DENIED. Correct the recorded failures and submit a new revision."
              : "Check complete: PENDING. More information or reviewer confirmation is needed; checklist sent to Agency.",
      );
    } finally {
      showSelected();
    }
  }
  $("#run-check").onclick = () => action(() => submitForReview());
  $("#run-replay-check").onclick = () =>
    action(() => submitForReview("replay"));
  $("#load-demo").onclick = () => {
    if (dirty && !confirm("Discard unsaved edits?")) return;
    selected = null;
    submission = null;
    fill(demoCases[$("#demo-case").value].listing);
    dirty = true;
    showSelected();
    feedback(
      "Synthetic example loaded. Save it, request verification, then upload its sample documents.",
    );
  };
  $("#demo-documents").onclick = () =>
    action(async () => {
      if (!submission || submission.stage !== "WAITING_DOCUMENTS")
        throw Error("Request verification first");
      for (const kind of ["label", "certificate", "permit"]) {
        const blob = await (
          await session.api(
            "/v1/seller/demo-cases/" + $("#demo-case").value + "/" + kind,
          )
        ).blob();
        await upload(
          kind,
          new File([blob], kind + ".pdf", { type: "application/pdf" }),
        );
      }
      feedback(
        "Synthetic sample documents uploaded. Submit for review runs live OpenAI checks; Replay demonstration is a separate action.",
      );
    });
  $("#show-history").onclick = () =>
    action(async () => {
      const history = await (
        await session.api("/v1/seller/products/" + selected.id + "/history")
      ).json();
      $("#submission-history").replaceChildren();
      for (const entry of history) {
        const details = flow.node("details");
        details.append(
          flow.node(
            "summary",
            `Revision ${entry.revision} · ${entry.status} · ${entry.stage}`,
          ),
        );
        const content = flow.node("div");
        flow.render(content, entry);
        details.append(content);
        $("#submission-history").append(details);
      }
    });
  $("#demo-case").onchange = showSelected;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (draft) fill(draft);
  } catch (_) {}
  await action(async () => {
    demoCases = await (await session.api("/v1/seller/demo-cases")).json();
    for (const [id, data] of Object.entries(demoCases)) {
      const option = flow.node("option", data.name);
      option.value = id;
      $("#demo-case").append(option);
    }
    await loadPlan();
    await loadProducts();
    showSelected();
  });
  async function refreshProducts() {
    await loadProducts();
    if (selected && !dirty) {
      const latest = records.find((r) => r.id === selected.id);
      if (
        latest &&
        (latest.version !== selected.version ||
          latest.verification?.chain_hash !== submission?.chain_hash ||
          submission?.stage === "AI_CHECKING")
      ) {
        if (latest.version !== selected.version) fill(latest.listing);
        selected = latest;
        submission = latest.verification;
        showSelected();
      }
    }
  }
  // Product reads are initiated by loading, mutations, or this explicit refresh.
  // Idle polling used to disable the form and replace focused list controls.
  $("#refresh-seller-products").onclick = () => action(refreshProducts);
})();
