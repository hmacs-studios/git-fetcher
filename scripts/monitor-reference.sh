#!/bin/bash
# =============================================================================
# Medmacs Reference Search — Health Monitor & Email Alerter
# Install as a cron job: runs every 5 minutes, emails on failure/recovery
# =============================================================================

SEARCH_URL="${REFERENCE_API_URL:-http://localhost:8000/search}"
ALERT_EMAIL="ameerhamza1396@gmail.com"       # <-- your email
FROM_EMAIL="monitor@medmacs.app"              # <-- from address (or same as above)
SERVICE_NAME="Medmacs Reference Search"
STATE_FILE="/tmp/medmacs_reference_health_state"
LOG_FILE="/var/log/medmacs_reference_monitor.log"
MAX_RETRIES=2
TIMEOUT=10

# ── Helper: send email ───────────────────────────────────────────────────────
send_alert() {
  local subject="$1"
  local body="$2"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S %Z')

  # Try multiple mail backends in order
  if command -v sendmail &>/dev/null; then
    printf "To: %s\nFrom: %s\nSubject: %s\n\n%s\n\nTimestamp: %s\nServer: %s\n" \
      "$ALERT_EMAIL" "$FROM_EMAIL" "$subject" "$body" "$timestamp" "$(hostname)" \
      | sendmail -f "$FROM_EMAIL" "$ALERT_EMAIL"
    echo "[$timestamp] Alert sent via sendmail: $subject" >> "$LOG_FILE"

  elif command -v mail &>/dev/null; then
    printf "%s\n\nTimestamp: %s\nServer: %s\n" "$body" "$timestamp" "$(hostname)" \
      | mail -s "$subject" -r "$FROM_EMAIL" "$ALERT_EMAIL"
    echo "[$timestamp] Alert sent via mail: $subject" >> "$LOG_FILE"

  elif command -v curl &>/dev/null && [ -n "$MAILGUN_API_KEY" ] && [ -n "$MAILGUN_DOMAIN" ]; then
    # Mailgun fallback (set MAILGUN_API_KEY and MAILGUN_DOMAIN in env)
    curl -s --user "api:${MAILGUN_API_KEY}" \
      "https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages" \
      -F from="Medmacs Monitor <${FROM_EMAIL}>" \
      -F to="$ALERT_EMAIL" \
      -F subject="$subject" \
      -F text="$body

Timestamp: $timestamp
Server: $(hostname)"
    echo "[$timestamp] Alert sent via Mailgun: $subject" >> "$LOG_FILE"

  else
    echo "[$timestamp] WARNING: No mail backend found. Could not send: $subject" >> "$LOG_FILE"
  fi
}

# ── Health check with retries ─────────────────────────────────────────────────
check_health() {
  local attempt=0
  local http_code
  while [ $attempt -lt $MAX_RETRIES ]; do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time "$TIMEOUT" \
      -X POST "$SEARCH_URL" \
      -H "Content-Type: application/json" \
      -d '{"query":"test","top_k":1}' 2>/dev/null)

    if [ "$http_code" = "200" ]; then
      return 0  # healthy
    fi

    attempt=$((attempt + 1))
    [ $attempt -lt $MAX_RETRIES ] && sleep 3
  done
  return 1  # unhealthy
}

# ── Read previous state ────────────────────────────────────────────────────────
prev_state="unknown"
[ -f "$STATE_FILE" ] && prev_state=$(cat "$STATE_FILE")

# ── Run health check ──────────────────────────────────────────────────────────
timestamp=$(date '+%Y-%m-%d %H:%M:%S')

if check_health; then
  curr_state="up"
  echo "[$timestamp] OK — $SEARCH_URL is responding" >> "$LOG_FILE"

  # Send recovery alert only if it was previously down
  if [ "$prev_state" = "down" ]; then
    send_alert \
      "✅ RECOVERED: $SERVICE_NAME is back online" \
      "Good news! The $SERVICE_NAME has recovered and is responding normally.

URL: $SEARCH_URL
Status: ONLINE ✅"
  fi
else
  curr_state="down"
  echo "[$timestamp] FAIL — $SEARCH_URL is NOT responding" >> "$LOG_FILE"

  # Send down alert only if it was previously up (avoid repeated spam)
  if [ "$prev_state" != "down" ]; then
    send_alert \
      "🚨 DOWN: $SERVICE_NAME is UNREACHABLE" \
      "URGENT: The $SERVICE_NAME has gone down and is not responding.

URL: $SEARCH_URL
Status: OFFLINE ❌

Immediate actions needed:
1. SSH into your OCI server (161.118.227.79)
2. Check cloudflared: systemctl status cloudflared
3. Check search service: systemctl status medmacs-search (or your service name)
4. Restart if needed: systemctl restart cloudflared && systemctl restart medmacs-search

This alert will NOT repeat until the service recovers and fails again."
  fi
fi

# ── Save current state ────────────────────────────────────────────────────────
echo "$curr_state" > "$STATE_FILE"

# ── Rotate log (keep last 1000 lines) ────────────────────────────────────────
if [ -f "$LOG_FILE" ]; then
  tail -1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi
