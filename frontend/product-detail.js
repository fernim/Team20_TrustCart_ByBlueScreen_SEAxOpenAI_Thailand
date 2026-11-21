"use strict";

// Presentation-only samples. These never supply product verification or registry facts.
window.ProductDetail = (() => {
  const selections = new Map();
  const scores = [5, 5, 4, 5, 3, 4, 5, 2];
  const comments = [
    ['กล่องจัดเรียบร้อย รูปประกอบช่วยให้เห็นบรรจุภัณฑ์ชัดเจน', 'Neat packaging; the pictures make the pack easy to see.'],
    ['รายละเอียดอ่านง่าย เลือกจำนวนได้สะดวก', 'Clear description and easy quantity selection.'],
    ['แพ็กเกจดูเรียบร้อย อยากเห็นรูปเพิ่มเติม', 'Tidy packaging; I would like more pictures.'],
    ['รูปและชื่อรุ่นอ่านได้ชัดเจน', 'The pictures and product name are easy to read.'],
    ['ข้อมูลการจัดส่งควรละเอียดกว่านี้', 'Shipping information could be more detailed.'],
    ['ข้อมูลขนาดบรรจุช่วยในการเลือกสินค้า', 'Pack-size information helps with choosing the item.'],
    ['กล่องอยู่ในสภาพเรียบร้อย', 'The box arrived in good condition.'],
    ['อยากให้เพิ่มภาพด้านหลังบรรจุภัณฑ์', 'Please add a picture of the back of the packaging.'],
  ];
  const referenceSpecs = {
    14: [['แบรนด์', 'Brand', 'DHC'], ['ขนาดบรรจุ', 'Pack size', '40 แคปซูล', '40 capsules']],
    21: [['แบรนด์', 'Brand', 'NeoCell']],
    22: [['แบรนด์', 'Brand', 'Deva C']],
  };
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function button(text, action, className = '') {
    const el = node('button', className, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function stars(score) { return '★'.repeat(score) + '☆'.repeat(5 - score); }
  function sampleReviews(product) {
    if (product.sellerProduct) return [];
    return scores.map((score, i) => ({
      score, name: `sample_${String(i + 1).padStart(2, '0')}`, date: `2026-11-${String(18 - i).padStart(2, '0')}`,
      comment: comments[i], photo: [0, 2, 6].includes(i) ? product.images?.[0] || null : null,
    }));
  }
  function openPhoto(src, label, trigger, closeLabel) {
    let dialog = document.getElementById('review-photo-dialog');
    if (!dialog) {
      dialog = node('dialog', 'review-photo-dialog');
      dialog.id = 'review-photo-dialog';
      document.body.append(dialog);
    }
    const close = button(closeLabel, () => dialog.close(), 'review-photo-close');
    close.id = 'review-photo-close';
    const title = node('h2', '', label);
    title.id = 'review-photo-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const img = node('img'); img.src = src; img.alt = label;
    dialog.replaceChildren(close, title, img);
    dialog.onclose = () => {
      const target = trigger.isConnected ? trigger : [...document.querySelectorAll('[data-detail-focus]')].find(el => el.dataset.detailFocus === trigger.dataset.detailFocus);
      target?.focus();
    };
    dialog.showModal();
    close.focus();
  }
  function enhance({ product, catalog, language, productCard, details, descriptionSection, specs, imageSource }) {
    const en = language === 'en';
    const say = (th, english) => en ? english : th;
    const sample = !product.sellerProduct;
    const reviews = sampleReviews({...product, images: product.images?.length ? product.images : [imageSource]});
    const average = reviews.length ? (reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length).toFixed(1) : null;
    const selection = selections.get(product.id) || { filter: 'all', page: 1 };
    selections.set(product.id, selection);

    const rating = node('a', 'detail-rating-link');
    rating.href = '#detail-reviews';
    if (average) {
      rating.append(node('strong', '', average), node('span', 'rating-stars', stars(Math.round(Number(average)))),
        node('span', '', say(`${reviews.length} รีวิวตัวอย่าง`, `${reviews.length} sample reviews`)));
    } else rating.textContent = say('ยังไม่มีรีวิว · ดูคะแนนสินค้า', 'No reviews yet · Product ratings');
    details.querySelector('.detail-price-panel').before(rating);
    const shipping = node('dl', 'detail-shipping');
    shipping.append(node('dt', '', say('การจัดส่ง', 'Shipping')), node('dd', '', sample
      ? say('ตัวอย่าง: กรุงเทพฯ · 2–4 วัน · ฿40', 'Sample: Bangkok · 2–4 days · ฿40')
      : say('ยังไม่ระบุข้อมูลการจัดส่ง', 'Shipping information not provided')));
    if (sample) shipping.lastChild.append(node('small', '', say('ข้อมูลแสดงรูปแบบเท่านั้น ไม่ใช่ข้อเสนอจัดส่ง', 'Layout sample only; not a shipping offer')));
    details.querySelector('.quantity').before(shipping);

    descriptionSection.id = 'detail-information';
    for (const row of sample ? referenceSpecs[product.id] || [] : []) {
      specs.append(node('dt', '', row[en ? 1 : 0]), node('dd', '', en ? row[3] || row[2] : row[2]));
    }
    if (product.sellerProduct && product.stock != null) {
      specs.append(node('dt', '', say('จำนวนสินค้า', 'Stock')), node('dd', '', String(product.stock)));
    }
    const navigation = node('nav', 'detail-section-nav');
    navigation.setAttribute('aria-label', say('ส่วนต่าง ๆ ของสินค้า', 'Product sections'));
    for (const [id, label] of [['detail-information', say('รายละเอียดสินค้า', 'Product details')], ['detail-reviews', say('คะแนนและรีวิว', 'Ratings & reviews')], ['detail-related', say('สินค้าที่เกี่ยวข้อง', 'Related products')]]) {
      const link = node('a', '', label); link.href = '#' + id; navigation.append(link);
    }
    const shop = node('section', 'detail-shop'); shop.id = 'detail-shop';
    shop.setAttribute('aria-label', say('ข้อมูลร้านค้า', 'Shop information'));
    const avatar = node('div', 'shop-avatar', 'TC'); avatar.setAttribute('aria-hidden', 'true');
    const shopText = node('div', 'shop-copy');
    shopText.append(node('h2', '', sample ? 'TrustCart Demo Shop' : say('ข้อมูลผู้ขาย', 'Seller information')),
      node('p', '', sample ? say('ร้านค้าตัวอย่าง · ข้อมูลสำหรับแสดงรูปแบบ', 'Sample shop · Presentation data only') : say('ยังไม่มีข้อมูลร้านค้า', 'Shop information not available')));
    shop.append(avatar, shopText);
    if (sample) {
      const shopFacts = node('dl', 'shop-facts');
      shopFacts.append(node('dt', '', say('สินค้าในตัวอย่าง', 'Sample products')), node('dd', '', String(catalog.filter(p => !p.sellerProduct).length)),
        node('dt', '', say('การติดต่อ', 'Contact')), node('dd', '', say('ยังไม่เปิดใช้งาน', 'Not connected')));
      shop.append(shopFacts);
    }

    const section = node('section', 'detail-reviews'); section.id = 'detail-reviews';
    const title = node('h2', '', say('คะแนนและรีวิวสินค้า', 'Product ratings & reviews')); title.id = 'review-heading';
    section.setAttribute('aria-labelledby', title.id);
    const note = node('p', 'review-demo-note', sample
      ? say('รีวิวตัวอย่าง · ไม่ใช่ความคิดเห็นจากผู้ซื้อจริง และไม่เกี่ยวกับผลตรวจสอบสินค้า', 'Sample reviews · Not real buyer feedback and unrelated to product verification')
      : say('ยังไม่มีรีวิวสำหรับสินค้านี้', 'No reviews yet for this product'));
    section.append(title, note);
    if (reviews.length) {
      const summary = node('div', 'review-summary');
      const total = node('div', 'review-score');
      total.append(node('strong', 'review-average', average), node('span', '', say(' จาก 5', ' out of 5')), node('div', 'rating-stars', stars(Math.round(Number(average)))));
      const distribution = node('div', 'review-distribution');
      for (let score = 5; score >= 1; score--) {
        const count = reviews.filter(r => r.score === score).length;
        const row = node('div', 'rating-distribution-row');
        const meter = node('meter'); meter.min = 0; meter.max = reviews.length; meter.value = count;
        meter.setAttribute('aria-label', say(`${score} ดาว: ${count} รีวิว`, `${score} stars: ${count} reviews`));
        row.append(node('span', '', `${score} ★`), meter, node('span', '', String(count))); distribution.append(row);
      }
      const filters = node('div', 'review-filters');
      const list = node('div', 'review-list'); list.setAttribute('aria-live', 'polite');
      const pager = node('div', 'review-pagination');
      const labels = [['all', say('ทั้งหมด', 'All')], ...[5,4,3,2,1].map(score => [String(score), `${score} ★`]), ['photos', say('มีรูปภาพ', 'With photos')]];
      function focusPager(direction) {
        const controls = [...pager.querySelectorAll('button')];
        const target = controls.find(b => b.dataset.reviewPage === direction && !b.disabled) || controls.find(b => !b.disabled);
        target?.focus();
      }
      function renderReviews() {
        const filtered = reviews.filter(r => selection.filter === 'all' || (selection.filter === 'photos' ? r.photo : r.score === Number(selection.filter)));
        const pages = Math.max(1, Math.ceil(filtered.length / 5));
        selection.page = Math.min(selection.page, pages);
        filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.reviewFilter === selection.filter)));
        list.replaceChildren();
        for (const review of filtered.slice((selection.page - 1) * 5, selection.page * 5)) {
          const card = node('article', 'review-card');
          const identity = node('div', 'review-author');
          identity.append(node('span', 'review-avatar', review.name.slice(-2)), node('strong', '', review.name));
          const star = node('div', 'rating-stars', stars(review.score)); star.setAttribute('aria-label', `${review.score} / 5`);
          const date = node('time', 'review-date', review.date); date.dateTime = review.date;
          card.append(identity, star, date, node('p', '', review.comment[en ? 1 : 0]));
          if (review.photo) {
            const label = say('ภาพประกอบรีวิวตัวอย่าง', 'Sample review illustration');
            const photo = button('', () => openPhoto(review.photo, label, photo, say('ปิด', 'Close')), 'review-photo');
            photo.dataset.detailFocus = `photo-${review.name}`;
            photo.setAttribute('aria-label', label);
            const img = node('img'); img.src = review.photo; img.alt = label; img.loading = 'lazy';
            photo.append(img); card.append(photo);
          }
          list.append(card);
        }
        if (!filtered.length) list.append(node('p', 'reviews-empty', say('ไม่มีรีวิวที่ตรงกับตัวกรองนี้', 'No reviews match this filter')));
        const previous = button(say('ก่อนหน้า', 'Previous'), () => { selection.page--; renderReviews(); focusPager('previous'); });
        const next = button(say('ถัดไป', 'Next'), () => { selection.page++; renderReviews(); focusPager('next'); });
        previous.disabled = selection.page === 1; next.disabled = selection.page === pages;
        previous.dataset.reviewPage = 'previous'; next.dataset.reviewPage = 'next';
        previous.dataset.detailFocus = 'review-previous'; next.dataset.detailFocus = 'review-next';
        pager.replaceChildren(previous, node('span', '', `${selection.page} / ${pages}`), next);
      }
      for (const [value, label] of labels) {
        const control = button(label, () => { selection.filter = value; selection.page = 1; renderReviews(); });
        control.dataset.reviewFilter = value; control.dataset.detailFocus = 'filter-' + value; filters.append(control);
      }
      summary.append(total, distribution, filters); section.append(summary, list, pager); renderReviews();
    } else section.append(node('div', 'reviews-empty', say('เมื่อมีรีวิว จะแสดงคะแนนและความคิดเห็นที่นี่', 'Ratings and comments will appear here when available')));

    const related = node('section', 'detail-related'); related.id = 'detail-related';
    related.append(node('h2', '', say('สินค้าที่เกี่ยวข้อง', 'Related products')));
    const grid = node('div', 'related-grid');
    catalog.filter(p => p.id !== product.id && p.price != null)
      .sort((a,b) => Number(b.category === product.category) - Number(a.category === product.category))
      .slice(0,6).forEach(p => grid.append(productCard(p)));
    if (!grid.children.length) grid.append(node('p', '', say('ยังไม่มีสินค้าอื่น', 'No other products yet')));
    related.append(grid);
    return [navigation, shop, descriptionSection, section, related];
  }
  return { enhance };
})();
