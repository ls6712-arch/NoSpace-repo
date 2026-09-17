#!/bin/bash
# Interactively collects the secrets seed-moments.js needs and writes .env.seed.
# Run this yourself in your own terminal — values typed here are never sent to chat.
set -e

cd "$(dirname "$0")"

echo "Setting up .env.seed for seed-moments.js"
echo "(input for the service_role key is hidden)"
echo

read -p "Supabase URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
read -s -p "Supabase service_role key: " SUPABASE_SERVICE_ROLE_KEY
echo
read -p "Your founder user_id (UUID): " SEED_USER_ID

cat > .env.seed <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_STORAGE_BUCKET=post-media
SEED_USER_ID=${SEED_USER_ID}
EOF

chmod 600 .env.seed

echo
echo "Wrote .env.seed (permissions set to 600)."
echo "SUPABASE_STORAGE_BUCKET was set automatically to 'post-media' (the bucket the live app actually uses)."
