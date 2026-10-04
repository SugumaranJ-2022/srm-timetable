import requests

# Test login to get token
base_url = "http://localhost:8000/api/v1"
res = requests.post(f"{base_url}/auth/login", data={"username": "admin@srmist.edu.in", "password": "AdminPassword123!"})
print("Login status:", res.status_code)
if res.status_code == 200:
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try PUT /admin/staff/1
    payload = {
        "name": "Dr. Rajesh Kumar Updated",
        "email": "dr.rajesh@srmist.edu.in",
        "phone": "919876543200",
        "status": "Active",
        "subject_ids": []
    }
    put_res = requests.put(f"{base_url}/admin/staff/1", json=payload, headers=headers)
    print("PUT /admin/staff/1 status:", put_res.status_code)
    print("PUT response:", put_res.text)
