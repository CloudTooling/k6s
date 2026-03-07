import { getBearerTokenWithClientAssertion } from './jwt';
import http from 'k6/http';
import { check, fail } from 'k6';

// At runtime jest replaces these with the jest.fn() implementations from __mocks__
const mockPost = http.post as unknown as jest.Mock;
const mockCheck = check as unknown as jest.Mock;
const mockFail = fail as unknown as jest.Mock;

// Minimal fake PEM – b64decode is mocked, so content does not matter
const FAKE_PEM = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEA',
  '-----END PRIVATE KEY-----',
].join('\n');

describe('getBearerTokenWithClientAssertion', () => {
  const TOKEN_URL = 'https://auth.example.com/token';
  const CLIENT_ID = 'my-client';
  const AUDIENCE = 'https://api.example.com';

  let mockCrypto: {
    subtle: { importKey: jest.Mock; sign: jest.Mock };
    randomUUID: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCrypto = {
      subtle: {
        importKey: jest.fn().mockResolvedValue({ type: 'private' }),
        sign: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
      randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
    };

    Object.defineProperty(globalThis, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });

    // Make fail() abort execution, mirroring k6 behaviour
    mockFail.mockImplementation((msg: string) => {
      throw new Error(msg);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setupSuccess(accessToken: string = 'access-token') {
    mockPost.mockReturnValue({ status: 200, json: jest.fn().mockReturnValue(accessToken) });
    mockCheck.mockReturnValue(true);
  }

  async function callAndGetFormParams(): Promise<URLSearchParams> {
    await getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE);
    const formBody = mockPost.mock.calls[0][1] as string;
    return new URLSearchParams(formBody);
  }

  // ── Return value ───────────────────────────────────────────────────────────

  describe('successful response', () => {
    it('returns the access_token from the response body', async () => {
      setupSuccess('my-bearer-token');
      const token = await getBearerTokenWithClientAssertion(
        TOKEN_URL,
        CLIENT_ID,
        FAKE_PEM,
        AUDIENCE,
      );
      expect(token).toBe('my-bearer-token');
    });
  });

  // ── HTTP request shape ─────────────────────────────────────────────────────

  describe('HTTP request', () => {
    beforeEach(() => setupSuccess());

    it('posts to the configured token endpoint URL', async () => {
      await getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE);
      expect(mockPost).toHaveBeenCalledWith(TOKEN_URL, expect.any(String), expect.any(Object));
    });

    it('sets Content-Type to application/x-www-form-urlencoded', async () => {
      await getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE);
      expect(mockPost).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      });
    });

    it('includes grant_type=client_credentials', async () => {
      const params = await callAndGetFormParams();
      expect(params.get('grant_type')).toBe('client_credentials');
    });

    it('includes the client_id', async () => {
      const params = await callAndGetFormParams();
      expect(params.get('client_id')).toBe(CLIENT_ID);
    });

    it('includes the JWT-bearer client_assertion_type', async () => {
      const params = await callAndGetFormParams();
      expect(params.get('client_assertion_type')).toBe(
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      );
    });

    it('includes a non-empty client_assertion', async () => {
      const params = await callAndGetFormParams();
      expect(params.get('client_assertion')).toBeTruthy();
    });
  });

  // ── JWT structure ──────────────────────────────────────────────────────────

  describe('client_assertion JWT', () => {
    beforeEach(() => setupSuccess());

    function decodeJwtPart(encoded: string): Record<string, unknown> {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    }

    async function getJwtParts(): Promise<[string, string, string]> {
      const params = await callAndGetFormParams();
      const parts = (params.get('client_assertion') as string).split('.');
      return parts as [string, string, string];
    }

    it('is a three-part dot-separated JWT', async () => {
      const [h, p, s] = await getJwtParts();
      expect(h).toBeTruthy();
      expect(p).toBeTruthy();
      expect(s).toBeTruthy();
    });

    it('has header { alg: "RS256", typ: "JWT" }', async () => {
      const [encodedHeader] = await getJwtParts();
      expect(decodeJwtPart(encodedHeader)).toEqual({ alg: 'RS256', typ: 'JWT' });
    });

    it('sets iss and sub to the client_id', async () => {
      const [, encodedPayload] = await getJwtParts();
      const payload = decodeJwtPart(encodedPayload);
      expect(payload.iss).toBe(CLIENT_ID);
      expect(payload.sub).toBe(CLIENT_ID);
    });

    it('sets aud to the audience parameter', async () => {
      const [, encodedPayload] = await getJwtParts();
      expect(decodeJwtPart(encodedPayload).aud).toBe(AUDIENCE);
    });

    it('sets jti from crypto.randomUUID()', async () => {
      mockCrypto.randomUUID.mockReturnValue('fixed-uuid-abc');
      const [, encodedPayload] = await getJwtParts();
      expect(decodeJwtPart(encodedPayload).jti).toBe('fixed-uuid-abc');
    });

    it('sets iat, nbf, and exp=iat+10 based on current time', async () => {
      const fixedNow = 1700000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow * 1000);

      const [, encodedPayload] = await getJwtParts();
      const payload = decodeJwtPart(encodedPayload);

      expect(payload.iat).toBe(fixedNow);
      expect(payload.nbf).toBe(fixedNow);
      expect(payload.exp).toBe(fixedNow + 10);
    });
  });

  // ── Crypto calls ───────────────────────────────────────────────────────────

  describe('JWT signing', () => {
    beforeEach(() => setupSuccess());

    it('imports the private key as pkcs8 with RSASSA-PKCS1-v1_5 / SHA-256', async () => {
      await getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(Object),
        { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        false,
        ['sign'],
      );
    });

    it('signs the header.payload string with RSASSA-PKCS1-v1_5', async () => {
      await getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        { name: 'RSASSA-PKCS1-v1_5' },
        expect.any(Object),
        expect.any(Uint8Array),
      );
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('calls fail() when the token endpoint returns a non-200 status', async () => {
      mockPost.mockReturnValue({ status: 401, json: jest.fn() });
      mockCheck.mockReturnValue(false);

      await expect(
        getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE),
      ).rejects.toThrow();

      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('OAuth error'));
    });

    it('calls fail() when the response contains no access_token', async () => {
      mockPost.mockReturnValue({ status: 200, json: jest.fn().mockReturnValue(null) });
      mockCheck.mockReturnValue(true);

      await expect(
        getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE),
      ).rejects.toThrow();

      expect(mockFail).toHaveBeenCalledWith('OAuth response did not contain access_token');
    });

    it('throws "JWT signing failed" when crypto.subtle.importKey rejects', async () => {
      mockCrypto.subtle.importKey.mockRejectedValue(new Error('bad key'));

      await expect(
        getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE),
      ).rejects.toThrow('JWT signing failed');
    });

    it('throws "JWT signing failed" when crypto.subtle.sign rejects', async () => {
      mockCrypto.subtle.sign.mockRejectedValue(new Error('sign error'));

      await expect(
        getBearerTokenWithClientAssertion(TOKEN_URL, CLIENT_ID, FAKE_PEM, AUDIENCE),
      ).rejects.toThrow('JWT signing failed');
    });
  });
});
