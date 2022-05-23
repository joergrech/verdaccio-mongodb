module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  verbose: true,
  collectCoverage: true,
  coveragePathIgnorePatterns: ['node_modules'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.env'],
};
