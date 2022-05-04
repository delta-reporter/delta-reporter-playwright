module.exports = {
  roots: ['<rootDir>/src'],
  transform: { '.(ts|tsx)': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '/__tests__/.*\\.(test|spec)?\\.(ts|js)$',
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/__tests__/', 'index.ts', 'src/types'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  globals: {
    'ts-jest': {
      diagnostics: {
        pathRegex: '(/__tests__/.*?\\.(test|spec))\\.(ts|js)$',
      },
    },
  },
};
