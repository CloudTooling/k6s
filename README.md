[![Build](https://github.com/CloudTooling/k6s/actions/workflows/build.yml/badge.svg)](https://github.com/CloudTooling/k6s/actions/workflows/build.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/cloudtooling/k6s)](https://hub.docker.com/r/cloudtooling/k6s)

Some extensions for k6, also include [junit](https://github.com/Mattihew/k6-to-junit)-extension from Mattihew.

# Usage

```yaml
...
  image:
    name: cloudtooling/k6s
    entrypoint: ['']
  stage: test
  script:
    - k6 ...
...
```

```js
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
    const token = await getBearerTokenWithClientAssertion(url, clientId, privateKeyPem, aud)
    return token;
}

```

When running in docker, e.g. locally you can also mount reports back:

```bash
docker run "${args[@]}" -it -v $(pwd)/reports:/home/k6/reports -v $(pwd)/tests:/home/k6/tests cloudtooling/k6s run tests/main.js

```

When `tests/main.js` looks like this:

```js
import {htmlReport} from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {textSummary} from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
...

// see https://k6.io/docs/using-k6/k6-options/reference/
export const options = {

    // requiring 100% success
    thresholds: {
        checks: ['rate==1.0'],
    },

    insecureSkipTLSVerify: true,
    throw: true,
...
}
....

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '→', enableColors: true }),
    "reports/summary_a.html": htmlReport(data),
    'reports/summary_a.json': JSON.stringify(data), // and a JSON with all the details...
  };
}
```
