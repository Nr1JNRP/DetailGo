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
  // Ratchet: o piso só sobe. Deixamos ~1 ponto de folga sobre a cobertura real
  // para o CI não quebrar por variação mínima — mas não mais que isso, senão
  // dá para remover teste sem ninguém notar.
  // Cobertura em 14/08/2026: 71.46 stmts · 63.08 branch · 72.74 func · 72.59 lines
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 62,
      functions: 71,
      lines: 71,
    },
  },
};
