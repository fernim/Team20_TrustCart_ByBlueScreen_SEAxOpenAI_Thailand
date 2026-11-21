"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const ids = [
    "listing-title",
    "listing-description",
    "listing-category",
    "registration-reference",
    "registered-name",
    "license-holder",
  ];
  let version = 0;
  let dirty = false;
  let reports = [];
  let editingProduct = null;
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("trustcart-demo-reports") || "[]",
    );
    if (Array.isArray(saved)) reports = saved;
  } catch (_) {}
  const payload = () => ({
    title: $("#listing-title").value.trim(),
    description: $("#listing-description").value,
    category: $("#listing-category").value,
    registration_reference: $("#registration-reference").value.trim(),
    product_name: $("#registered-name").value.trim(),
    license_holder: $("#license-holder").value.trim(),
  });
  function fill(data) {
    const values = [
      data.title,
      data.description,
      data.category,
      data.registration_reference,
      data.product_name,
      data.license_holder,
    ];
    ids.forEach((id, i) => {
      if (typeof values[i] === "string") $("#" + id).value = values[i];
    });
  }
  function feedback(text) {
    $("#seller-feedback").textContent = text;
  }
  function renderReports() {
    $("#seller-product-list").replaceChildren();
    if (!reports.length) {
      $("#seller-product-list").textContent = "ยังไม่มีรายการที่ตรวจสอบ";
      return;
    }
    for (const entry of reports) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seller-product-row";
      button.textContent = `${entry.title || entry.id} · ${entry.status || "UNKNOWN"}`;
      button.addEventListener("click", async () => {
        if (
          dirty &&
          !window.confirm(
            "มีข้อมูลที่ยังไม่ได้ตรวจสอบ ต้องการเปลี่ยนรายการหรือไม่?",
          )
        )
          return;
        const request = ++version;
        $("#seller-result").replaceChildren();
        feedback("กำลังโหลดผลตรวจ…");
        try {
          const response = await fetch(
            entry.productId
              ? `/v1/products/${encodeURIComponent(entry.productId)}`
              : `/v1/verifications/${encodeURIComponent(entry.id)}`,
          );
          if (!response.ok) throw Error();
          const record = await response.json();
          if (request !== version) return;
          const result = entry.productId ? record.verification : record;
          editingProduct = entry.productId
            ? { id: record.id, version: record.version }
            : null;
          if (!entry.productId && result.id !== entry.id) throw Error();
          if (result.listing) fill(result.listing);
          else
            fill({
              title: result.listing_title || "",
              description: "",
              category: "other",
              registration_reference: "",
              product_name: "",
              license_holder: "",
            });
          dirty = false;
          window.TrustCartVerification.render($("#seller-result"), result, {
            audit: false,
          });
          feedback("แสดงผลตรวจที่บันทึกไว้");
        } catch (_) {
          if (request === version)
            feedback("ไม่สามารถโหลดผลตรวจได้ กรุณาลองใหม่");
        }
      });
      $("#seller-product-list").append(button);
    }
  }
  $("#seller-form").addEventListener("input", () => {
    dirty = true;
    version++;
    $("#seller-result").replaceChildren();
    feedback("ข้อมูลมีการแก้ไข ต้องส่งตรวจใหม่ก่อนยืนยันสถานะ");
  });
  $("#save-draft").addEventListener("click", () => {
    try {
      localStorage.setItem("trustcart-seller-draft", JSON.stringify(payload()));
      feedback("บันทึกแบบร่างในเครื่องแล้ว ยังไม่ได้ตรวจสอบ");
    } catch (_) {
      feedback("ไม่สามารถบันทึกแบบร่างในเครื่องได้");
    }
  });
  $("#seller-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!$("#seller-form").reportValidity()) return;
    const listing = payload();
    const request = ++version;
    $("#seller-result").replaceChildren();
    $("#submit-listing").disabled = true;
    document
      .querySelectorAll(
        "#seller-form input,#seller-form textarea,#seller-form select,#save-draft,#new-product",
      )
      .forEach((control) => {
        control.disabled = true;
      });
    feedback("กำลังตรวจสอบสินค้า…");
    try {
      const response = await fetch(
        editingProduct ? `/v1/products/${editingProduct.id}` : "/v1/products",
        {
          method: editingProduct ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingProduct
              ? { ...listing, expected_version: editingProduct.version }
              : listing,
          ),
        },
      );
      if (!response.ok) {
        if (response.status === 409) throw new Error("conflict");
        throw Error();
      }
      const record = await response.json();
      const result = record.verification;
      if (request !== version) return;
      if (!result || typeof result.id !== "string") throw Error();
      editingProduct = { id: record.id, version: record.version };
      dirty = false;
      window.TrustCartVerification.render($("#seller-result"), result, {
        audit: false,
      });
      reports = [
        {
          id: result.id,
          productId: record.id,
          version: record.version,
          title: listing.title,
          status: result.status,
        },
        ...reports.filter((entry) => entry.productId !== record.id),
      ].slice(0, 30);
      try {
        sessionStorage.setItem(
          "trustcart-demo-reports",
          JSON.stringify(reports),
        );
      } catch (_) {}
      try {
        localStorage.setItem("trustcart-products-updated", String(Date.now()));
      } catch (_) {}
      renderReports();
      feedback("บันทึกผลตรวจแล้ว ดูสถานะและขั้นตอนที่ต้องแก้ไขด้านล่าง");
    } catch (error) {
      if (request === version) {
        $("#seller-result").replaceChildren();
        feedback(
          error.message === "conflict"
            ? "สินค้านี้ถูกแก้ไขแล้ว โหลดรายการล่าสุดก่อนบันทึกอีกครั้ง"
            : "ไม่สามารถตรวจสอบได้ ไม่ได้ยืนยันสถานะผ่าน กรุณาลองใหม่",
        );
      }
    } finally {
      $("#submit-listing").disabled = false;
      document
        .querySelectorAll(
          "#seller-form input,#seller-form textarea,#seller-form select,#save-draft,#new-product",
        )
        .forEach((control) => {
          control.disabled = false;
        });
    }
  });
  try {
    const draft = JSON.parse(
      localStorage.getItem("trustcart-seller-draft") || "null",
    );
    if (draft && typeof draft === "object") {
      fill(draft);
      dirty = true;
      feedback("โหลดแบบร่างในเครื่องแล้ว ต้องส่งตรวจใหม่");
    }
  } catch (_) {}
  $("#new-product").addEventListener("click", () => {
    if (
      dirty &&
      !window.confirm("เริ่มรายการใหม่โดยไม่บันทึกข้อมูลปัจจุบันหรือไม่?")
    )
      return;
    editingProduct = null;
    dirty = false;
    version++;
    $("#seller-form").reset();
    $("#seller-result").replaceChildren();
    feedback("เพิ่มสินค้าใหม่");
  });
  async function loadProducts() {
    try {
      const response = await fetch("/v1/products", { cache: "no-store" });
      if (!response.ok) return;
      const records = await response.json();
      if (!Array.isArray(records)) return;
      reports = [
        ...records.map((record) => ({
          id: record.verification.id,
          productId: record.id,
          version: record.version,
          title: record.listing.title || record.listing.product_name,
          status: record.verification.status,
        })),
        ...reports.filter(
          (entry) =>
            !entry.productId &&
            !records.some((record) => record.verification.id === entry.id),
        ),
      ];
      renderReports();
    } catch (_) {}
  }
  renderReports();
  loadProducts();
})();
