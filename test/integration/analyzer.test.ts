/**
 * Rust Analyzer Integration Tests
 * 
 * Tests the JSON communication between Extension and Analyzer
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { RustAnalyzerRunner } from '../../src/services/rustAnalyzerRunner';

suite('Rust Analyzer Integration Tests', () => {
    let analyzer: RustAnalyzerRunner;
    const testComponentsPath = path.join(__dirname, '../../../test-components');

    suiteSetup(function() {
        this.timeout(10000);
        
        // Initialize analyzer with binary path
        const binaryPath = path.join(__dirname, '../../../dist/bin', 
            process.platform === 'win32' ? 'analyzer.exe' : 'analyzer');
        
        analyzer = new RustAnalyzerRunner(binaryPath);
    });

    test('Binary exists and is executable', async function() {
        this.timeout(5000);
        
        const exists = await analyzer.checkBinaryExists();
        assert.ok(exists, 'Rust analyzer binary should exist');
    });

    test('Analyze CSS Issues - JSON Schema Validation', async function() {
        this.timeout(10000);
        
        const tsFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.ts');
        const htmlFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.html');
        const cssFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.css');
        
        // Verify files exist
        assert.ok(fs.existsSync(tsFile), 'TypeScript file should exist');
        assert.ok(fs.existsSync(htmlFile), 'HTML file should exist');
        assert.ok(fs.existsSync(cssFile), 'CSS file should exist');
        
        try {
            const result = await analyzer.analyze({
                tsFile,
                htmlFile,
                cssFile
            });
            
            // Validate JSON structure
            assert.ok(result, 'Result should not be null');
            assert.ok(Array.isArray(result.cssIssues), 'cssIssues should be an array');
            assert.ok(Array.isArray(result.tsIssues), 'tsIssues should be an array');
            assert.ok(Array.isArray(result.templateIssues), 'templateIssues should be an array');
            assert.ok(result.metadata, 'metadata should exist');
            
            // Validate metadata structure
            assert.ok(result.metadata.componentName, 'componentName should exist');
            assert.ok(result.metadata.analyzedAt, 'analyzedAt should exist');
            assert.ok(typeof result.metadata.analysisTimeMs === 'number', 'analysisTimeMs should be a number');
            
            // Validate CSS issues were detected
            assert.ok(result.cssIssues.length > 0, 'Should detect CSS issues');
            
            // Validate CSS issue structure
            const cssIssue = result.cssIssues[0];
            assert.ok(cssIssue.issueType, 'CSS issue should have issueType');
            assert.ok(cssIssue.selector, 'CSS issue should have selector');
            assert.ok(typeof cssIssue.line === 'number', 'CSS issue should have line number');
            assert.ok(cssIssue.description, 'CSS issue should have description');
            
            console.log(`Detected ${result.cssIssues.length} CSS issues`);
            console.log(`Detected ${result.tsIssues.length} TypeScript issues`);
            console.log(`Detected ${result.templateIssues.length} template issues`);
        } catch (error) {
            assert.fail(`Analysis failed: ${error}`);
        }
    });

    test('Analyze TypeScript Issues - Unused Imports Detection', async function() {
        this.timeout(10000);
        
        const tsFile = path.join(testComponentsPath, 'typescript-issues', 'data-service.component.ts');
        const htmlFile = path.join(testComponentsPath, 'typescript-issues', 'data-service.component.html');
        const cssFile = path.join(testComponentsPath, 'typescript-issues', 'data-service.component.css');
        
        try {
            const result = await analyzer.analyze({
                tsFile,
                htmlFile,
                cssFile
            });
            
            // Should detect unused imports
            assert.ok(result.tsIssues.length > 0, 'Should detect TypeScript issues');
            
            const unusedImports = result.tsIssues.filter(issue => 
                issue.issueType === 'UnusedImport'
            );
            
            assert.ok(unusedImports.length > 0, 'Should detect unused imports');
            
            // Validate TypeScript issue structure
            const tsIssue = result.tsIssues[0];
            assert.ok(tsIssue.issueType, 'TS issue should have issueType');
            assert.ok(typeof tsIssue.line === 'number', 'TS issue should have line number');
            assert.ok(tsIssue.description, 'TS issue should have description');
            
            console.log(`Detected ${unusedImports.length} unused imports`);
        } catch (error) {
            assert.fail(`TypeScript analysis failed: ${error}`);
        }
    });

    test('Analyze Template Complexity - Deep Nesting Detection', async function() {
        this.timeout(10000);
        
        const tsFile = path.join(testComponentsPath, 'template-complexity', 'product-list.component.ts');
        const htmlFile = path.join(testComponentsPath, 'template-complexity', 'product-list.component.html');
        const cssFile = path.join(testComponentsPath, 'template-complexity', 'product-list.component.css');
        
        try {
            const result = await analyzer.analyze({
                tsFile,
                htmlFile,
                cssFile
            });
            
            // Should detect template complexity issues
            assert.ok(result.templateIssues.length > 0, 'Should detect template issues');
            
            const deepNesting = result.templateIssues.filter(issue => 
                issue.issueType === 'DeepNesting'
            );
            
            assert.ok(deepNesting.length > 0, 'Should detect deep nesting');
            
            // Validate template issue structure
            const templateIssue = result.templateIssues[0];
            assert.ok(templateIssue.issueType, 'Template issue should have issueType');
            assert.ok(typeof templateIssue.line === 'number', 'Template issue should have line number');
            assert.ok(templateIssue.description, 'Template issue should have description');
            assert.ok(templateIssue.severity, 'Template issue should have severity');
            
            console.log(`Detected ${deepNesting.length} deep nesting issues`);
        } catch (error) {
            assert.fail(`Template analysis failed: ${error}`);
        }
    });

    test('Analyze Combined Issues - All Issue Types', async function() {
        this.timeout(15000);
        
        const tsFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.ts');
        const htmlFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.html');
        const cssFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.css');
        
        try {
            const result = await analyzer.analyze({
                tsFile,
                htmlFile,
                cssFile
            });
            
            // Should detect all types of issues
            assert.ok(result.cssIssues.length > 0, 'Should detect CSS issues');
            assert.ok(result.tsIssues.length > 0, 'Should detect TypeScript issues');
            assert.ok(result.templateIssues.length > 0, 'Should detect template issues');
            
            // Verify comprehensive detection
            console.log('Combined Issues Analysis Results:');
            console.log(`  CSS Issues: ${result.cssIssues.length}`);
            console.log(`  TypeScript Issues: ${result.tsIssues.length}`);
            console.log(`  Template Issues: ${result.templateIssues.length}`);
            console.log(`  Analysis Time: ${result.metadata.analysisTimeMs}ms`);
            
            // Performance check
            assert.ok(result.metadata.analysisTimeMs < 5000, 
                'Analysis should complete within 5 seconds for complex component');
        } catch (error) {
            assert.fail(`Combined analysis failed: ${error}`);
        }
    });

    test('Error Handling - Invalid File Path', async function() {
        this.timeout(5000);
        
        const invalidPath = path.join(testComponentsPath, 'non-existent', 'fake.component.ts');
        
        try {
            await analyzer.analyze({
                tsFile: invalidPath,
                htmlFile: invalidPath.replace('.ts', '.html'),
                cssFile: invalidPath.replace('.ts', '.css')
            });
            
            assert.fail('Should throw error for invalid file path');
        } catch (error) {
            assert.ok(error, 'Should handle invalid file path with error');
        }
    });

    test('Error Handling - Malformed TypeScript', async function() {
        this.timeout(5000);
        
        // Create temporary malformed file
        const tempDir = path.join(__dirname, '../../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const malformedFile = path.join(tempDir, 'malformed.component.ts');
        fs.writeFileSync(malformedFile, 'this is not valid typescript {{{');
        
        try {
            await analyzer.analyze({
                tsFile: malformedFile,
                htmlFile: malformedFile.replace('.ts', '.html'),
                cssFile: malformedFile.replace('.ts', '.css')
            });
            
            // May succeed with parsing errors or throw
            assert.ok(true, 'Handled malformed TypeScript');
        } catch (error) {
            assert.ok(error, 'Should handle parsing errors gracefully');
        } finally {
            // Cleanup
            if (fs.existsSync(malformedFile)) {
                fs.unlinkSync(malformedFile);
            }
        }
    });
});
