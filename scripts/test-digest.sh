#!/bin/bash
# ─────────────────────────────────────────────────────────────
# test-digest.sh  — run the digest script locally
# Usage:
#   1. Fill in the values below
#   2. chmod +x scripts/test-digest.sh
#   3. ./scripts/test-digest.sh
# ─────────────────────────────────────────────────────────────

# ── Fill these in before running ────────────────────────────
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"        # 16-char Gmail App Password
SERVICE_ACCOUNT_FILE="$HOME/Downloads/jee-2027-prep-firebase-adminsdk.json"
# ─────────────────────────────────────────────────────────────

if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
  echo "❌  Service account file not found: $SERVICE_ACCOUNT_FILE"
  echo "    Download it from Firebase Console → Project Settings → Service Accounts"
  exit 1
fi

echo "▶ Installing dependencies..."
cd "$(dirname "$0")/.." && npm install --silent nodemailer firebase-admin

echo "▶ Running digest..."
FIREBASE_SERVICE_ACCOUNT="$(cat "$SERVICE_ACCOUNT_FILE")" \
GMAIL_USER="$GMAIL_USER" \
GMAIL_APP_PASSWORD="$GMAIL_APP_PASSWORD" \
  node scripts/send-digest.js
