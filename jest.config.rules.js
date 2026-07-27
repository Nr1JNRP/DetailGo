// Config isolada para os testes das firestore.rules. Roda em ambiente Node
// (sem o preset react-native) e sobe contra o emulador do Firestore, disparado
// por `firebase emulators:exec` no script `test:rules`.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-tests/**/*.test.js'],
  testTimeout: 20000,
};
