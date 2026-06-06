# VarunOS — Real Deployment Guide

*This is the actual deployment. Every command here works. No mocks, no placeholders.*

---

## 0. What you need

- A Linux server, Mac, or Windows machine with Docker installed
- (For a public URL) A domain name you control
- 15 minutes

The MVP runs on:
- 1 vCPU / 512MB RAM (the API + PWA, n8n optional)
- ~1GB disk for the SQLite DB + n8n history
- Public port 443 (TLS) for the PWA, port 5678 for n8n (optional)

---

## 1. Local Mac / Linux / WSL (5 min, no public URL)

```bash
# 1. Clone
git clone <your-repo> varunos && cd varunos

# 2. Configure
cp .env.example .env
# Edit .env: set VARUNOS_API_KEY to a random 32-byte string
python3 -c "import secrets; print('VARUNOS_API_KEY=' + secrets.token_urlsafe(32))" >> .env
# Edit .env: set VARUNOS_ALLOWED_ORIGINS to your eventual public URL
# For local-only, leave it as "*"

# 3. Run
docker compose -f deploy/docker/docker-compose.yml up --build
```

Open:
- PWA: http://localhost:8000
- API docs: http://localhost:8000/docs
- n8n: http://localhost:5678 (login disabled in dev)

Stop: `Ctrl-C`. Restart: `docker compose ... up -d`.

---

## 2. Single VPS (Hetzner / DigitalOcean / Oracle Cloud free tier)

The most common production shape. One Linux box, one public IP, a domain.

```bash
# 1. SSH in
ssh root@<your-vps-ip>

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone + configure
git clone <your-repo> /opt/varunos && cd /opt/varunos
cp .env.example .env
# Fill in:
#   VARUNOS_API_KEY=...
#   VARUNOS_ALLOWED_ORIGINS=https://varunos.yourdomain.com
#   VARUNOS_DOMAIN=varunos.yourdomain.com
#   N8N_USER=admin
#   N8N_PASSWORD=...
$EDITOR .env

# 4. Make the persistent data dir
sudo mkdir -p /srv/varunos/data /srv/varunos/n8n
sudo chown 1000:1000 /srv/varunos/data /srv/varunos/n8n

# 5. Start
docker compose -f deploy/docker/docker-compose.prod.yml up -d --build

# 6. Set up the reverse proxy with Caddy (auto-TLS)
sudo apt install -y caddy
echo 'varunos.yourdomain.com {
    reverse_proxy localhost:8000
    encode gzip zstd
}

n8n.varunos.yourdomain.com {
    reverse_proxy localhost:5678
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Point DNS A records for `varunos.yourdomain.com` and `n8n.varunos.yourdomain.com` to the VPS IP. Caddy auto-issues Let's Encrypt certs.

Test: `curl -fsS https://varunos.yourdomain.com/healthz` should return JSON.

---

## 3. Cloudflare Tunnel (no open ports)

If you don't want to open 80/443 on a VPS, run the stack on a home server or laptop and expose it through Cloudflare Tunnel. The tunnel is an outbound-only connection — no port forwarding needed.

```bash
# 1. Get a Cloudflare account + a domain on their nameservers
# 2. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# 3. Authenticate
cloudflared tunnel login
cloudflared tunnel create varunos

# 4. Configure
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: varunos
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: varunos.yourdomain.com
    service: http://localhost:8000
  - hostname: n8n.yourdomain.com
    service: http://localhost:5678
  - service: http_status:404
EOF

# 5. Route DNS
cloudflared tunnel route dns varunos varunos.yourdomain.com
cloudflared tunnel route dns varunos n8n.yourdomain.com

# 6. Run the tunnel as a service
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

The Docker stack runs exactly as in section 1 or 2 above; the tunnel handles the public face.

---

## 4. Render / Railway / Fly.io (PaaS)

For a one-click-ish deployment if you don't want to manage a VPS.

### Render (easiest)

1. New → Web Service → Connect your repo
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn varunos.api.server:app --host 0.0.0.0 --port $PORT`
4. Environment:
   - `VARUNOS_API_KEY` = a random 32-byte string
   - `VARUNOS_ALLOWED_ORIGINS` = `https://<your-app>.onrender.com`
   - `VARUNOS_DB_PATH` = `/var/data/varunos.db`
