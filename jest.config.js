module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/srv'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    collectCoverageFrom: [
        'srv/lib/**/*.ts',
        '!srv/lib/**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    verbose: true,
};
