// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * ESLint configuration for CNMA VJ My Inbox project.
 * Uses the new flat config format (ESLint 9+).
 * 
 * Key rules:
 * - max-lines: 300 lines per file (warning at 250)
 * - max-lines-per-function: 100 lines per function
 * - @typescript-eslint for TypeScript best practices
 */
export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // Global ignores
        ignores: [
            'node_modules/**',
            'gen/**',
            'dist/**',
            'gen_backup/**',
            '@cds-models/**',
            'app/**',
            'test/**',
            '*.js',  // Skip JS files (configs, scripts)
            'mta_archives/**'
        ]
    },
    {
        files: ['srv/**/*.ts', 'db/**/*.ts'],
        rules: {
            // ============================================
            // File Size Rules (Prevent God Objects)
            // ============================================
            'max-lines': ['warn', {
                max: 300,
                skipBlankLines: true,
                skipComments: true
            }],
            'max-lines-per-function': ['warn', {
                max: 100,
                skipBlankLines: true,
                skipComments: true
            }],

            // ============================================
            // TypeScript Rules
            // ============================================
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-explicit-any': 'warn',  // Warn instead of error
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-require-imports': 'off',

            // ============================================
            // Code Quality Rules  
            // ============================================
            'no-console': 'off',  // Allow console (we use LOG instead)
            'complexity': ['warn', 15],  // Cyclomatic complexity
            'max-depth': ['warn', 4],    // Max nesting depth
            'max-params': ['warn', 5]    // Max function parameters
        }
    }
);
