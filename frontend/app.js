"use strict";

// Catalog claims are synthetic. Only the backend can supply a verification result.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const categories = [
    ["ความงามและของใช้ส่วนตัว", "Beauty & personal care"],
    ["กลุ่มผลิตภัณฑ์เพื่อสุขภาพ", "Health products"],
    ["เสื้อผ้าแฟชั่นผู้ชาย", "Men’s clothing"],
    ["เสื้อผ้าแฟชั่นผู้หญิง", "Women’s clothing"],
    ["กระเป๋า", "Bags"],
    ["รองเท้าผู้ชาย", "Men’s shoes"],
    ["รองเท้าผู้หญิง", "Women’s shoes"],
    ["เครื่องประดับ", "Jewellery"],
    ["นาฬิกาและแว่นตา", "Watches & glasses"],
    ["เครื่องใช้ในบ้าน", "Home & living"],
    ["อุปกรณ์อิเล็กทรอนิกส์", "Electronics"],
    ["มือถือ และ แท็บเล็ต", "Phones & tablets"],
    ["เครื่องใช้ไฟฟ้าภายในบ้าน", "Home appliances"],
    ["คอมพิวเตอร์และแล็ปท็อป", "Computers & laptops"],
    ["กล้องและอุปกรณ์ถ่ายภาพ", "Cameras"],
    ["อาหารและเครื่องดื่ม", "Food & beverages"],
    ["ของเล่น สินค้าแม่และเด็ก", "Baby & toys"],
    ["กีฬาและกิจกรรมกลางแจ้ง", "Sports & outdoors"],
    ["สัตว์เลี้ยง", "Pets"],
    ["เกมและอุปกรณ์เสริม", "Gaming"],
    ["ยานยนต์", "Automotive"],
    ["เครื่องเขียน หนังสือ และงานอดิเรก", "Books & stationery"],
    ["ตั๋วและบัตรกำนัล", "Tickets & vouchers"],
    ["ช้อปปี้เพย์ใกล้ตัว", "Nearby deals"],
  ];
  const catalog = [
    [
      "หูฟังไร้สาย แบบครอบหู สีดำ",
      "Wireless over-ear headphones, black",
      10,
      429,
      890,
      2100,
    ],
    [
      "เสื้อเชิ้ตแขนยาว ทรงสบาย สีฟ้า",
      "Relaxed long-sleeve shirt, blue",
      2,
      199,
      390,
      832,
    ],
    [
      "กระเป๋าสะพายข้าง ทรงคลาสสิก",
      "Classic everyday shoulder bag",
      4,
      359,
      690,
      1230,
    ],
    [
      "รองเท้าผ้าใบ ลำลอง ใส่ได้ทุกวัน",
      "Everyday casual canvas sneakers",
      5,
      259,
      499,
      3600,
    ],
    [
      "นาฬิกาข้อมือ หน้าปัดสีน้ำเงิน",
      "Classic watch with blue dial",
      8,
      518,
      1399,
      632,
    ],
    [
      "ชุดเครื่องสำอาง พร้อมกระจกพกพา",
      "Makeup palette with compact mirror",
      0,
      189,
      320,
      4500,
    ],
    [
      "แล็ปท็อป สำหรับทำงานและเรียน",
      "Laptop for work and study",
      13,
      12990,
      16990,
      213,
    ],
    [
      "แก้วน้ำพร้อมฝาปิด สำหรับเด็ก",
      "Baby cup with lid and handles",
      16,
      129,
      259,
      1520,
    ],
    [
      "ชุดเดรสแขนกุด สีส้ม",
      "Orange sleeveless everyday dress",
      3,
      229,
      459,
      762,
    ],
    ["ชามอาหารสัตว์เลี้ยง สีเหลือง", "Yellow pet food bowl", 18, 79, 159, 6100],
    [
      "ชุดเครื่องนอน โทนสีธรรมชาติ",
      "Natural-tone bedding set",
      9,
      599,
      1290,
      932,
    ],
    ["มือถือ สมาร์ทโฟน สีม่วง", "Purple smartphone", 11, 8990, 11990, 427],
    ["รองเท้าส้นสูง โทนสีนู้ด", "Nude-tone classic heels", 6, 299, 590, 680],
    [
      "สร้อยคอพร้อมจี้ สีเงิน",
      "Silver-tone pendant necklace",
      7,
      149,
      299,
      2840,
    ],
    ["หน้ากากอนามัย แบบแพ็ก", "Disposable face mask pack", 1, 49, 99, 7200],
    [
      "โทรทัศน์ จอแบน สำหรับบ้าน",
      "Flat-screen home television",
      12,
      6490,
      9990,
      352,
    ],
    [
      "กล้องถ่ายภาพ สไตล์คลาสสิก",
      "Classic-style digital camera",
      14,
      3290,
      4990,
      174,
    ],
    ["ขนมขบเคี้ยว แบบแพ็ก", "Everyday snack pack", 15, 89, 159, 981],
    [
      "จักรยาน สำหรับกิจกรรมกลางแจ้ง",
      "Outdoor city bicycle",
      17,
      2590,
      3990,
      136,
    ],
    [
      "จอยเกมไร้สาย สำหรับคอนโซล",
      "Wireless console controller",
      19,
      790,
      1290,
      456,
    ],
    ["อุปกรณ์ตกแต่งรถยนต์ ชุด", "Automotive accessory set", 20, 159, 299, 345],
    [
      "ชุดเครื่องเขียน สำหรับโต๊ะทำงาน",
      "Desk stationery set",
      21,
      99,
      199,
      2490,
    ],
    ["บัตรกำนัล ", "Gift voucher", 22, 100, 120, 80],
    ["ดีลร้านค้าใกล้บ้าน ", "Neighbourhood store deal", 23, 69, 99, 91],
  ].map(([th, en, category, price, original, sold], id) => ({
    id,
    th,
    en,
    category,
    price,
    original,
    sold,
  }));
  const state = {
    language: "th",
    query: "",
    category: null,
    limit: 12,
    sort: "recommended",
  };
  // This listing uses the existing synthetic fixture; no registry record is invented here.
  const checkedProduct = catalog[14];
  checkedProduct.th = "ลูมาเวล วิตามินซี";
  checkedProduct.en = "LumaVale Vitamin C";
  const overclaimExamples = [
    {
      th: "ออราเฟิร์น คอลลาเจน — ผิวดูอ่อนวัยใน 3 วัน",
      en: "AuraFern Collagen — younger-looking skin in 3 days",
      descriptionTh: "AuraFern คอลลาเจน ผิวดูอ่อนวัยใน 3 วัน เห็นผลแน่นอนทุกคน",
      descriptionEn:
        "AuraFern Collagen. Younger-looking skin in 3 days, guaranteed for everyone.",
      price: 329,
    },
    {
      th: "โนวาลีฟ วิตามินซี — ผิวกระจ่างใสทันที 100%",
      en: "NovaLeaf Vitamin C — instantly brighter skin, 100% guaranteed",
      descriptionTh:
        "NovaLeaf วิตามินซี ผิวกระจ่างใสทันที 100% ตั้งแต่ครั้งแรก",
      descriptionEn:
        "NovaLeaf Vitamin C. Instantly brighter skin, 100% guaranteed from the first use.",
      price: 189,
    },
    {
      th: "ซันพีค น้ำมันปลา — ความจำดีขึ้นทันทีทุกคน",
      en: "SunPeak Fish Oil — instantly better memory for everyone",
      descriptionTh:
        "SunPeak น้ำมันปลา ความจำดีขึ้นทันที เห็นผลทุกคนโดยไม่มีข้อยกเว้น",
      descriptionEn:
        "SunPeak Fish Oil. Instantly better memory for everyone, without exception.",
      price: 259,
    },
  ];
  overclaimExamples.forEach((example) =>
    catalog.push({
      ...example,
      id: catalog.length,
      category: 1,
      original: example.price + 100,
      sold: 0,
      overclaim: true,
    }),
  );
  // Short excerpts from public Shopee titles; descriptions summarize visible pack data.
  Object.assign(catalog[21], {
    th: "Neocell Super Collagen + C",
    en: "Neocell Super Collagen + C",
    category: 1,
    sourceUrl:
      "https://shopee.co.th/Neocell-Super-Collagen--C--คอลลาเจน-วิตามินซี--(ขนาด-90-250-270-360-เม็ด)-i.38793442.783511072",
    sourceDescription: "คอลลาเจน วิตามินซี ขนาด 90/250/270/360 เม็ด",
  });
  Object.assign(catalog[22], {
    th: "Deva C Vitamin C 1000 มก.",
    en: "Deva C Vitamin C 1000 mg",
    category: 1,
    sourceUrl:
      "https://shopee.co.th/วิตามินซี-ดีว่าพลัสคอลลาเจน-(1ห่อ-30ซอง)-Deva-C-Vitamin-C-1000-มก.(ของแท้)-i.224681664.40201061048",
    sourceDescription: "วิตามินซี ดีว่าพลัสคอลลาเจน 1 ห่อ 30 ซอง",
  });
  let productVerification = null;
  const productVerifications = new Map();
  function hasProductVerification(product) {
    const productVerification = productVerifications.get(product.id);
    return (
      !product.overclaim &&
      productVerification?.status === "APPROVED" &&
      Number.isFinite(productVerification.confidence) &&
      productVerification.confidence >= 0.75 &&
      productVerification.human_review_required === false &&
      productVerification.registry_source === "synthetic" &&
      typeof productVerification.chain_hash === "string" &&
      productVerification.chain_hash.length > 0
    );
  }
  function verificationLabel() {
    return state.language === "th" ? "ตรวจทะเบียนแล้ว" : "Registration checked";
  }
  function productCheckmark(product) {
    const verified = hasProductVerification(product);
    const denied = productVerifications.get(product.id)?.status === "DENIED";
    const label = verified
      ? verificationLabel()
      : denied
        ? state.language === "th"
          ? "ไม่ผ่านการตรวจสอบ"
          : "Did not pass verification"
        : state.language === "th"
          ? "ยังตรวจสอบไม่ได้"
          : "Could not verify";
    const badge = element(
      "button",
      `product-status ${verified ? "product-verified" : denied ? "product-denied" : "product-unconfirmed"}`,
    );
    badge.type = "button";
    badge.setAttribute("aria-label", label);
    badge.setAttribute("aria-haspopup", "dialog");
    badge.title = label;
    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#product-status-title").textContent = label;
      const result = productVerifications.get(product.id);
      if (result?.id)
        $("#reviewer-link").href =
          `/reviewer?id=${encodeURIComponent(result.id)}`;
      openDialog($("#product-status-dialog"));
    });
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const seal = document.createElementNS(icon.namespaceURI, "path");
    seal.setAttribute(
      "d",
      verified
        ? "m12 1 3 2 3.6.4.9 3.5L22 10l-1 3.4.2 3.6-3.3 1.5-2.3 2.8-3.6-.5-3.4 1.1-2.6-2.6-3.5-1L2 14.6 1 11l2.4-2.8.8-3.5L7.8 4Z"
        : "M12 2 21 6v7c0 5-9 9-9 9S3 18 3 13V6Z",
    );
    const check = document.createElementNS(icon.namespaceURI, "path");
    check.setAttribute("d", verified ? "m7 12 3 3 7-7" : "M12 7v6m0 4v.1");
    check.setAttribute("class", "verified-tick");
    icon.append(seal, check);
    badge.append(icon);
    return badge;
  }
  const text = {
    th: {
      results: "รายการ",
      allProducts: "สินค้าทั้งหมด",
      search: "ค้นหา",
      clear: "ล้างตัวกรอง",
      noResults: "ไม่พบสินค้า",
      sold: "ขายแล้ว",
      shipping: "ส่งฟรี",
      preferred: "ร้านแนะนำ",
      location: "กรุงเทพมหานคร",
      placeholder: "ลูกค้าใหม่ รับเลย โค้ดส่วนลด หรือโค้ดส่งฟรี*",
      searchLabel: "ค้นหาสินค้าและร้านค้า",
      all: "ดูทั้งหมด",
      close: "ปิด",
      cart: "ตะกร้าสินค้า",
      homeTitle: "ช้อปสินค้าออนไลน์ — TrustCart",
    },
    en: {
      results: "items",
      allProducts: "All products",
      search: "Search",
      clear: "Clear filters",
      noResults: "No products found",
      sold: "sold",
      shipping: "Free shipping",
      preferred: "Preferred",
      location: "Bangkok",
      placeholder: "New here? Discover welcome vouchers and free shipping*",
      searchLabel: "Search products and shops",
      all: "See all",
      close: "Close",
      cart: "Shopping cart",
      homeTitle: "Online shopping — TrustCart marketplace demo",
    },
  };
  const t = (key) => text[state.language][key] || key;
  const name = (product) => product[state.language];
  const categoryName = (index) =>
    categories[index][state.language === "th" ? 0 : 1];
  const price = (value) =>
    value === null
      ? state.language === "th"
        ? "ยังไม่ระบุราคา"
        : "Price not provided"
      : "฿" + value.toLocaleString("en-US");
  const findProduct = (id) =>
    catalog.find((product) => String(product.id) === String(id));
  const image = (category) => `/static/assets/category-${category}.webp`;
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function productImage(product) {
    const img = element("img");
    img.src = product.images?.[0] || (
      product.id === checkedProduct.id ||
      product.overclaim ||
      product.sellerProduct
        ? "/static/assets/demo-supplement.svg"
        : image(product.category));
    img.alt = name(product);
    img.loading = "lazy";
    img.width = 200;
    img.height = 200;
    return img;
  }
  function productCard(product) {
    const card = element(
      "article",
      product.overclaim
        ? "product-card overclaim-example"
        : product.sellerProduct
          ? "product-card seller-catalog-product"
          : "product-card",
    );
    card.dataset.product = product.id;
    const open = element("a", "product-open");
    open.href = `/products/${encodeURIComponent(product.id)}`;
    open.setAttribute("aria-label", name(product));
    const picture = element("div", "product-picture");
    picture.append(
      productImage(product),
      element("span", "preferred", t("preferred")),
      element(
        "span",
        "discount",
        `−${Math.round((1 - product.price / product.original) * 100)}%`,
      ),
    );
    const copy = element("div", "product-copy");
    const productName = element("h3", "product-name");
    const titleLink = element("a", "product-title-link", name(product));
    titleLink.href = open.href;
    productName.append(titleLink);
    if (hasProductVerification(product)) {
      productName.prepend(
        productCheckmark(product),
        document.createTextNode(" "),
      );
    }
    copy.append(productName, element("span", "shipping-tag", t("shipping")));
    const bottom = element("div", "product-bottom");
    bottom.append(
      element("span", "price", price(product.price)),
      element(
        "small",
        "",
        `${t("sold")} ${product.sold.toLocaleString("en-US")}`,
      ),
    );
    copy.append(bottom, element("span", "product-location", t("location")));
    if (product.sellerProduct) {
      picture
        .querySelectorAll(".preferred,.discount")
        .forEach((node) => node.remove());
      copy
        .querySelectorAll(
          ".shipping-tag,.product-location,.product-bottom small",
        )
        .forEach((node) => node.remove());
    }
    open.append(picture);
    card.append(open, copy);
    return card;
  }
  function matches() {
    const query = state.query.toLocaleLowerCase().trim();
    const products = catalog.filter(
      (product) =>
        (state.category === null || product.category === state.category) &&
        (!query ||
          `${product.th} ${product.en} ${categories[product.category].join(" ")}`
            .toLocaleLowerCase()
            .includes(query)),
    );
    if (state.sort === "recommended") {
      for (let offset = 0; offset < overclaimExamples.length; offset++) {
        const sample = catalog[24 + offset];
        const index = products.indexOf(sample);
        if (index > offset + 2)
          products.splice(offset + 2, 0, products.splice(index, 1)[0]);
      }
      const demoIndex = products.indexOf(checkedProduct);
      if (demoIndex > 1)
        products.splice(1, 0, products.splice(demoIndex, 1)[0]);
    }
    if (state.sort === "price-low") products.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") products.sort((a, b) => b.price - a.price);
    if (state.sort === "recommended")
      products.sort(
        (a, b) => Number(!!b.sellerProduct) - Number(!!a.sellerProduct),
      );
    return products;
  }
  function renderProducts() {
    const products = matches();
    $("#products").replaceChildren(
      ...products.slice(0, state.limit).map(productCard),
    );
    const label = state.query
      ? `“${state.query}”`
      : state.category === null
        ? t("allProducts")
        : categoryName(state.category);
    $("#results-summary").textContent =
      `${label} · ${products.length} ${t("results")}`;
    $("#empty-state").hidden = products.length > 0;
    $("#load-more").hidden = state.limit >= products.length;
    $("#clear-filters").hidden = !state.query && state.category === null;
  }
  function browse() {
    if (routeProductId() !== null) navigateProductPage("/");
    renderProducts();
    $("#catalog-title").scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function reset() {
    state.query = "";
    state.category = null;
    state.limit = 12;
    $("#search").value = "";
    $$("[data-category]").forEach((button) =>
      button.setAttribute("aria-pressed", "false"),
    );
    browse();
  }
  $("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = $("#search").value.trim();
    state.limit = 12;
    browse();
  });
  $("#clear-filters").addEventListener("click", reset);
  $("#reset-search").addEventListener("click", reset);
  $("#all-categories").addEventListener("click", reset);
  $("#sort").addEventListener("change", () => {
    state.sort = $("#sort").value;
    renderProducts();
  });
  $("#load-more").addEventListener("click", () => {
    state.limit += 12;
    renderProducts();
  });
  function renderCategories() {
    $("#categories").replaceChildren(
      ...categories.map((category, index) => {
        const button = element("button", "category");
        button.type = "button";
        button.dataset.category = index;
        button.setAttribute("aria-pressed", String(state.category === index));
        const img = element("img");
        img.src = image(index);
        img.alt = "";
        img.width = 83;
        img.height = 83;
        button.append(img, element("span", "", categoryName(index)));
        button.addEventListener("click", () => {
          state.category = index;
          state.limit = 12;
          $$("[data-category]").forEach((node) =>
            node.setAttribute("aria-pressed", String(node === button)),
          );
          browse();
        });
        return button;
      }),
    );
  }
  Object.assign(text.th, {
    welcome: "สิทธิพิเศษลูกค้าใหม่",
    trendy: "ช้อปปี้เทรนด์ดี้",
    home: "ดีลเครื่องใช้ไฟฟ้า",
    claimed: "เก็บโค้ดแล้ว",
    claim: "เก็บโค้ด",
    couponSaved: "เก็บโค้ดแล้ว",
    previous: "โปรโมชั่นก่อนหน้า",
    next: "โปรโมชั่นถัดไป",
    promo: "โปรโมชั่น",
    soldFast: "ขายดี",
    sampleTime: "เวลานับถอยหลัง",
  });
  Object.assign(text.en, {
    welcome: "New customer offers",
    trendy: "Shopee Trendy",
    home: "Home appliance deals",
    claimed: "Saved · demo voucher",
    claim: "Save demo voucher",
    couponSaved: "Demo voucher saved",
    previous: "Previous promotion",
    next: "Next promotion",
    promo: "Promotion",
    soldFast: "Selling fast",
    sampleTime: "Demo countdown",
  });
  let toastTimer;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      $("#toast").hidden = true;
    }, 3000);
  }
  const returnFocus = new WeakMap();
  function openDialog(dialog) {
    returnFocus.set(dialog, document.activeElement);
    dialog.showModal();
  }
  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => returnFocus.get(dialog)?.focus());
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) dialog.close();
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }
    });
  });
  const slides = ["hero", "trendy", "home"];
  let slide = 0;
  function renderSlide() {
    $("#hero-image").src = `/static/assets/${slides[slide]}.webp`;
    $("#hero-image").alt = t(["welcome", "trendy", "home"][slide]);
    $("#hero-banner").dataset.promo = ["welcome", "trendy", "home"][slide];
    $("#carousel-dots").replaceChildren(
      ...slides.map((_, index) => {
        const dot = element("button");
        dot.setAttribute("aria-label", `${t("promo")} ${index + 1}`);
        dot.setAttribute("aria-current", String(index === slide));
        dot.addEventListener("click", () => {
          slide = index;
          renderSlide();
        });
        return dot;
      }),
    );
  }
  $("#previous-slide").addEventListener("click", () => {
    slide = (slide + slides.length - 1) % slides.length;
    renderSlide();
  });
  $("#next-slide").addEventListener("click", () => {
    slide = (slide + 1) % slides.length;
    renderSlide();
  });
  const shortcuts = [
    ["ส่งฟรี", "Free shipping"],
    ["Fulfilled", "Fulfilled"],
    ["ช้อปปี้เทรนด์ดี้", "Shopee Trendy"],
    ["ช้อปปี้มอลล์", "Shopee Mall"],
    ["ช้อปปี้แฟชั่น", "Shopee Fashion"],
    ["ช้อปปี้ถูกชัวร์", "Best deals"],
    ["ซูเปอร์มาร์เก็ต", "Supermarket"],
  ];
  function renderShortcuts() {
    $("#shortcuts").replaceChildren(
      ...shortcuts.map((label, index) => {
        const button = element("button", "shortcut");
        const img = element("img");
        img.src = `/static/assets/shortcut-${index}.webp`;
        img.alt = "";
        button.append(
          img,
          element("span", "", label[state.language === "th" ? 0 : 1]),
        );
        button.addEventListener("click", () =>
          showPromo(index === 2 ? "trendy" : "welcome"),
        );
        return button;
      }),
    );
  }
  let couponClaimed = false;
  let currentPromo = "welcome";
  function showPromo(key) {
    currentPromo = key;
    $("#promo-title").textContent = t(key);
    $("#claim-coupon").textContent = t(couponClaimed ? "claimed" : "claim");
    $("#claim-coupon").disabled = couponClaimed;
    openDialog($("#promo-dialog"));
  }
  $$("[data-promo]").forEach((button) =>
    button.addEventListener("click", () => showPromo(button.dataset.promo)),
  );
  $("#claim-coupon").addEventListener("click", () => {
    couponClaimed = true;
    $("#claim-coupon").textContent = t("claimed");
    $("#claim-coupon").disabled = true;
    toast(t("couponSaved"));
  });
  const dealProducts = [
    catalog[4],
    catalog[0],
    catalog[2],
    catalog[3],
    catalog[5],
    catalog[7],
  ];
  function renderDeals() {
    $("#flash-products").replaceChildren(
      ...dealProducts.map((product, index) => {
        const button = element("a", "flash-card");
        button.href = `/products/${encodeURIComponent(product.id)}`;
        button.dataset.product = product.id;
        button.setAttribute(
          "aria-label",
          `${name(product)} ${price(product.price)}`,
        );
        const amount = element("div", "flash-price", price(product.price));
        const bar = element("div", "sold-bar");
        bar.style.setProperty("--sold", `${55 + index * 7}%`);
        bar.append(element("span", "", t("soldFast")));
        button.append(
          productImage(product),
          element(
            "span",
            "discount",
            `−${Math.round((1 - product.price / product.original) * 100)}%`,
          ),
          amount,
          bar,
        );
        return button;
      }),
    );
  }
  const popularProducts = [...catalog].filter(product => product.sold > 0)
    .sort((a, b) => b.sold - a.sold).slice(0, 6);
  function renderPopular() {
    $("#popular-products").replaceChildren(...popularProducts.map((product, index) => {
      const button = element("a", "popular-product");
      button.href = `/products/${encodeURIComponent(product.id)}`;
      button.dataset.product = product.id;
      button.append(element("span", "popular-rank", `TOP ${index + 1}`), productImage(product),
        element("span", "popular-sales", `${t("sold")} ${product.sold.toLocaleString("en-US")}`),
        element("span", "popular-name", name(product)));
      return button;
    }));
  }
  const brandShops = [
    ["MizuMi", "mizumi_officialshop"], ["Dr.PONG", "shop/6583190"],
    ["Lotus’s", "shop/144046792"], ["Dove", "shop/201488045"],
    ["Oral-B", "shop/78382981"], ["LION", "lion.official"],
    ["L’Oréal Paris", "collections/22202126"], ["Skinfier", "shop/1459654235"],
  ];
  function renderBrands() {
    $("#brand-shops").replaceChildren(...brandShops.map(([brand, path], index) => {
      const link = element("a", "brand-shop");
      link.href = `https://shopee.co.th/${path}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${brand} · ${t("brandReference")}`);
      const image = element("img");
      image.src = `/static/assets/brand-${index}.webp`;
      image.alt = brand;
      image.loading = "lazy";
      image.width = 180;
      image.height = 216;
      link.append(image);
      return link;
    }));
  }
  const countdownEnd = Date.now() + (46 * 60 + 48) * 1000;
  function renderCountdown() {
    const seconds = Math.max(0, Math.floor((countdownEnd - Date.now()) / 1000));
    $("#countdown").textContent = [
      Math.floor(seconds / 3600),
      Math.floor(seconds / 60) % 60,
      seconds % 60,
    ]
      .map((part) => String(part).padStart(2, "0"))
      .join(" : ");
    $("#countdown").setAttribute("aria-label", t("sampleTime"));
  }
  window.setInterval(renderCountdown, 1000);
  $("#all-deals").addEventListener("click", () => {
    reset();
    state.limit = catalog.length;
    renderProducts();
  });
  Object.assign(text.th, {
    productLoading: "กำลังโหลดสินค้า…",
    productUnavailable: "ไม่สามารถโหลดสินค้าได้",
    productNotFound: "ไม่พบสินค้า",
    backToProducts: "กลับไปเลือกสินค้า",
    retryProduct: "ลองอีกครั้ง",
    productNavigation: "เส้นทางสินค้า",
    productImages: "รูปสินค้า",
    productCategory: "หมวดหมู่",
    specifications: "ข้อมูลจำเพาะของสินค้า",
    productDescription: "รายละเอียดสินค้า",
    descriptionMissing: "ผู้ขายยังไม่ได้ระบุรายละเอียดสินค้า",
    sourceListing: "ดูรายการอ้างอิงบน Shopee",
    sourceNote: "ข้อมูลบรรจุภัณฑ์จากรายการอ้างอิง · ยังไม่ได้ตรวจยืนยัน",
    viewCart: "ดูตะกร้าสินค้า",
    decreaseQuantity: "ลดจำนวน",
    increaseQuantity: "เพิ่มจำนวน",
    stockMissing: "ยังไม่ระบุจำนวนคงเหลือ",
    outOfStock: "สินค้าหมด",
    quantity: "จำนวน",
    add: "เพิ่มไปยังตะกร้า",
    added: "เพิ่มสินค้าลงตะกร้าแล้ว",
    quantityError: "กรุณาระบุจำนวนเต็มตั้งแต่ 1 ถึง 99 ชิ้น",
    emptyCart: "ยังไม่มีสินค้าในตะกร้า",
    total: "ยอดรวม",
    remove: "ลบ",
    sampleProduct: "สินค้า · ภาพประกอบจากเว็บไซต์อ้างอิง · ไม่ใช่ผลการรับรอง",
    accountTitle: "บัญชี",
    accountBody:
      "ระบบบัญชียังไม่เปิดให้บริการ คุณสามารถค้นหาและเพิ่มสินค้าลงตะกร้าได้",
    sellerTitle: "Seller Centre",
    sellerBody:
      "หน้าผู้ขายยังไม่อยู่ในขอบเขตต้นแบบนี้ ทดลองใช้งาน API ตรวจสอบข้อมูลได้ที่ /docs",
    helpTitle: "วิธีใช้งานเว็บไซต์",
    helpBody:
      "ค้นหาสินค้า เลือกหมวดหมู่ เปิดรายละเอียด และเพิ่มสินค้าลงตะกร้า การชำระเงินยังไม่เปิดให้บริการ",
    downloadTitle: "เว็บไซต์บนมือถือ",
    downloadBody:
      "ต้นแบบนี้รองรับการใช้งานผ่านเบราว์เซอร์บนมือถือ ไม่มีแอปพลิเคชันให้ดาวน์โหลด",
    socialTitle: "ช่องทาง",
    socialBody:
      "ปุ่มนี้แสดงรูปแบบหน้าร้านเท่านั้น ต้นแบบไม่เชื่อมต่อบัญชีโซเชียลมีเดีย",
    notificationsTitle: "การแจ้งเตือน",
    notificationsBody: "ไม่มีการแจ้งเตือนใหม่ในเว็บไซต์",
    aboutTitle: "เกี่ยวกับต้นแบบ TrustCart",
    aboutBody:
      "สร้างโดย Team BlueScreen โดยอ้างอิงรูปแบบหน้าแรกของ Shopee Thailand เพื่อสาธิตหน้าร้านเท่านั้น ไม่มีความเกี่ยวข้องอย่างเป็นทางการกับ Shopee",
  });
  Object.assign(text.en, {
    productLoading: "Loading product…",
    productUnavailable: "Could not load product",
    productNotFound: "Product not found",
    backToProducts: "Back to products",
    retryProduct: "Try again",
    productNavigation: "Product navigation",
    productImages: "Product images",
    productCategory: "Category",
    specifications: "Product specifications",
    productDescription: "Product description",
    descriptionMissing: "The seller has not added a description yet.",
    sourceListing: "View source listing on Shopee",
    sourceNote: "Packaging information from the source listing · not verified",
    viewCart: "View cart",
    decreaseQuantity: "Decrease quantity",
    increaseQuantity: "Increase quantity",
    stockMissing: "Stock not provided",
    outOfStock: "Out of stock",
    quantity: "Quantity",
    add: "Add to cart",
    added: "Added to cart",
    quantityError: "Enter a whole number from 1 to 99",
    emptyCart: "Your cart is empty",
    total: "Total",
    remove: "Remove",
    sampleProduct:
      "Synthetic product · reference imagery · no verification result",
    accountTitle: "Demo account",
    accountBody:
      "Accounts are not available yet. You can browse products and add items to your cart.",
    sellerTitle: "Seller Centre",
    sellerBody:
      "The seller portal is outside this UI prototype. Try the synthetic verification API at /docs.",
    helpTitle: "Using the demo",
    helpBody:
      "Search, select a category, open product details and add items to the sample cart. All catalog data is synthetic. No payments or deliveries take place.",
    downloadTitle: "Mobile website",
    downloadBody:
      "This prototype works in your mobile browser. There is no app to download.",
    socialTitle: "Demo social links",
    socialBody:
      "These controls demonstrate the storefront layout. No social accounts are connected.",
    notificationsTitle: "Notifications",
    notificationsBody: "You have no new notifications in this demo.",
    aboutTitle: "About the TrustCart prototype",
    aboutBody:
      "Built by Team BlueScreen using the Shopee Thailand homepage as a visual reference. This is an independent storefront prototype with no official Shopee affiliation.",
  });
  const cart = new Map();
  let selectedProduct = null;
  let catalogLoaded = false;
  let catalogFailed = false;
  function routeProductId() {
    const match = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch (_) { return ""; }
  }
  function resolveProductRoute(force = false) {
    const id = routeProductId();
    const detailPage = $("#product-page");
    const home = id === null;
    detailPage.hidden = home;
    $("#storefront-home").hidden = !home;
    document.body.classList.toggle("product-detail-page", !home);
    if (home) {
      selectedProduct = null;
      document.title = "TrustCart • Marketplace";
      return;
    }
    const product = findProduct(id);
    if (product) {
      const changed = !selectedProduct || JSON.stringify(product) !== JSON.stringify(selectedProduct);
      selectedProduct = product;
      if (changed || force) renderDetail();
      document.title = `${name(product)} | TrustCart`;
      detailPage.removeAttribute("aria-busy");
      return;
    }
    selectedProduct = null;
    const loading = !catalogLoaded && !catalogFailed;
    detailPage.setAttribute("aria-busy", String(loading));
    const message = element("section", "product-page-state");
    const heading = element("h1", "", t(loading ? "productLoading" : catalogFailed ? "productUnavailable" : "productNotFound"));
    const homeLink = element("a", "text-button", t("backToProducts"));
    homeLink.href = "/";
    homeLink.dataset.homeLink = "";
    message.append(heading, homeLink);
    if (catalogFailed) {
      const retry = element("button", "primary", t("retryProduct"));
      retry.type = "button";
      retry.addEventListener("click", () => {
        catalogFailed = false;
        catalogLoaded = false;
        resolveProductRoute();
        refreshSellerProducts();
      });
      message.append(retry);
    }
    $("#product-detail").replaceChildren(message);
    document.title = `${heading.textContent} | TrustCart`;
  }
  function navigateProductPage(url) {
    if (window.location.pathname !== url) window.history.pushState({}, "", url);
    resolveProductRoute();
    $("#main").scrollIntoView({ block: "start", behavior: "instant" });
    const heading = $("#product-title") || $("#main");
    heading.focus({ preventScroll: true });
  }
  window.addEventListener("popstate", () => resolveProductRoute());
  let currentInfo = "help";
  function renderDetail() {
    const product = selectedProduct;
    const categoryName = categories[product.category][state.language === "th" ? 0 : 1];
    const breadcrumb = element("nav", "detail-breadcrumb");
    breadcrumb.setAttribute("aria-label", t("productNavigation"));
    const back = element("a", "text-button", "TrustCart");
    back.id = "detail-back";
    back.href = "/";
    back.dataset.homeLink = "";
    breadcrumb.append(back, element("span", "", "›"), element("span", "", categoryName),
      element("span", "", "›"), element("span", "detail-breadcrumb-name", name(product)));

    const layout = element("div", "product-detail-layout");
    const details = element("section", "product-purchase");
    details.setAttribute("aria-labelledby", "product-title");
    const heading = element("h1", "", name(product));
    heading.tabIndex = -1;
    heading.id = "product-title";
    if (hasProductVerification(product))
      heading.prepend(productCheckmark(product), document.createTextNode(" "));
    const metadata = element("div", "detail-metadata", categoryName);
    if (!product.sellerProduct && product.sold > 0)
      metadata.append(element("span", "", `${t("sold")} ${product.sold.toLocaleString("en-US")}`));
    const pricePanel = element("div", "detail-price-panel");
    if (product.original > product.price && product.price !== null) {
      pricePanel.append(element("del", "detail-original-price", price(product.original)));
    }
    pricePanel.append(element("div", "detail-price", price(product.price)));
    const limit = product.sellerProduct ? Math.min(99, product.stock || 0) : 99;
    const stock = element("p", "product-stock");
    stock.id = "product-stock";
    if (product.sellerProduct) stock.textContent = product.stock == null
      ? t("stockMissing") : product.stock === 0 ? t("outOfStock")
      : (state.language === "th" ? `มีสินค้าทั้งหมด ${product.stock} ชิ้น` : `${product.stock} in stock`);
    const quantity = element("div", "quantity");
    const label = element("label", "", t("quantity"));
    label.htmlFor = "quantity";
    const input = element("input");
    Object.assign(input, { id: "quantity", type: "number", min: "1", max: String(limit), step: "1", value: "1" });
    input.disabled = limit === 0;
    input.setAttribute("aria-describedby", "product-stock");
    const controls = element("div", "quantity-controls");
    const decrease = element("button", "quantity-step", "−");
    const increase = element("button", "quantity-step", "+");
    decrease.id = "decrease-quantity";
    increase.id = "increase-quantity";
    decrease.type = increase.type = "button";
    decrease.setAttribute("aria-label", t("decreaseQuantity"));
    increase.setAttribute("aria-label", t("increaseQuantity"));
    const updateQuantityButtons = () => {
      decrease.disabled = limit === 0 || Number(input.value) <= 1;
      increase.disabled = limit === 0 || Number(input.value) >= limit;
    };
    for (const [button, delta] of [[decrease, -1], [increase, 1]]) {
      button.addEventListener("click", () => {
        const value = Number(input.value);
        input.value = String(Math.max(1, Math.min(limit, (Number.isInteger(value) ? value : 1) + delta)));
        updateQuantityButtons();
      });
    }
    input.addEventListener("input", updateQuantityButtons);
    updateQuantityButtons();
    controls.append(decrease, input, increase);
    quantity.append(label, controls, stock);
    const add = element("button", "detail-add-to-cart", t("add"));
    add.disabled = product.price === null || limit === 0;
    add.id = "add-to-cart";
    add.addEventListener("click", () => {
      const quantity = Number(input.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > limit || (cart.get(product.id) || 0) + quantity > limit) {
        toast(product.sellerProduct
          ? (state.language === "th" ? `จำนวนรวมในตะกร้าต้องไม่เกิน ${limit} ชิ้น` : `Cart quantity must not exceed ${limit}`)
          : t("quantityError"));
        input.focus();
        return;
      }
      cart.set(product.id, (cart.get(product.id) || 0) + quantity);
      renderCart();
      toast(t("added"));
    });
    const viewCart = element("button", "primary", t("viewCart"));
    viewCart.id = "detail-view-cart";
    viewCart.type = "button";
    viewCart.addEventListener("click", showCart);
    const actions = element("div", "detail-actions");
    actions.append(add, viewCart);
    details.append(heading, metadata, pricePanel, quantity, actions);

    const gallery = element("div", "product-gallery");
    const mainImage = productImage(product);
    mainImage.loading = "eager";
    gallery.append(mainImage);
    const imageSources = product.images?.length ? product.images : [mainImage.getAttribute("src")];
    const thumbnails = element("div", "product-thumbnails");
    thumbnails.setAttribute("aria-label", t("productImages"));
    const position = element("p", "gallery-position", `1 / ${imageSources.length}`);
    position.id = "gallery-position";
    position.setAttribute("aria-live", "polite");
    imageSources.forEach((src, index) => {
      const button = element("button");
      button.type = "button";
      button.setAttribute("aria-label", `${name(product)} · ${index + 1}`);
      button.setAttribute("aria-pressed", String(index === 0));
      const thumbnail = productImage(product);
      thumbnail.src = src;
      button.append(thumbnail);
      button.addEventListener("click", () => {
        mainImage.src = src;
        mainImage.alt = `${name(product)} · ${index + 1}`;
        position.textContent = `${index + 1} / ${imageSources.length}`;
        thumbnails.querySelectorAll("button").forEach(node => node.setAttribute("aria-pressed", String(node === button)));
      });
      thumbnails.append(button);
    });
    gallery.append(thumbnails, position);
    layout.append(gallery, details);

    const descriptionSection = element("section", "product-description-section");
    descriptionSection.setAttribute("aria-labelledby", "product-description-title");
    const specsTitle = element("h2", "", t("specifications"));
    const specs = element("dl", "detail-specifications");
    specs.append(element("dt", "", t("productCategory")), element("dd", "", categoryName));
    const descriptionTitle = element("h2", "", t("productDescription"));
    descriptionTitle.id = "product-description-title";
    const description = product.sourceDescription ||
      (state.language === "th" ? product.descriptionTh : product.descriptionEn) || t("descriptionMissing");
    descriptionSection.append(specsTitle, specs, descriptionTitle, element("p", "product-description", description));
    if (product.sourceUrl) {
      const source = element("a", "source-reference", t("sourceListing"));
      source.href = product.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      descriptionSection.append(element("p", "detail-note", t("sourceNote")), source);
    }
    $("#product-detail").replaceChildren(breadcrumb, layout, descriptionSection);
  }
  function renderCart() {
    let adjusted = false;
    for (const [id, quantity] of cart) {
      const product = findProduct(id);
      const limit = product?.sellerProduct ? Math.min(99, product.stock || 0) : 99;
      if (!product || product.price === null || limit === 0) { cart.delete(id); adjusted = true; }
      else if (quantity > limit) { cart.set(id, limit); adjusted = true; }
    }
    if (adjusted) toast(state.language === "th" ? "ปรับตะกร้าตามจำนวนสินค้าคงเหลือล่าสุดแล้ว" : "Cart updated to match current stock");
    const count = [...cart.values()].reduce(
      (sum, quantity) => sum + quantity,
      0,
    );
    $("#cart-count").textContent = count;
    $("#cart-count").hidden = count === 0;
    $("#open-cart").setAttribute("aria-label", `${t("cart")} (${count})`);
    let total = 0;
    const items = [...cart].map(([id, quantity]) => {
      const product = findProduct(id);
      total += product.price * quantity;
      const row = element("div", "cart-item");
      const copy = element("div");
      copy.append(
        element("h3", "", name(product)),
        element("p", "", `${price(product.price)} × ${quantity}`),
      );
      const remove = element("button", "", t("remove"));
      remove.dataset.remove = id;
      remove.setAttribute("aria-label", `${t("remove")} ${name(product)}`);
      remove.addEventListener("click", () => {
        cart.delete(id);
        renderCart();
        (
          $("#cart-items [data-remove]") || $("#cart-dialog [data-close]")
        ).focus();
      });
      row.append(productImage(product), copy, remove);
      return row;
    });
    $("#cart-items").replaceChildren(
      ...(items.length ? items : [element("p", "empty-cart", t("emptyCart"))]),
    );
    $("#cart-total").textContent = `${t("total")}: ${price(total)}`;
  }
  function showCart() {
    renderCart();
    openDialog($("#cart-dialog"));
  }
  $("#open-cart").addEventListener("click", showCart);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const homeLink = event.target.closest("[data-home-link]");
    const card = event.target.closest("[data-product]");
    if (homeLink || card) {
      event.preventDefault();
      navigateProductPage(homeLink ? "/" : `/products/${encodeURIComponent(card.dataset.product)}`);
    }
  });
  $$("[data-info]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.info === "seller") {
        window.location.assign("/seller");
        return;
      }
      if (button.dataset.info === "cart") {
        showCart();
        return;
      }
      currentInfo = button.dataset.info;
      $("#info-title").textContent = t(`${currentInfo}Title`);
      $("#info-body").textContent = t(`${currentInfo}Body`);
      openDialog($("#info-dialog"));
    }),
  );
  const thaiLabels = new Map(
    $$("[data-i18n]").map((node) => [node, node.textContent]),
  );
  Object.assign(text.en, {
    skip: "Skip to main content",
    demo: "TrustCart · UI prototype · synthetic products · no real purchases · independent of Shopee",
    api: "API documentation",
    sell: "Start selling",
    download: "Download",
    follow: "Follow us",
    notifications: "Notifications",
    help: "Help",
    signup: "Sign up",
    login: "Log in",
    categories: "Categories",
    sampleDeals: "Sample deals",
    discover: "Daily discovery",
    sort: "Sort products",
    recommended: "Recommended",
    priceLow: "Price: low to high",
    priceHigh: "Price: high to low",
    tryAgain: "Try a different search or category.",
    reset: "Show all products",
    more: "See more",
    aboutTitle: "A new way to explore shopping with TrustCart",
    aboutBody:
      "A TrustCart storefront prototype recreating the Shopee Thailand homepage layout. Products, prices and promotions are illustrative. No payment or real order is processed.",
    verificationNote:
      "This page does not display product certifications. The separate synthetic registry API covers baseline identity and category checks only.",
    helpCenter: "Customer service",
    howTo: "How to use the demo",
    aboutTrustCart: "About TRUSTCART",
    aboutDemo: "About the prototype",
    reference: "Reference: Shopee Thailand",
    payments: "Payment methods",
    noPayment: "Visual examples only. No payments accepted.",
    delivery: "Delivery services",
    synthetic: "All catalog data is synthetic",
    independent: "Independent prototype. No official affiliation with Shopee.",
    backTop: "Back to top",
    cartNote: "Demo cart · no real orders · resets when you reload",
    understood: "Got it",
    couponNote: "Sample voucher only. Cannot be used on real orders.",
  });
  function renderHints() {
    const hints =
      state.language === "th"
        ? [
            "หูฟัง",
            "กระเป๋า",
            "เสื้อเชิ้ต",
            "รองเท้าผ้าใบ",
            "นาฬิกา",
            "เครื่องใช้ในบ้าน",
          ]
        : ["Headphones", "Bags", "Shirt", "Sneakers", "Watch", "Home & living"];
    $("#search-hints").replaceChildren(
      ...hints.map((hint) => {
        const button = element("button", "", hint);
        button.dataset.query = hint;
        button.addEventListener("click", () => {
          state.category = null;
          state.query = hint;
          state.limit = 12;
          $("#search").value = hint;
          renderCategories();
          browse();
        });
        return button;
      }),
    );
  }
  function renderLanguage() {
    document.documentElement.lang = state.language;
    $$("[data-i18n]").forEach((node) => {
      node.textContent =
        state.language === "th" ? thaiLabels.get(node) : t(node.dataset.i18n);
    });
    $("#search").placeholder = t("placeholder");
    $("#search").setAttribute("aria-label", t("searchLabel"));
    $(".search-button").setAttribute("aria-label", t("search"));
    $("#previous-slide").setAttribute("aria-label", t("previous"));
    $("#next-slide").setAttribute("aria-label", t("next"));
    $$(".dialog-close").forEach((button) =>
      button.setAttribute("aria-label", t("close")),
    );
    $(".carousel").setAttribute("aria-label", t("promo"));
    $(".shortcuts").setAttribute(
      "aria-label",
      state.language === "th" ? "บริการ" : "Services",
    );
    $$(".promotions .side-promos img").forEach((img, index) => {
      img.alt = t(index === 0 ? "trendy" : "home");
    });
    $(".new-user-banner img").alt = t("welcome");
    $("#promo-title").textContent = t(currentPromo);
    $("#claim-coupon").textContent = t(couponClaimed ? "claimed" : "claim");
    $("#info-title").textContent = t(`${currentInfo}Title`);
    $("#info-body").textContent = t(`${currentInfo}Body`);
    renderHints();
    renderCategories();
    renderProducts();
    renderShortcuts();
    renderDeals();
    renderBrands();
    renderPopular();
    renderSlide();
    renderCart();
    resolveProductRoute(true);
  }
  $("#language").addEventListener("change", () => {
    state.language = $("#language").value === "en" ? "en" : "th";
    renderLanguage();
  });
  Object.assign(text.th, {
    popular: "สินค้ายอดนิยม",
    brandSubtitle: "แบรนด์ที่น่าสนใจ",
    brandReference: "ดูบน Shopee ↗",
    accountTitle: "บัญชีผู้ใช้",
    helpTitle: "ศูนย์ช่วยเหลือ",
    downloadTitle: "ใช้งานบนมือถือ",
    downloadBody: "เปิดเว็บไซต์นี้ผ่านเบราว์เซอร์บนมือถือ",
    socialTitle: "ติดตามเรา",
    socialBody: "ช่องทางโซเชียลยังไม่เปิดให้บริการ",
    aboutTitle: "เกี่ยวกับ TrustCart",
    aboutBody: "ระบบตรวจสอบข้อมูลสินค้าจาก Team BlueScreen",
    sellerBody: "จัดการรายการสินค้าได้ที่ Seller Centre",
    sampleTime: "เวลาที่เหลือ",
  });
  Object.assign(text.en, {
    popular: "Popular products",
    brandSubtitle: "Featured brands",
    brandReference: "View on Shopee ↗",
    demo: "TrustCart · Product verification",
    sampleDeals: "Special deals",
    synthetic: "TrustCart",
    homeTitle: "Shop online with TrustCart",
    claim: "Save voucher",
    claimed: "Voucher saved",
    couponSaved: "Voucher saved",
    sampleTime: "Time remaining",
    cartNote: "Cart resets when you reload",
    couponNote: "Checkout is not available yet.",
    aboutTitle: "Shop with TrustCart",
    aboutBody:
      "Discover products and check listing information with TrustCart.",
    verificationNote:
      "Verification results cover the checks supported by TrustCart.",
    independent: "TrustCart by Team BlueScreen · Independent of Shopee",
    aboutDemo: "About TrustCart",
    helpTitle: "Help",
    howTo: "How to shop",
    aboutTrustCart: "About TrustCart",
    accountTitle: "Account",
    downloadBody: "Use this website in your mobile browser.",
    socialTitle: "Social channels",
    socialBody: "Social accounts are not connected yet.",
    notificationsBody: "You have no new notifications.",
    sellerBody: "Manage your listings in Seller Centre.",
    helpBody:
      "Search, browse categories and add products to your cart. Checkout is not available yet.",
  });
  renderHints();
  renderCart();
  renderCountdown();
  renderSlide();
  renderShortcuts();
  renderDeals();
  renderBrands();
  renderPopular();
  renderCategories();
  renderProducts();
  let catalogRequest = 0;
  async function refreshSellerProducts() {
    if (typeof window.fetch !== "function") return;
    const request = ++catalogRequest;
    const previousVerified = selectedProduct && hasProductVerification(selectedProduct);
    try {
      const response = await window.fetch("/v1/products", {
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      const records = await response.json();
      if (request !== catalogRequest) return;
      if (!Array.isArray(records)) throw Error();
      catalogLoaded = true;
      catalogFailed = false;
      const incoming = records.filter(
        (record) =>
          record &&
          typeof record.id === "string" &&
          record.listing &&
          record.verification,
      );
      for (let index = catalog.length - 1; index >= 0; index--)
        if (catalog[index].sellerProduct) {
          productVerifications.delete(catalog[index].id);
          catalog.splice(index, 1);
        }
      for (const record of incoming) {
        const listing = record.listing;
        catalog.push({
          id: record.id,
          sellerProduct: true,
          th: listing.title || listing.product_name,
          en: listing.title || listing.product_name,
          descriptionTh: listing.description,
          descriptionEn: listing.description,
          category:
            listing.category === "supplement"
              ? 1
              : listing.category === "cosmetic"
                ? 0
                : 9,
          price: listing.price == null ? null : Number(listing.price),
          stock: listing.stock ?? null,
          images: listing.images || [],
          original: 0,
          sold: 0,
        });
        productVerifications.set(record.id, record.verification);
      }
    } catch (_) {
      if (request !== catalogRequest) return;
      catalogFailed = true;
      for (const product of catalog)
        if (product.sellerProduct) productVerifications.delete(product.id);
    }
    renderProducts();
    renderCart();
    resolveProductRoute(Boolean(selectedProduct) && previousVerified !== hasProductVerification(selectedProduct));
  }
  window.addEventListener("focus", refreshSellerProducts);
  window.addEventListener("storage", (event) => {
    if (event.key === "trustcart-products-updated") refreshSellerProducts();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshSellerProducts();
  });
  window.setInterval(() => {
    if (!document.hidden) refreshSellerProducts();
  }, 5000);
  resolveProductRoute();
  refreshSellerProducts();
  function saveReviewerReports() {
    const reports = [...productVerifications.entries()]
      .filter(([, result]) => typeof result?.id === "string")
      .map(([productId, result]) => ({
        id: result.id,
        title: findProduct(productId).th,
        productId: findProduct(productId).sellerProduct ? productId : undefined,
        status: result.status,
      }));
    try {
      window.sessionStorage.setItem(
        "trustcart-demo-reports",
        JSON.stringify(reports),
      );
    } catch (_) {
      /* Report ID links still work if storage is unavailable. */
    }
  }
  async function loadProductVerification(product) {
    if (typeof window.fetch !== "function") return;
    try {
      const response = await window.fetch("/v1/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_reference: "DEMO-001",
          product_name:
            product.id === checkedProduct.id
              ? "Vitamin C Supplement"
              : product.th.split(" — ")[0],
          license_holder:
            product.id === checkedProduct.id
              ? "LumaVale"
              : product.en.split(" ")[0],
          category: "supplement",
          title: product.th,
          description: product.descriptionTh || "วิตามินซี ชนิดเม็ด",
        }),
      });
      if (!response.ok) throw new Error("verification unavailable");
      const result = await response.json();
      productVerifications.set(product.id, result);
      if (product.id === checkedProduct.id) {
        productVerification = result;
        if (typeof result?.id === "string")
          $("#reviewer-link").href =
            `/reviewer?id=${encodeURIComponent(result.id)}`;
      }
      saveReviewerReports();
    } catch (_) {
      productVerifications.set(product.id, { status: "UNKNOWN" });
      if (product.id === checkedProduct.id) productVerification = null;
    }
    renderProducts();
    if (selectedProduct?.id === product.id) renderDetail();
  }
  [checkedProduct, ...catalog.filter((product) => product.overclaim)].forEach(
    loadProductVerification,
  );
})();
