from test_connected_access import connected, login


def test_diagnostic_products_do_not_overwrite_connected_submissions(connected):
    client, password = connected
    login(client, password)
    product = client.post('/v1/seller/products', json={'title': 'Shop-owned product', 'price': '199'}).json()
    login(client, password, 'reviewer')
    # The legacy workspace's list must coexist with products verified by submissions.
    response = client.get('/v1/products')
    assert response.status_code == 200
    assert response.json() == []
    assert client.get('/v1/products/' + product['id']).status_code == 409
    response = client.put('/v1/products/' + product['id'], json={**product['listing'], 'expected_version': 1})
    assert response.status_code == 409
    login(client, password)
    unchanged = client.get('/v1/seller/products/' + product['id']).json()
    assert unchanged['version'] == 1
    assert unchanged['verification'] is None
