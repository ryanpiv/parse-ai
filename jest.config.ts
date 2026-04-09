import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'es2017',
        module: 'commonjs',
        moduleResolution: 'node10',
        jsx: 'react-jsx',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        rootDir: '.',
        ignoreDeprecations: '6.0',
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default config
