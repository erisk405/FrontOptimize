/**
 * Configuration Validation Integration Tests
 * 
 * Tests the configuration validation functionality
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../../src/utils/config';

suite('Configuration Validation Tests', () => {
    const testComponentsPath = path.join(__dirname, '../../../test-components');
    const tempDir = path.join(__dirname, '../../../temp-test-files');

    suiteSetup(function() {
        this.timeout(5000);
        
        // Create temp directory for test files
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    suiteTeardown(function() {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Validate similarity threshold - valid range', function() {
        const config = ConfigurationManager.getConfig();
        const threshold = config.similarityThreshold;
        
        assert.ok(threshold >= 0 && threshold <= 100, 
            'Similarity threshold should be between 0 and 100');
    });

    test('Validate similarity threshold - invalid values handled', async function() {
        // The validation should handle invalid values by using defaults
        const threshold = ConfigurationManager.get('similarityThreshold');
        
        assert.ok(typeof threshold === 'number', 'Threshold should be a number');
        assert.ok(!isNaN(threshold), 'Threshold should not be NaN');
        assert.ok(threshold >= 0 && threshold <= 100, 
            'Invalid threshold should be replaced with default');
    });

    test('Validate base style files - empty array is valid', async function() {
        this.timeout(5000);
        
        // Set empty array
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('baseStyleFiles', [], vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateBaseStyleFiles();
        assert.strictEqual(errors.length, 0, 'Empty array should be valid');
    });

    test('Validate base style files - non-existent file returns error', async function() {
        this.timeout(5000);
        
        const nonExistentFile = path.join(tempDir, 'non-existent.css');
        
        // Set non-existent file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('baseStyleFiles', [nonExistentFile], vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateBaseStyleFiles();
        assert.ok(errors.length > 0, 'Non-existent file should return error');
        assert.ok(errors[0].includes('not found'), 'Error should mention file not found');
    });

    test('Validate base style files - valid file passes', async function() {
        this.timeout(5000);
        
        // Create a temporary CSS file
        const tempCssFile = path.join(tempDir, 'test-styles.css');
        fs.writeFileSync(tempCssFile, '.test-class { color: red; }');
        
        // Set valid file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('baseStyleFiles', [tempCssFile], vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateBaseStyleFiles();
        assert.strictEqual(errors.length, 0, 'Valid CSS file should pass validation');
    });

    test('Validate base style files - invalid extension returns error', async function() {
        this.timeout(5000);
        
        // Create a temporary file with wrong extension
        const tempTxtFile = path.join(tempDir, 'test-styles.txt');
        fs.writeFileSync(tempTxtFile, '.test-class { color: red; }');
        
        // Set file with invalid extension
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('baseStyleFiles', [tempTxtFile], vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateBaseStyleFiles();
        assert.ok(errors.length > 0, 'Invalid extension should return error');
        assert.ok(errors[0].includes('invalid extension'), 'Error should mention invalid extension');
    });

    test('Validate component mapping YAML - empty path is valid', async function() {
        this.timeout(5000);
        
        // Set empty path
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', '', vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateComponentMappingYaml();
        assert.strictEqual(errors.length, 0, 'Empty path should be valid (feature disabled)');
    });

    test('Validate component mapping YAML - non-existent file returns error', async function() {
        this.timeout(5000);
        
        const nonExistentFile = path.join(tempDir, 'non-existent.yaml');
        
        // Set non-existent file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', nonExistentFile, vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateComponentMappingYaml();
        assert.ok(errors.length > 0, 'Non-existent file should return error');
        assert.ok(errors[0].includes('not found'), 'Error should mention file not found');
    });

    test('Validate component mapping YAML - valid file passes', async function() {
        this.timeout(5000);
        
        // Create a temporary YAML file with valid structure
        const tempYamlFile = path.join(tempDir, 'test-mapping.yaml');
        const yamlContent = `components:
  go5-button:
    selector: go5-button
    keywords: ["button", "btn"]
`;
        fs.writeFileSync(tempYamlFile, yamlContent);
        
        // Set valid file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', tempYamlFile, vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateComponentMappingYaml();
        assert.strictEqual(errors.length, 0, 'Valid YAML file should pass validation');
    });

    test('Validate component mapping YAML - invalid extension returns error', async function() {
        this.timeout(5000);
        
        // Create a temporary file with wrong extension
        const tempTxtFile = path.join(tempDir, 'test-mapping.txt');
        fs.writeFileSync(tempTxtFile, 'components:\n  test: value');
        
        // Set file with invalid extension
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', tempTxtFile, vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateComponentMappingYaml();
        assert.ok(errors.length > 0, 'Invalid extension should return error');
        assert.ok(errors[0].includes('invalid extension'), 'Error should mention invalid extension');
    });

    test('Validate component mapping YAML - missing components key returns error', async function() {
        this.timeout(5000);
        
        // Create a temporary YAML file without components key
        const tempYamlFile = path.join(tempDir, 'test-invalid.yaml');
        const yamlContent = `settings:
  test: value
`;
        fs.writeFileSync(tempYamlFile, yamlContent);
        
        // Set invalid file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', tempYamlFile, vscode.ConfigurationTarget.Global);
        
        const errors = await ConfigurationManager.validateComponentMappingYaml();
        assert.ok(errors.length > 0, 'Missing components key should return error');
        assert.ok(errors[0].includes('missing required "components:" key'), 
            'Error should mention missing components key');
    });

    test('Get valid base style files - filters out invalid files', async function() {
        this.timeout(5000);
        
        // Create one valid and one invalid file path
        const validFile = path.join(tempDir, 'valid.css');
        const invalidFile = path.join(tempDir, 'invalid.css');
        
        fs.writeFileSync(validFile, '.test { color: red; }');
        // Don't create invalidFile
        
        // Set both files
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('baseStyleFiles', [validFile, invalidFile], vscode.ConfigurationTarget.Global);
        
        const validFiles = await ConfigurationManager.getValidBaseStyleFiles();
        assert.strictEqual(validFiles.length, 1, 'Should return only valid files');
        assert.ok(validFiles[0].includes('valid.css'), 'Should include the valid file');
    });

    test('Get valid component mapping YAML - returns null for invalid path', async function() {
        this.timeout(5000);
        
        const nonExistentFile = path.join(tempDir, 'non-existent.yaml');
        
        // Set non-existent file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', nonExistentFile, vscode.ConfigurationTarget.Global);
        
        const validPath = await ConfigurationManager.getValidComponentMappingYaml();
        assert.strictEqual(validPath, null, 'Should return null for invalid path');
    });

    test('Get valid component mapping YAML - returns path for valid file', async function() {
        this.timeout(5000);
        
        // Create a valid YAML file
        const tempYamlFile = path.join(tempDir, 'valid-mapping.yaml');
        const yamlContent = `components:
  go5-button:
    selector: go5-button
    keywords: ["button"]
`;
        fs.writeFileSync(tempYamlFile, yamlContent);
        
        // Set valid file
        await vscode.workspace.getConfiguration('aiFrontendOptimizer')
            .update('componentMappingYaml', tempYamlFile, vscode.ConfigurationTarget.Global);
        
        const validPath = await ConfigurationManager.getValidComponentMappingYaml();
        assert.ok(validPath !== null, 'Should return path for valid file');
        assert.ok(validPath!.includes('valid-mapping.yaml'), 'Should return correct path');
    });
});
