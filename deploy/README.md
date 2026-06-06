# VarunOS — Deployment

Three deployment paths, all free or near-free.

## 1. Local development (5 min)

```bash
git clone https://github.com/varun/varunos.git
cd varunos
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run tests
PYTHONPATH=. python3 -m pytest tests/

# Run the API
uvicorn varunos.api.server:app --reload
# → http://localhost:8000/docs

# Open the PWA
python3 -m http.server 8080 --directory pwa/
# → http://localhost:8080
```

## 2. Cloud box — Oracle ARM (free forever) or Hetzner CX22 (~€4/mo)

```bash
# On the box (Ubuntu 22.04 ARM)
ssh ubuntu@<box-ip>
sudo apt update && sudo apt install -y python3-pip python3-venv nginx

# Deploy
git clone https://github.com/varun/varunos.git /opt/varunos
cd /opt/varunos
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# systemd
sudo cp deploy/systemd/varunos.service /etc/systemd/system/
sudo cp deploy/systemd/varunos-n8n.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now varunos
sudo systemctl enable --now varunos-n8n

# Tunnel (ngrok free tier)
ngrok config add-authtoken <token>
ngrok http --domain=varunos.ngrok.app 8000

# Firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 3. Docker (testing only)

```bash
cd deploy/docker
docker compose up -d
# → API on :8000, n8n on :5678, PWA on :8080
```

## Backups

The vault should be backed up daily. Recommended:

```bash
# Encrypted vault: rclone to a private bucket (S3/GDrive)
0 3 * * * rclone sync /opt/varunos/vault/medical remote:varunos-medical --crypt

# Obsidian vault: git push to private repo
0 4 * * * cd /opt/varunos/vault && git add -A && git commit -m "auto" && git push
```

## Monitoring

Daily self-test workflow (`99_self_test.json`) pings every adapter
and alerts Slack/Discord if anything's down.

## Hardening checklist

- [ ] HTTPS via Cloudflare or Let's Encrypt
- [ ] Rate limiting on webhook endpoints
- [ ] Backups verified monthly
- [ ] Emergency contact configured
- [ ] SQLCipher key backup (offline, in a safe)
- [ ] All adapters tested
- [ ] n8n basic auth enabled
