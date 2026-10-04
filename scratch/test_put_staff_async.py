import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import asyncio
from sqlalchemy.future import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.models import User
from backend.app.core.security import create_access_token
import requests

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == "Admin"))
        admin_users = res.scalars().all()
        print("Admin users count:", len(admin_users))
        for u in admin_users:
            print("Admin email:", u.email)
            token = create_access_token(u.email)
            headers = {"Authorization": f"Bearer {token}"}
            base_url = "http://localhost:8000/api/v1"
            # Payload matching what frontend sends (WITHOUT email)
            payload = {
                "name": "Dr. Rajesh Kumar Updated",
                "phone": "919876543200",
                "status": "Active",
                "subject_ids": []
            }
            put_res = requests.put(f"{base_url}/admin/staff/1", json=payload, headers=headers)
            print("PUT /admin/staff/1 status code:", put_res.status_code)
            print("PUT /admin/staff/1 detail:", put_res.text)

if __name__ == "__main__":
    asyncio.run(test())
