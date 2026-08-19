import requests

session = requests.Session()
login_res = session.post("http://127.0.0.1:8000/api/auth/login", json={
    "email": "karthik@example.com",
    "password": "Karthik@123"
})
if login_res.status_code == 200:
    token = login_res.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    res = session.get("http://127.0.0.1:8000/api/sales?sort_by=created_at&sort_dir=desc")
    print("Sales list:", res.status_code)
else:
    print("Login failed")
