module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.jsx',
    '**/?(*.)+(spec|test).js',
    '**/?(*.)+(spec|test).jsx',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'src/**/*.jsx',
    '!src/main.jsx',
    '!src/**/index.js',
    '!src/**/*.test.js',
    '!src/**/*.test.jsx',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%',
};
