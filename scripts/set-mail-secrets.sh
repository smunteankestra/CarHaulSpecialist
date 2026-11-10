#!/usr/bin/env bash
# Pushes the Resend credentials to the Worker without putting them in shell history
# or in this chat. Put them in .mail.env (gitignored), then run: bash scripts/set-mail-secrets.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .mail.env ]; then
  cat > .mail.env <<'CONFIG'
# Fill these in, save, then run: bash scripts/set-mail-secrets.sh
# Get the key at https://resend.com/api-keys (starts with re_)
RESEND_API_KEY=
# Optional: override the sender once a domain is verified.
# MAIL_FROM=Bond Auto Transport <invoices@bondautotransport.com>
CONFIG
  echo "Created .mail.env — fill it in and run this script again."
  exit 0
fi

set -a
# shellcheck disable=SC1091
. ./.mail.env
set +a

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "RESEND_API_KEY is empty in .mail.env" >&2
  exit 1
fi

printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY >/dev/null
echo "RESEND_API_KEY set"

if [ -n "${MAIL_FROM:-}" ]; then
  printf '%s' "$MAIL_FROM" | npx wrangler secret put MAIL_FROM >/dev/null
  echo "MAIL_FROM set to $MAIL_FROM"
fi

echo "Done. Test from any Payments order → Send to client."
