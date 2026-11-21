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
  let images = [];
  let imageRequest = 0;
  let readingImages = false;
  let saving = false;
  function markDirty() {
    dirty = true;
    version++;
    $("#seller-result").replaceChildren();
    feedback("ข้อมูลมีการแก้ไข ต้องส่งตรวจใหม่ก่อนยืนยันสถานะ");
  }
  function renderImages() {
    $("#image-previews").replaceChildren();
    images.forEach((src, index) => {
      const frame = document.createElement("div");
      const image = document.createElement("img");
      image.src = src;
      image.alt = `รูปสินค้า ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = `ลบรูป ${index + 1}`;
      remove.disabled = saving || readingImages;
      remove.addEventListener("click", () => {
        if (saving || readingImages) return;
        images.splice(index, 1);
        renderImages();
        markDirty();
      });
      frame.append(image, remove);
      $("#image-previews").append(frame);
    });
  }
  $("#listing-images").addEventListener("change", async (event) => {
    const request = ++imageRequest;
    const files = [...event.target.files];
    readingImages = false;
    $("#submit-listing").disabled = saving;
    renderImages();
    markDirty();
    if (files.length + images.length > 5 || files.some(file =>
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024)) {
      feedback("เลือกรูป PNG, JPEG หรือ WebP ไม่เกิน 5 รูป และ 2 MB ต่อรูป");
      event.target.value = "";
      return;
    }
    readingImages = true;
    $("#submit-listing").disabled = true;
    renderImages();
    try {
      const added = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      if (request === imageRequest) images.push(...added);
    } catch (_) {
      if (request === imageRequest) feedback("ไม่สามารถอ่านรูปได้ กรุณาเลือกรูปอีกครั้ง");
    } finally {
      if (request === imageRequest) {
        readingImages = false;
        $("#submit-listing").disabled = saving;
        event.target.value = "";
        renderImages();
      }
    }
  });
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
    images: [...images],
    price: $("#listing-price").value,
    stock: Number($("#listing-stock").value),
    title: $("#listing-title").value.trim(),
    description: $("#listing-description").value,
    category: $("#listing-category").value,
    registration_reference: $("#registration-reference").value.trim(),
    product_name: $("#registered-name").value.trim(),
    license_holder: $("#license-holder").value.trim(),
  });
  function fill(data) {
    imageRequest++;
    readingImages = false;
    $("#submit-listing").disabled = saving;
    images = Array.isArray(data.images) ? [...data.images] : [];
    $("#listing-images").value = "";
    $("#listing-price").value = data.price ?? "";
    $("#listing-stock").value = data.stock ?? "";
    renderImages();
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
  function updateProductLink() {
    const link = $("#view-product");
    link.hidden = !editingProduct;
    if (editingProduct) link.href = `/products/${encodeURIComponent(editingProduct.id)}`;
    else link.removeAttribute("href");
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
        if (saving) return;
        if (
          dirty &&
          !window.confirm(
            "มีข้อมูลที่ยังไม่ได้ตรวจสอบ ต้องการเปลี่ยนรายการหรือไม่?",
          )
        )
          return;
        const request = ++version;
        $("#view-product").hidden = true;
        $("#view-product").removeAttribute("href");
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
          updateProductLink();
          window.TrustCartVerification.render($("#seller-result"), result, {
            audit: false,
          });
          feedback("แสดงผลตรวจที่บันทึกไว้");
        } catch (_) {
          if (request === version)
            feedback("ไม่สามารถโหลดผลตรวจได้ กรุณาลองใหม่");
        }
      });
      const row = document.createElement("div");
      row.className = "seller-product-entry";
      row.append(button);
      if (entry.productId) {
        const view = document.createElement("a");
        view.className = "seller-view-product seller-view-action";
        view.textContent = "ดูสินค้า / View product ↗";
        view.href = `/products/${encodeURIComponent(entry.productId)}`;
        view.target = "_blank";
        view.rel = "noopener noreferrer";
        view.setAttribute("aria-label", `ดูสินค้า / View product: ${entry.title || entry.productId}`);
        view.title = "เปิดหน้าลูกค้าด้วยข้อมูลที่บันทึกล่าสุด";
        row.append(view);
      }
      $("#seller-product-list").append(row);
    }
  }
  $("#seller-form").addEventListener("input", markDirty);
  $("#save-draft").addEventListener("click", () => {
    if (readingImages) { feedback("กำลังอ่านรูป กรุณารอสักครู่"); return; }
    try {
      localStorage.setItem("trustcart-seller-draft", JSON.stringify(payload()));
      feedback("บันทึกแบบร่างในเครื่องแล้ว ยังไม่ได้ตรวจสอบ");
    } catch (_) {
      feedback("ไม่สามารถบันทึกแบบร่างในเครื่องได้");
    }
  });
  $("#seller-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || readingImages || !$("#seller-form").reportValidity()) return;
    saving = true;
    renderImages();
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
        if (response.status === 422) throw new Error("invalid");
        throw Error();
      }
      const record = await response.json();
      const result = record.verification;
      if (request !== version) return;
      if (!result || typeof result.id !== "string") throw Error();
      editingProduct = { id: record.id, version: record.version };
      updateProductLink();
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
            : error.message === "invalid"
              ? "ข้อมูลไม่ถูกต้อง ตรวจสอบรูปสินค้า ราคา และจำนวนคงเหลือ แล้วลองใหม่"
              : "ไม่สามารถตรวจสอบได้ ไม่ได้ยืนยันสถานะผ่าน กรุณาลองใหม่",
        );
      }
    } finally {
      saving = false;
      renderImages();
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
    updateProductLink();
    dirty = false;
    version++;
    $("#seller-form").reset();
    imageRequest++;
    readingImages = false;
    images = [];
    $("#submit-listing").disabled = false;
    renderImages();
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
