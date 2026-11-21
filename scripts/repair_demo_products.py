"""Repair only the two legacy demo titles through versioned product API updates.

Run with: python -m scripts.repair_demo_products --base-url http://localhost:8000
Credentials, when required, come from TRUSTCART_DEMO_PASSWORD.
"""
import argparse
import base64
import os
from pathlib import Path

import httpx
from backend.app.registry import tool_registry_lookup

LEGACY_TITLES = {'ลูมาเวล วิตามินซี รุ่นใหม่', 'ลูมาเวล วิตามินซี พร้อมรูปสินค้า'}


def matched_listing():
    record = tool_registry_lookup('DEMO-001')
    if record is None or not record.active:
        raise RuntimeError('The existing demo registry record is unavailable')
    image = Path(__file__).resolve().parents[1] / 'frontend/assets/demo-supplement.png'
    return dict(registration_reference='DEMO-001', product_name=record.product_name,
        license_holder=record.license_holder, category=record.category,
        title=f'{record.product_name} — {record.license_holder}',
        description=f'{record.product_name} โดย {record.license_holder} ผลิตภัณฑ์เสริมอาหาร ภาพประกอบบรรจุภัณฑ์สำหรับรายการสาธิต',
        images=['data:image/png;base64,' + base64.b64encode(image.read_bytes()).decode()],
        price='199.00', stock=20)


def repair_demo_products(client):
    response = client.get('/v1/products')
    response.raise_for_status()
    matching = matched_listing()
    updated = []
    for product in response.json():
        listing = product['listing']
        if not (listing.get('title') in LEGACY_TITLES
                and listing.get('registration_reference') == 'DEMO-001'
                and listing.get('product_name') == 'Vitamin C Supplement'
                and listing.get('license_holder') == 'LumaVale'):
            continue
        corrected = {**listing, **matching,
            'price': listing.get('price') if listing.get('price') is not None else matching['price'],
            'stock': listing.get('stock') if listing.get('stock') is not None else matching['stock'],
            'expected_version': product['version']}
        saved = client.put('/v1/products/' + product['id'], json=corrected)
        saved.raise_for_status()
        updated.append(product['id'])
    return updated


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:8000')
    args = parser.parse_args()
    password = os.environ.get('TRUSTCART_DEMO_PASSWORD')
    with httpx.Client(base_url=args.base_url, auth=('demo', password) if password else None) as client:
        print('Updated demo products:', len(repair_demo_products(client)))
