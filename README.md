[![Build](https://github.com/CloudTooling/k6s/actions/workflows/build.yml/badge.svg)](https://github.com/CloudTooling/k6s/actions/workflows/build.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/cloudtooling/k6s)](https://hub.docker.com/r/cloudtooling/k6s)

Some extensions for k6, also include [junit](https://github.com/Mattihew/k6-to-junit)-extension from Mattihew.

# Usage

```yaml
...
  image:
    name: docker.io/cloudtooling/k6s:0.2.0 
    entrypoint: ['']
  stage: test
  script:
    - k6 ...
...
```

```javascript
import {getBearerTokenWithClientAssertion} from '/scripts/jwt.js';
import {fail} from 'k6';

const kcUrl = '<KEYCLOAK_URL>';
const kcRealm = '<KEYCLOAK_REALM>';
const clientId = '<CLIENT_ID>';

const privateKeyPem = __ENV.<CLIENT_SECRET_KEY>;
if (!privateKeyPem) {
    fail('Missing environment variable SECRET_KEY_OMS_TEST_SA');
}

export async function getBearerTokenIntension() {
    const url = `https://${kcUrl}/auth/realms/${kcRealm}/protocol/openid-connect/token`;
    const aud = `https://${kcUrl}/auth/realms/${kcRealm}`;
    const token = getBearerTokenWithClientAssertion(url, clientId, privateKeyPem, aud)
    return token;
}

```
