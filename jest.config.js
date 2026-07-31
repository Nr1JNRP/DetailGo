module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-firebase|@testing-library)/)',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  testPathIgnorePatterns: ['<rootDir>/.claude/worktrees', '<rootDir>/firestore-tests'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  // Cobertura do projeto inteiro (exclui specs, tipos e barrels).
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'html'],
  // Ratchet: o CI falha se a cobertura regredir abaixo do piso atual. Só sobe —
  // ao adicionar testes, suba os números. Garante que nunca perdemos cobertura.
  coverageThreshold: {
    global: {
      statements: 13,
      branches: 9,
      functions: 12,
      lines: 13,
    },
  },
};
