module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-firebase)/)',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  testPathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/worktrees'],
};
