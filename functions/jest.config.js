/** Jest das Cloud Functions — isolado do jest do app (roda em Node, via ts-jest). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
};
