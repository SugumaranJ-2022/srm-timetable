# Production Deployment Guide

This guide outlines the steps required to deploy the **Smart Timetable Management System** to a live production server.

---

## 📋 General Overview

To run the application in production:
1. **Frontend**: Compile the React SPA into static HTML, CSS, and JS files, and serve them via a web server (e.g., Nginx, Vercel, Netlify).
2. **Backend**: Run the FastAPI application using an ASGI server (Uvicorn/Gunicorn) behind a reverse proxy (Nginx) with SSL (HTTPS) enabled.
3. **Database**: In a production environment with high concurrent writes, it is highly recommended to migrate from SQLite to **PostgreSQL**.

```
                           +------------------------+
                           |  User Browser (HTTPS)  |
                           +-----------+------------+
                                       |
                                       v
                           +-----------+------------+
                           |    Nginx Reverse Proxy |
                           +-----+------------+-----+
                                 |            |
             (Static Files /)    |            |   (API Requests /api)
                                 v            v
                      +----------+---+   +----+--------------------+
                      | Frontend Dist|   | Gunicorn/Uvicorn (8000) |
                      +--------------+   +----+--------------------+
                                              |
                                              v
                                         +----+-------+
                                         | PostgreSQL |
                                         +------------+
```

---

## 🛠️ Option 1: Simple Cloud Hosting (Recommended)

This is the fastest method to get the app live using managed platforms.

### 1. Frontend (Deploy to Vercel or Netlify)
- Link your GitHub repository to [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
- Configure the build command as: `npm run build`
- Configure the output directory as: `frontend/dist`
- Add the backend URL environment variable:
  - Add `VITE_API_BASE_URL` pointing to your deployed backend (e.g., `https://api.yourdomain.com`).

### 2. Backend (Deploy to Render or Railway)
- Link your GitHub repository to [Render](https://render.com/) or [Railway](https://railway.app/).
- Set the start command to:
  ```bash
  python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
  ```
- Define the following Environment Variables in the service settings dashboard:
  - `SECRET_KEY`: Generate a long, secure random string.
  - `DATABASE_URL`: Add the connection string for your database (e.g., PostgreSQL database URL provided by Render/Railway).

---

## 🖥️ Option 2: Linux Virtual Private Server (VPS) Deployment
*(Ubuntu 22.04 / 24.04 on AWS, DigitalOcean, Linode, etc.)*

### 1. Build the Frontend Assets
Run the build script on your development machine or inside a CI/CD pipeline:
```bash
npm run build --prefix frontend
```
This generates the static bundle in `frontend/dist`. Transfer these files to your VPS path (e.g. `/var/www/timetable/frontend`).

### 2. Set Up Python & Systemd on VPS

Clone the project to the server, create a virtual environment, and install requirements:
```bash
cd /var/www/timetable
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Create a production `.env` configuration file in the project folder:
```ini
SECRET_KEY=generate-a-secure-random-key-here
DATABASE_URL=sqlite+aiosqlite:////var/www/timetable/timetable.db
```

Create a **Systemd service file** to keep the backend running persistently:
```bash
sudo nano /etc/systemd/system/timetable-backend.service
```
Insert the following configuration:
```ini
[Unit]
Description=FastAPI Timetable Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/timetable
ExecStart=/var/www/timetable/venv/bin/gunicorn backend.app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable timetable-backend
sudo systemctl start timetable-backend
```

### 3. Install & Configure Nginx (Reverse Proxy & Static Server)

Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

Create a server configuration file:
```bash
sudo nano /etc/nginx/sites-available/timetable
```

Insert the configuration below, replacing server names and directories:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Serve React Frontend Static Files
    location / {
        root /var/www/timetable/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API Requests to FastAPI Backend
    location /api/v1 {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/timetable /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Enable SSL (HTTPS) with Certbot

To secure the site with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow the prompts, and Nginx will be automatically configured to redirect all HTTP traffic to secure HTTPS.
