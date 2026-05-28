/** @type {import('jest').Config} */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', 'dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^k6/encoding$': '<rootDir>/src/__mocks__/k6/encoding.ts',
    '^k6/http$': '<rootDir>/src/__mocks__/k6/http.ts',
    '^k6/crypto$': '<rootDir>/src/__mocks__/k6/crypto.ts',
    '^k6$': '<rootDir>/src/__mocks__/k6.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
