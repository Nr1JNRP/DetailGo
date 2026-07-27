module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-firebase|@testing-library)/)',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  testPathIgnorePatterns: ['<rootDir>/.claude/worktrees', '<rootDir>/firestore-tests'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  // Cobertura — comece focada na feature que estamos testando.
  collectCoverageFrom: [
    'src/features/auth/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'html'],
};
