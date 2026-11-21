import json
from contextlib import closing
from sqlite3 import connect

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_known_demo_titles_are_cleaned_up_without_rewriting_saved_product(tmp_path):
    database = tmp_path / "catalog.sqlite3"
    product_id = "8a4c870f-b534-47fd-a884-a199bebc8043"
    another_id = "fd731f3f-b556-4cb6-9333-c893d3868125"
    old_title = "Linked product mobile-1795249115474 edited"
    new_title = "Daily Supplement · Travel Pouch"
    listing = {
        "title": old_title,
        "product_name": "Demo Supplement",
        "category": "supplement",
        "price": "199.00",
        "stock": 4,
    }
    with TestClient(create_app(database)) as client, closing(connect(database)) as db:
        for key in (product_id, another_id):
            stored = json.dumps({"id": key, "version": 2, "listing": listing})
            db.execute("INSERT INTO products VALUES (?,?,?)", (key, 2, stored))
            db.execute("INSERT INTO tc_owners (id,shop_id) VALUES (?,?)", (key, "shop1"))
        db.commit()

        public = {entry["id"]: entry for entry in client.get("/v1/catalog/products").json()}
        assert public[product_id]["listing"]["title"] == new_title
        assert public[another_id]["listing"]["title"] == old_title
        assert public[product_id]["badge_eligible"] is False

        assert client.post("/v1/auth/login", json={"username": "seller1"}).status_code == 200
        seller = client.get(f"/v1/seller/products/{product_id}").json()
        assert seller["listing"] == dict(listing, title=new_title)
        saved = json.loads(db.execute("SELECT result FROM products WHERE id=?", (product_id,)).fetchone()[0])
        assert saved["listing"] == listing and saved["version"] == 2

        saved["listing"]["title"] = "Seller's updated title"
        db.execute("UPDATE products SET result=? WHERE id=?", (json.dumps(saved), product_id))
        db.commit()
        assert client.get(f"/v1/seller/products/{product_id}").json()["listing"]["title"] == "Seller's updated title"
