const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  clearMocks: true,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/app/**/*.test.tsx', '<rootDir>/components/**/*.test.tsx'],
});