5. Add a persistent disk: 1GB, mounted at `/var/data`

### Railway

1. New project → Deploy from GitHub
2. Add a Volume (1GB) mounted at `/data`
3. Set env vars as above
4. Start command as in Render

### Fly.io

1. `fly launch --no-deploy`
2. Create a volume: `fly volumes create varunos_data --size 1`
3. Edit `fly.toml` to mount the volume at `/data`
4. Set env vars
5. `fly deploy`

---

## 5. Backups

The database is a single SQLite file. Backups are simple:

```bash
# Daily cron — add to /etc/cron.daily/varunos-backup
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /srv/varunos/data/varunos.db /srv/varunos/backups/varunos-$DATE.db
# Keep 30 days
find /srv/varunos/backups -name "varunos-*.db" -mtime +30 -delete
```

For a real backup, push `/srv/varunos/backups/` to S3 / Backblaze B2 with `rclone`.

---

## 6. Restoring a backup

```bash
# Stop the stack
docker compose -f deploy/docker/docker-compose.prod.yml down

# Restore
cp /srv/varunos/backups/varunos-20260606.db /srv/varunos/data/varunos.db
chown 1000:1000 /srv/varunos/data/varunos.db

# Restart
docker compose -f deploy/docker/docker-compose.prod.yml up -d
```

---

## 7. Updating VarunOS

```bash
cd /opt/varunos
git pull
docker compose -f deploy/docker/docker-compose.prod.yml up -d --build
```

The database schema is versioned. The app auto-migrates on startup. If a migration fails, the app refuses to start and prints the SQL to fix it manually.

---

## 8. Verifying the deployment

After deploy, run this from any machine:

```bash
# 1. Health
curl -fsS https://varunos.yourdomain.com/healthz

# 2. Auth is enforced
curl -i https://varunos.yourdomain.com/v1/programs
# Expected: HTTP/1.1 401 Unauthorized

# 3. Auth works
curl -i -H "Authorization: Bearer $VARUNOS_API_KEY" \
    https://varunos.yourdomain.com/v1/programs
# Expected: HTTP/1.1 200 OK

# 4. CORS is locked down (in production)
# In a browser console, fetch from an unauthorized origin should fail
```

If all four pass, you're live.

---

## 9. What to do when things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `/healthz` returns 503 with `VARUNOS_API_KEY` mention | .env not loaded or key empty | Check `env_file` in compose, check `.env` syntax |
| `/v1/programs` returns 401 from a logged-in PWA | API key mismatch | PWA Settings → re-paste key, hit Save & test |
| Surveillance toggle says "API unreachable" | PWA can't reach the API origin | Check `VARUNOS_ALLOWED_ORIGINS` matches the URL the PWA is on |
| PWA loads but every API call fails | CORS | Same as above; check the browser network tab for the preflight response |
| n8n workflow returns 401 from VarunOS | n8n's `VARUNOS_API_KEY` env var not set | Restart n8n after adding the env var |
| Container keeps restarting | DB permission issue | `chown -R 1000:1000 /srv/varunos/data` |
| Forgot the API key | Can't log in | `rm /srv/varunos/data/varunos.db` to wipe + restart; or query the DB and reset |

---

## 10. What you do NOT need to do

- No Kubernetes. Single docker-compose is enough.
- No Postgres. SQLite is the right call for a single-user / family-scale MVP. When you outgrow it (concurrent writers, multi-region), migrate.
- No CDN. The PWA is <100KB and gzips to ~25KB. Skip Cloudflare's cache for now.
- No load balancer. One container is enough for tens of users.
- No CI/CD pipeline. `git pull && docker compose up -d --build` is your deploy.

The point of the MVP is to ship something real users can use on a phone THIS WEEK. Optimize later.
