"""Replace known demo illustrations with matching real DHC product photos through versioned product API updates.

Run with: python -m scripts.repair_demo_products --base-url http://localhost:8000
Credentials, when required, come from TRUSTCART_DEMO_PASSWORD.
"""
import argparse
import base64
import os
from pathlib import Path

import httpx

LEGACY_TITLES = {'ลูมาเวล วิตามินซี รุ่นใหม่', 'ลูมาเวล วิตามินซี พร้อมรูปสินค้า'}


def matched_listing(capsules=40):
    if capsules not in (40, 120):
        raise ValueError('Only sourced 40 and 120 capsule packs are available')
    image = Path(__file__).resolve().parents[1] / f'frontend/assets/product-dhc-{capsules}.jpg'
    return dict(registration_reference='Not supplied', product_name=f'DHC Vitamin C {capsules} capsules',
        license_holder='Not supplied', category='supplement', registry_source='unverified-reference',
        title=f'DHC วิตามินซี {capsules} แคปซูล',
        description=f'DHC Vitamin C ผลิตภัณฑ์เสริมอาหาร ชนิดแคปซูล บรรจุ {capsules} แคปซูล\n'
            'ข้อมูลชื่อและรูปบรรจุภัณฑ์: https://top.dhc.co.jp/shop/health/tempo/item/e00003/',
        images=['data:image/jpeg;base64,' + base64.b64encode(image.read_bytes()).decode()],
        price='199.00', stock=20)


def is_previous_demo(listing):
    if listing.get('registration_reference') != 'DEMO-001':
        return False
    legacy = (listing.get('title') in LEGACY_TITLES
        and listing.get('product_name') == 'Vitamin C Supplement'
        and listing.get('license_holder') == 'LumaVale')
    illustration = Path(__file__).resolve().parents[1] / 'frontend/assets/demo-supplement.png'
    previous = (listing.get('title') == 'Demo Supplement — Demo Brand'
        and listing.get('product_name') == 'Demo Supplement'
        and listing.get('license_holder') == 'Demo Brand'
        and listing.get('images') == ['data:image/png;base64,' + base64.b64encode(illustration.read_bytes()).decode()])
    return legacy or previous


def repair_demo_products(client):
    response = client.get('/v1/products')
    response.raise_for_status()
    updated = []
    for product in response.json():
        listing = product['listing']
        if not is_previous_demo(listing):
            continue
        matching = matched_listing(40 if len(updated) % 2 == 0 else 120)
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
