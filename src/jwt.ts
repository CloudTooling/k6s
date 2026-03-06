import 'k6/crypto';
import { b64decode, b64encode } from 'k6/encoding';
import http from 'k6/http';
import { check, fail } from 'k6';

export async function getBearerTokenWithClientAssertion(
  url: string,
  clientId: string,
  privateKeyPem: string,
  audience: string,
) {
  const clientAssertion = await getSignedJwtRS256(
    clientId,
    privateKeyPem,
    audience,
  );

  const bodyDetails = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_assertion_type:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  } as any;

  const formBody = Object.keys(bodyDetails)
    .map(
      (key) =>
        encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]),
    )
    .join('&');

  const headers = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  };

  const response = http.post(url, formBody, headers);

  const ok = check(response, {
    'token endpoint status is 200': (r: any) => r.status === 200,
  });

  if (!ok) {
    fail('OAuth error: ' + JSON.stringify(response));
  }

  const accessToken = response.json('access_token');
  if (!accessToken) {
    fail('OAuth response did not contain access_token');
  }

  return accessToken;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalizedPem = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  return (b64decode(
    normalizedPem,
    'std',
    'a' as any,
  ) as unknown) as ArrayBuffer;
}

function asciiToUint8Array(str: string) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

async function importPrivateKey(privateKeyPem: string) {
  return await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem) as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  );
}

async function getSignedJwtRS256(
  clientId: string,
  privateKeyPem: string,
  aud: string,
) {
  try {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: clientId,
      sub: clientId,
      aud: aud,
      jti: crypto.randomUUID(),
      iat: now,
      nbf: now,
      exp: now + 10,
    };

    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = b64encode(JSON.stringify(header), 'rawurl');
    const encodedPayload = b64encode(JSON.stringify(payload), 'rawurl');
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signingBytes = asciiToUint8Array(signingInput);
    const privateKey = await importPrivateKey(privateKeyPem);

    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      signingBytes,
    );
    const encodedSignature = b64encode(
      (new Uint8Array(signature).buffer as unknown) as ArrayBuffer,
      'rawurl',
    );
    return `${signingInput}.${encodedSignature}`;
  } catch (err) {
    console.error('JWT signing error:', err);
    throw new Error('JWT signing failed');
  }
}
