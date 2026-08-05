/** Jest das Cloud Functions (Node, ts-jest). Roda com `npm test` na pasta. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
