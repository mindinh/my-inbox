import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts', 'test/performance/**/*.test.ts'],
        exclude: ['node_modules', 'gen', 'dist'],
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['srv/lib/**/*.ts'],
            exclude: ['node_modules']
        }
    },
    resolve: {
        alias: {
            '@': '/srv'
        }
    }
});
