#!/bin/bash
# =============================================================================
# Medmacs Reference Search — Permanent Cloudflare Named Tunnel Setup
# Run this ONCE on your OCI server as root or sudo user
# =============================================================================
set -e

TUNNEL_NAME="medmacs-reference"
SERVICE_PORT=8000
ALERT_EMAIL="ameerhamza1396@gmail.com"   # <-- change if needed
DOMAIN="reference-search.medmacs.app"    # <-- must be on Cloudflare DNS

echo ""
echo "============================================================"
echo "  Medmacs Reference Search — Cloudflare Tunnel Setup"
echo "============================================================"
echo ""

# ── Step 1: Install cloudflared ──────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "[1/6] Installing cloudflared..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
      -o /usr/local/bin/cloudflared
  elif [ "$ARCH" = "aarch64" ]; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
      -o /usr/local/bin/cloudflared
  else
    echo "ERROR: Unknown architecture: $ARCH"
    exit 1
  fi
  chmod +x /usr/local/bin/cloudflared
  echo "    cloudflared installed: $(cloudflared --version)"
else
  echo "[1/6] cloudflared already installed: $(cloudflared --version)"
fi

# ── Step 2: Authenticate with Cloudflare ─────────────────────────────────────
echo ""
echo "[2/6] Authenticating with Cloudflare..."
echo "    A browser window will open. Log in and select the domain: $DOMAIN"
echo "    (If running headless, copy the URL from output and open it on your local machine)"
echo ""
cloudflared tunnel login

# ── Step 3: Create named tunnel ───────────────────────────────────────────────
echo ""
echo "[3/6] Creating named tunnel: $TUNNEL_NAME"
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
  echo "    Tunnel '$TUNNEL_NAME' already exists, skipping creation."
else
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "    Tunnel ID: $TUNNEL_ID"

# ── Step 4: Create config file ────────────────────────────────────────────────
echo ""
echo "[4/6] Writing tunnel config..."
mkdir -p /etc/cloudflared

cat > /etc/cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /root/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:${SERVICE_PORT}
  - service: http_status:404
EOF

echo "    Config written to /etc/cloudflared/config.yml"

# ── Step 5: Create DNS CNAME record ──────────────────────────────────────────
echo ""
echo "[5/6] Creating DNS CNAME: $DOMAIN → tunnel"
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || \
  echo "    (DNS record may already exist — check Cloudflare dashboard)"

# ── Step 6: Install as systemd service ───────────────────────────────────────
echo ""
echo "[6/6] Installing cloudflared as systemd service..."
cloudflared service install

# Ensure service starts on boot
systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared --no-pager

echo ""
echo "============================================================"
echo "  ✅ Done! Tunnel is now LIVE"
echo ""
echo "  Your permanent reference search URL:"
echo "  https://${DOMAIN}/search"
echo ""
echo "  Next: Set this in medmacs-ai backend env:"
echo "  REFERENCE_API_URL=https://${DOMAIN}/search"
echo ""
echo "  The tunnel will auto-restart on server reboot."
echo "============================================================"
