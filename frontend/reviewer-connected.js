"use strict";
(async () => {
  const api = window.TrustCartSession,
    flow = window.TrustCartFlow,
    $ = (s) => document.querySelector(s);
  const user = await api.ready;
  if (user.role !== "reviewer") {
    location.href = "/login";
    return;
  }
  let selected = null,
    busy = false;
  const feedback = (text) => {
    const el = $("#reviewer-error");
    el.hidden = !text;
    el.textContent = text;
  };
  async function action(task) {
    if (busy) return;
    busy = true;
    try {
      feedback("");
      await task();
    } catch (e) {
      feedback(e.message);
    } finally {
      busy = false;
    }
  }
  async function open(id) {
    selected = await (await api.api("/v1/reviewer/submissions/" + id)).json();
    flow.render($("#reviewer-report"), selected, { reviewer: true });
    $("#decision-form").hidden = false;
    $("#review-note").value = "";
    for (const key of [
      "product_name",
      "registration_reference",
      "license_holder",
    ])
      $("#confirm-" + key).value =
        selected.assessment?.documents.find(
          (d) =>
            d.document_id ===
            selected.documents.find((m) => m.kind === "certificate")?.id,
        )?.fields[key] || "";
    const box = $("#confirm-documents");
    box.replaceChildren();
    for (const doc of selected.documents) {
      const label = flow.node("label");
      const check = flow.node("input");
      check.type = "checkbox";
      check.value = doc.id;
      label.append(
        check,
        flow.node(
          "span",
          "I inspected " + doc.filename + " (" + flow.kinds[doc.kind] + ")",
        ),
      );
      box.append(label);
    }
    $("#reviewer-report").scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }
  async function load() {
    const query = new URLSearchParams();
    for (const key of ["shop_id", "status", "stage"]) {
      const value = $("#filter-" + key).value;
      if (value) query.set(key, value);
    }
    if ($("#filter-action").checked) query.set("action_required", "true");
    const rows = await (
      await api.api("/v1/reviewer/submissions?" + query)
    ).json();
    $("#queue-summary").textContent =
      `${rows.length} submissions · ${rows.filter((r) => r.human_review_required).length} require reviewer action · ${rows.filter((r) => ["WAITING_DOCUMENTS", "SELLER_ACTION"].includes(r.stage)).length} waiting for seller`;
    const box = $("#reviewer-product-list");
    box.replaceChildren();
    for (const row of rows) {
      const card = flow.node("article", undefined, "seller-product-entry");
      const img = flow.node("img", undefined, "seller-item-image");
      img.src =
        row.listing.images?.[0] || "/static/assets/no-product-image.svg";
      img.alt = row.listing_title;
      const content = flow.node("div", undefined, "seller-item-summary");
      content.append(
        flow.node("h3", row.listing_title),
        flow.node("p", row.shop_name),
        flow.node(
          "p",
          `฿${Number(row.listing.price).toFixed(2)} · Stock ${row.listing.stock ?? "—"}`,
        ),
        flow.node("strong", `${row.status} · ${flow.stages[row.stage]}`),
        flow.node("p", row.review_note || row.reason.replaceAll("_", " ")),
      );
      const button = flow.node("button", "เปิดรายงาน / Open report");
      button.type = "button";
      button.onclick = () => action(() => open(row.id));
      const view = flow.node("a", "View product");
      view.href = "/products/" + row.product_id;
      view.target = "_blank";
      const actions = flow.node("div", undefined, "seller-item-actions");
      button.className = "seller-product-row";
      view.className = "seller-view-action";
      actions.append(button, view);
      card.append(img, content, actions);
      box.append(card);
    }
    if (!rows.length)
      box.append(flow.node("p", "No submissions match these filters."));
  }
  $("#queue-filters").onchange = () => action(load);
  $("#refresh-queue").onclick = () =>
    action(async () => {
      await load();
      if (selected) await open(selected.id);
    });
  $("#decision-form").onsubmit = (event) => {
    event.preventDefault();
    action(async () => {
      const decision = event.submitter.value;
      const payload = {
        chain_hash: selected.chain_hash,
        decision,
        note: $("#review-note").value,
      };
      if (decision === "approve") {
        payload.confirmed_fields = {};
        for (const key of [
          "product_name",
          "registration_reference",
          "license_holder",
        ])
          payload.confirmed_fields[key] = $("#confirm-" + key).value;
        payload.confirmed_documents = [
          ...$("#confirm-documents").querySelectorAll("input:checked"),
        ].map((el) => el.value);
      }
      selected = await api.json(
        "/v1/reviewer/submissions/" + selected.id + "/decision",
        payload,
      );
      await open(selected.id);
      await load();
      feedback(
        "Decision saved. The seller and customer views now use this result.",
      );
    });
  };
  await action(async () => {
    const shops = await (await api.api("/v1/reviewer/shops")).json();
    for (const shop of shops) {
      const o = flow.node("option", shop.name);
      o.value = shop.id;
      $("#filter-shop_id").append(o);
    }
    for (const [stage, label] of Object.entries(flow.stages)) {
      if (["NOT_REQUESTED", "SUPERSEDED"].includes(stage)) continue;
      const o = flow.node("option", label);
      o.value = stage;
      $("#filter-stage").append(o);
    }
    await load();
  });
  setInterval(() => {
    if (!busy && !document.hidden) action(load);
  }, 10000);
})();
