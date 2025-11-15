/**
 * Platform-Specific Binary Tests
 * 
 * Tests that the Rust analyzer binary executes correctly on each platform
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

suite('Platform-Specific Binary Tests', () => {
    const binaryName = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
    const binaryPath = path.join(__dirname, '../../dist/bin', binaryName);

    test('Binary exists for current platform', () => {
        assert.ok(
            fs.existsSync(binaryPath),
            `Binary should exist at ${binaryPath} for platform ${process.platform}`
        );
    });

    test('Binary has correct permissions (Unix)', function() {
        if (process.platform === 'win32') {
            this.skip(); // Skip on Windows
            return;
        }

        const stats = fs.statSync(binaryPath);
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
        
        assert.ok(isExecutable, 'Binary should be executable on Unix platforms');
    });

    test('Binary file size is reasonable', () => {
        const stats = fs.statSync(binaryPath);
        const sizeInMB = stats.size / (1024 * 1024);
        
        assert.ok(sizeInMB > 0.5, 'Binary should be larger than 0.5MB');
        assert.ok(sizeInMB < 50, 'Binary should be smaller than 50MB');
        
        console.log(`Binary size: ${sizeInMB.toFixed(2)}MB`);
    });

    test('Binary executes without crashing', async function() {
        this.timeout(10000);
        
        try {
            // Try to execute binary with invalid args to test it runs
            // (it should fail gracefully, not crash)
            await execAsync(`"${binaryPath}"`);
        } catch (error: any) {
            // Expected to fail with usage error, not crash
            assert.ok(
                error.code !== undefined,
                'Binary should exit with error code, not crash'
            );
        }
    });

    test('Platform detection is correct', () => {
        const expectedPlatforms = ['win32', 'darwin', 'linux'];
        assert.ok(
            expectedPlatforms.includes(process.platform),
            `Platform ${process.platform} should be one of: ${expectedPlatforms.join(', ')}`
        );
    });

    test('Architecture is supported', () => {
        const supportedArchs = ['x64', 'arm64'];
        assert.ok(
            supportedArchs.includes(process.arch),
            `Architecture ${process.arch} should be one of: ${supportedArchs.join(', ')}`
        );
        
        console.log(`Running on ${process.platform} ${process.arch}`);
    });
});
