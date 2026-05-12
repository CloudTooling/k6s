import { getBearerTokenWithClientAssertion } from '/scripts/jwt.js';
import { check } from 'k6';

const KC_URL = __ENV.KC_URL || 'http://keycloak:8080';
const KC_REALM = __ENV.KC_REALM || 'e2e';
const CLIENT_ID = __ENV.CLIENT_ID || 'k6s-test-client';

// Loaded in init context — file must be present in the mounted tests directory
const privateKeyPem = open('private_key.pem');

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    checks: ['rate==1.0'],
  },
};

export default async function () {
  const tokenUrl = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;
  const audience = `${KC_URL}/realms/${KC_REALM}`;

  const token = await getBearerTokenWithClientAssertion(tokenUrl, CLIENT_ID, privateKeyPem, audience);

  check(token, {
    'token received': (t) => !!t,
    'token is a string': (t) => typeof t === 'string',
    'token is non-empty': (t) => t.length > 0,
  });
}
