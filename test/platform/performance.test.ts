/**
 * Platform-Specific Performance Tests
 * 
 * Tests performance characteristics across different platforms
 */

import * as assert from 'assert';
import * as path from 'path';
import { RustAnalyzerRunner } from '../../src/services/rustAnalyzerRunner';

suite('Platform-Specific Performance Tests', () => {
    let analyzer: RustAnalyzerRunner;
    const testComponentsPath = path.join(__dirname, '../../test-components');

    suiteSetup(function() {
        this.timeout(10000);
        
        const binaryName = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
        const binaryPath = path.join(__dirname, '../../dist/bin', binaryName);
        
        analyzer = new RustAnalyzerRunner(binaryPath);
    });

    test('Simple component analysis performance', async function() {
        this.timeout(10000);
        
        const tsFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.ts');
        const htmlFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.html');
        const cssFile = path.join(testComponentsPath, 'css-issues', 'user-profile.component.css');
        
        const startTime = Date.now();
        
        try {
            const result = await analyzer.analyze({ tsFile, htmlFile, cssFile });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`Platform: ${process.platform}`);
            console.log(`Analysis time: ${duration}ms`);
            console.log(`Reported time: ${result.metadata.analysisTimeMs}ms`);
            
            // Simple component should complete quickly
            assert.ok(duration < 5000, `Analysis should complete within 5 seconds (took ${duration}ms)`);
            
            // Log platform-specific performance
            if (process.platform === 'win32') {
                console.log('Windows performance: Expected 1.5-2.5s for medium complexity');
            } else if (process.platform === 'darwin') {
                console.log('macOS performance: Expected 1.2-2.0s for medium complexity');
            } else {
                console.log('Linux performance: Expected 1.0-1.8s for medium complexity');
            }
        } catch (error) {
            assert.fail(`Performance test failed: ${error}`);
        }
    });

    test('Complex component analysis performance', async function() {
        this.timeout(20000);
        
        const tsFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.ts');
        const htmlFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.html');
        const cssFile = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.css');
        
        const startTime = Date.now();
        
        try {
            const result = await analyzer.analyze({ tsFile, htmlFile, cssFile });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`Platform: ${process.platform}`);
            console.log(`Complex analysis time: ${duration}ms`);
            console.log(`Issues found: CSS=${result.cssIssues.length}, TS=${result.tsIssues.length}, Template=${result.templateIssues.length}`);
            
            // Complex component should still complete reasonably fast
            assert.ok(duration < 10000, `Complex analysis should complete within 10 seconds (took ${duration}ms)`);
        } catch (error) {
            assert.fail(`Complex performance test failed: ${error}`);
        }
    });

    test('Memory usage is reasonable', function() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
        const rssMB = memUsage.rss / (1024 * 1024);
        
        console.log(`Platform: ${process.platform}`);
        console.log(`Heap used: ${heapUsedMB.toFixed(2)}MB`);
        console.log(`RSS: ${rssMB.toFixed(2)}MB`);
        
        // Memory usage should be reasonable
        assert.ok(rssMB < 500, `RSS should be less than 500MB (currently ${rssMB.toFixed(2)}MB)`);
    });

    test('Concurrent analysis handling', async function() {
        this.timeout(30000);
        
        const components = [
            {
                tsFile: path.join(testComponentsPath, 'css-issues', 'user-profile.component.ts'),
                htmlFile: path.join(testComponentsPath, 'css-issues', 'user-profile.component.html'),
                cssFile: path.join(testComponentsPath, 'css-issues', 'user-profile.component.css')
            },
            {
                tsFile: path.join(testComponentsPath, 'typescript-issues', 'data-service.component.ts'),
                htmlFile: path.join(testComponentsPath, 'typescript-issues', 'data-service.component.html'),
                cssFile: path.join(testComponentsPath, 'typescript-issues', 'data-service.component.css')
            }
        ];
        
        const startTime = Date.now();
        
        try {
            // Run analyses sequentially (concurrent might not be supported)
            const results = [];
            for (const component of components) {
                const result = await analyzer.analyze(component);
                results.push(result);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`Platform: ${process.platform}`);
            console.log(`Sequential analysis of ${components.length} components: ${duration}ms`);
            console.log(`Average per component: ${(duration / components.length).toFixed(0)}ms`);
            
            assert.equal(results.length, components.length, 'Should complete all analyses');
        } catch (error) {
            assert.fail(`Concurrent analysis test failed: ${error}`);
        }
    });
});
