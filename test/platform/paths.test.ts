/**
 * Platform-Specific Path Handling Tests
 * 
 * Tests that file paths are handled correctly across platforms
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Platform-Specific Path Tests', () => {
    test('Path separators handled correctly', () => {
        const testPath = path.join('test-components', 'css-issues', 'user-profile.component.ts');
        
        if (process.platform === 'win32') {
            assert.ok(testPath.includes('\\'), 'Windows should use backslash separator');
        } else {
            assert.ok(testPath.includes('/'), 'Unix should use forward slash separator');
        }
        
        console.log(`Platform: ${process.platform}, Path: ${testPath}`);
    });

    test('Absolute paths resolved correctly', () => {
        const relativePath = path.join('test-components', 'css-issues', 'user-profile.component.ts');
        const absolutePath = path.resolve(__dirname, '../../', relativePath);
        
        assert.ok(path.isAbsolute(absolutePath), 'Should be absolute path');
        assert.ok(absolutePath.length > relativePath.length, 'Absolute path should be longer');
        
        console.log(`Relative: ${relativePath}`);
        console.log(`Absolute: ${absolutePath}`);
    });

    test('Path normalization works across platforms', () => {
        // Test with mixed separators
        const mixedPath = 'test-components/css-issues\\user-profile.component.ts';
        const normalized = path.normalize(mixedPath);
        
        // Should use platform-specific separator
        if (process.platform === 'win32') {
            assert.ok(!normalized.includes('/'), 'Normalized Windows path should not contain forward slashes');
        } else {
            assert.ok(!normalized.includes('\\'), 'Normalized Unix path should not contain backslashes');
        }
    });

    test('File URIs handled correctly', () => {
        const filePath = path.join(__dirname, 'test.ts');
        const fileUri = `file://${filePath.replace(/\\/g, '/')}`;
        
        assert.ok(fileUri.startsWith('file://'), 'Should be valid file URI');
        
        console.log(`File URI: ${fileUri}`);
    });

    test('Test components directory exists', () => {
        const testComponentsPath = path.join(__dirname, '../../test-components');
        
        assert.ok(
            fs.existsSync(testComponentsPath),
            `Test components directory should exist at ${testComponentsPath}`
        );
    });

    test('Test component files accessible', () => {
        const componentPath = path.join(
            __dirname,
            '../../test-components/css-issues/user-profile.component.ts'
        );
        
        assert.ok(
            fs.existsSync(componentPath),
            `Test component should be accessible at ${componentPath}`
        );
        
        // Verify we can read the file
        const content = fs.readFileSync(componentPath, 'utf-8');
        assert.ok(content.length > 0, 'Should be able to read file content');
    });

    test('Binary path resolution works', () => {
        const binaryName = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
        const binaryPath = path.join(__dirname, '../../dist/bin', binaryName);
        
        assert.ok(path.isAbsolute(binaryPath), 'Binary path should be absolute');
        assert.ok(binaryPath.includes('dist'), 'Binary path should include dist directory');
        assert.ok(binaryPath.includes('bin'), 'Binary path should include bin directory');
        
        console.log(`Binary path: ${binaryPath}`);
    });

    test('Relative path conversion', () => {
        const absolutePath = path.join(__dirname, '../../test-components/css-issues/user-profile.component.ts');
        const workspaceRoot = path.join(__dirname, '../../');
        const relativePath = path.relative(workspaceRoot, absolutePath);
        
        assert.ok(!path.isAbsolute(relativePath), 'Should be relative path');
        assert.ok(relativePath.includes('test-components'), 'Should contain test-components');
        
        console.log(`Relative path: ${relativePath}`);
    });

    test('Path extension extraction', () => {
        const tsFile = 'user-profile.component.ts';
        const htmlFile = 'user-profile.component.html';
        const cssFile = 'user-profile.component.css';
        
        assert.equal(path.extname(tsFile), '.ts', 'Should extract .ts extension');
        assert.equal(path.extname(htmlFile), '.html', 'Should extract .html extension');
        assert.equal(path.extname(cssFile), '.css', 'Should extract .css extension');
    });

    test('Path basename extraction', () => {
        const filePath = path.join('test-components', 'css-issues', 'user-profile.component.ts');
        const basename = path.basename(filePath);
        const basenameNoExt = path.basename(filePath, '.ts');
        
        assert.equal(basename, 'user-profile.component.ts', 'Should extract full basename');
        assert.equal(basenameNoExt, 'user-profile.component', 'Should extract basename without extension');
    });

    test('Path dirname extraction', () => {
        const filePath = path.join('test-components', 'css-issues', 'user-profile.component.ts');
        const dirname = path.dirname(filePath);
        
        assert.ok(dirname.includes('test-components'), 'Dirname should include test-components');
        assert.ok(dirname.includes('css-issues'), 'Dirname should include css-issues');
    });
});
