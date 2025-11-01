/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 45,
      lines: 45,
      statements: 45,
    },
  },
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '^@actual-app/api$': '<rootDir>/tests/mocks/actual-api.js',
    '^dotenv$': '<rootDir>/tests/mocks/dotenv.js',
  },
};
