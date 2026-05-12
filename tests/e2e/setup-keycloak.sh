#!/bin/bash
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8080}"
KC_REALM="${KC_REALM:-e2e}"
CLIENT_ID="${CLIENT_ID:-k6s-test-client}"
CERT_PATH="${CERT_PATH:-tests/e2e/cert.pem}"

echo "Waiting for Keycloak at $KC_URL..."
MAX_WAIT=120
WAITED=0
until curl -sf "$KC_URL/realms/master" > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Timed out waiting for Keycloak after ${MAX_WAIT}s"
    exit 1
  fi
  echo "  not ready yet, retrying in 5s... (${WAITED}s elapsed)"
  sleep 5
  WAITED=$((WAITED + 5))
done
echo "Keycloak is ready."

ADMIN_TOKEN=$(curl -sf -X POST \
  "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" \
  | jq -r '.access_token')
echo "Obtained admin token."

curl -sf -X POST "$KC_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"realm\":\"$KC_REALM\",\"enabled\":true}"
echo "Created realm '$KC_REALM'."

# Extract base64 DER from PEM (content between header/footer lines)
CERT_B64=$(grep -v "BEGIN\|END" "$CERT_PATH" | tr -d '\n')

curl -sf -X POST "$KC_URL/admin/realms/$KC_REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"enabled\": true,
    \"serviceAccountsEnabled\": true,
    \"clientAuthenticatorType\": \"client-jwt\",
    \"attributes\": {
      \"jwt.credential.certificate\": \"$CERT_B64\",
      \"token.endpoint.auth.signing.alg\": \"RS256\"
    }
  }"
echo "Created client '$CLIENT_ID' with JWT authentication."
echo "Keycloak setup complete."
