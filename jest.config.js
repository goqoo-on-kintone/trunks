/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        // tsconfigのisolatedModulesが有効だとts-jestは型検査を行わない。
        // テストで型の誤りを検出するため、テスト実行時のみ無効化する。
        tsconfig: { isolatedModules: false },
      },
    ],
  },
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/cli.ts'],
};
