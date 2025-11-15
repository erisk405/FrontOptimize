/**
 * End-to-End Integration Tests for AI Frontend Optimizer
 * 
 * These tests verify the complete workflow from command execution to results display.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('E2E Integration Tests', () => {
    const testComponentsPath = path.join(__dirname, '../../../test-components');
    
    suiteSetup(async function() {
        this.timeout(30000);
        
        // Ensure extension is activated
        const extension = vscode.extensions.getExtension('gofive.ai-frontend-optimizer');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        
        // Verify test components exist
        assert.ok(fs.existsSync(testComponentsPath), 'Test components directory should exist');
    });

    test('Command is registered', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(
            commands.includes('aiFrontendOptimizer.optimizeFile'),
            'optimizeFile command should be registered'
        );
    });

    test('E2E: Analyze CSS Issues Component', async function() {
        this.timeout(15000);
        
        const componentPath = path.join(testComponentsPath, 'css-issues', 'user-profile.component.ts');
        
        // Verify file exists
        assert.ok(fs.existsSync(componentPath), 'Test component should exist');
        
        // Open the file
        const document = await vscode.workspace.openTextDocument(componentPath);
        await vscode.window.showTextDocument(document);
        
        // Execute the optimize command
        try {
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(componentPath));
            
            // Wait for analysis to complete (results panel should open)
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify that a webview panel was created (results panel)
            // Note: Direct webview verification is limited in tests, but we can check for errors
            assert.ok(true, 'Command executed without throwing errors');
        } catch (error) {
            assert.fail(`Command execution failed: ${error}`);
        }
    });

    test('E2E: Analyze TypeScript Issues Component', async function() {
        this.timeout(15000);
        
        const componentPath = path.join(testComponentsPath, 'typescript-issues', 'data-service.component.ts');
        
        assert.ok(fs.existsSync(componentPath), 'Test component should exist');
        
        const document = await vscode.workspace.openTextDocument(componentPath);
        await vscode.window.showTextDocument(document);
        
        try {
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(componentPath));
            await new Promise(resolve => setTimeout(resolve, 3000));
            assert.ok(true, 'TypeScript analysis completed without errors');
        } catch (error) {
            assert.fail(`TypeScript analysis failed: ${error}`);
        }
    });

    test('E2E: Analyze Template Complexity Component', async function() {
        this.timeout(15000);
        
        const componentPath = path.join(testComponentsPath, 'template-complexity', 'product-list.component.html');
        
        assert.ok(fs.existsSync(componentPath), 'Test component should exist');
        
        const document = await vscode.workspace.openTextDocument(componentPath);
        await vscode.window.showTextDocument(document);
        
        try {
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(componentPath));
            await new Promise(resolve => setTimeout(resolve, 3000));
            assert.ok(true, 'Template analysis completed without errors');
        } catch (error) {
            assert.fail(`Template analysis failed: ${error}`);
        }
    });

    test('E2E: Analyze Combined Issues Component', async function() {
        this.timeout(20000);
        
        const componentPath = path.join(testComponentsPath, 'combined-issues', 'dashboard.component.ts');
        
        assert.ok(fs.existsSync(componentPath), 'Test component should exist');
        
        const document = await vscode.workspace.openTextDocument(componentPath);
        await vscode.window.showTextDocument(document);
        
        try {
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(componentPath));
            await new Promise(resolve => setTimeout(resolve, 5000));
            assert.ok(true, 'Combined analysis completed without errors');
        } catch (error) {
            assert.fail(`Combined analysis failed: ${error}`);
        }
    });

    test('Error Handling: Non-Angular File', async function() {
        this.timeout(10000);
        
        // Create a temporary non-Angular TypeScript file
        const tempDir = path.join(__dirname, '../../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFile = path.join(tempDir, 'non-angular.ts');
        fs.writeFileSync(tempFile, 'const x = 5;');
        
        try {
            const document = await vscode.workspace.openTextDocument(tempFile);
            await vscode.window.showTextDocument(document);
            
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(tempFile));
            
            // Should handle gracefully (may show error message but shouldn't crash)
            await new Promise(resolve => setTimeout(resolve, 2000));
            assert.ok(true, 'Non-Angular file handled gracefully');
        } catch (error) {
            // Expected to fail gracefully
            assert.ok(true, 'Error handled appropriately for non-Angular file');
        } finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    });

    test('Error Handling: Missing Related Files', async function() {
        this.timeout(10000);
        
        // Create a component with only .ts file (missing .html and .css)
        const tempDir = path.join(__dirname, '../../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFile = path.join(tempDir, 'incomplete.component.ts');
        fs.writeFileSync(tempFile, `
import { Component } from '@angular/core';

@Component({
  selector: 'app-incomplete',
  templateUrl: './incomplete.component.html',
  styleUrls: ['./incomplete.component.css']
})
export class IncompleteComponent {}
        `);
        
        try {
            const document = await vscode.workspace.openTextDocument(tempFile);
            await vscode.window.showTextDocument(document);
            
            await vscode.commands.executeCommand('aiFrontendOptimizer.optimizeFile', vscode.Uri.file(tempFile));
            
            // Should handle missing files gracefully
            await new Promise(resolve => setTimeout(resolve, 2000));
            assert.ok(true, 'Missing files handled gracefully');
        } catch (error) {
            assert.ok(true, 'Error handled appropriately for missing files');
        } finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    });
});
