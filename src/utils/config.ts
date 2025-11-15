import * as vscode from 'vscode';

/**
 * Configuration interface for AI Frontend Optimizer settings
 */
export interface OptimizerConfig {
    aiProvider: 'openai' | 'anthropic' | 'internal';
    model: string;
    maxNestingDepth: number;
    enableAutoAnalysis: boolean;
    analyzerTimeout: number;
    skipBinaryVerification: boolean;
    verboseLogging: boolean;
    baseStyleFiles: string[];
    componentMappingYaml: string;
    similarityThreshold: number;
    enableSimilarityScanning: boolean;
    enableComponentSuggestions: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: OptimizerConfig = {
    aiProvider: 'openai',
    model: 'gpt-4',
    maxNestingDepth: 2,
    enableAutoAnalysis: false,
    analyzerTimeout: 30,
    skipBinaryVerification: false,
    verboseLogging: false,
    baseStyleFiles: [],
    componentMappingYaml: '',
    similarityThreshold: 80,
    enableSimilarityScanning: true,
    enableComponentSuggestions: true
};

/**
 * Configuration validation rules
 */
const VALIDATION_RULES = {
    maxNestingDepth: {
        min: 1,
        max: 10,
        message: 'Max nesting depth must be between 1 and 10'
    },
    analyzerTimeout: {
        min: 5,
        max: 300,
        message: 'Analyzer timeout must be between 5 and 300 seconds'
    },
    aiProvider: {
        allowedValues: ['openai', 'anthropic', 'internal'],
        message: 'AI provider must be either "openai", "anthropic", or "internal"'
    },
    similarityThreshold: {
        min: 0,
        max: 100,
        message: 'Similarity threshold must be between 0 and 100'
    }
};

/**
 * Centralized configuration manager for AI Frontend Optimizer
 * Provides type-safe access to settings with validation and defaults
 */
export class ConfigurationManager {
    private static readonly CONFIG_SECTION = 'aiFrontendOptimizer';

    /**
     * Gets the complete configuration with defaults applied
     */
    static getConfig(): OptimizerConfig {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        
        return {
            aiProvider: this.getValidatedProvider(config),
            model: config.get<string>('model', DEFAULT_CONFIG.model),
            maxNestingDepth: this.getValidatedNestingDepth(config),
            enableAutoAnalysis: config.get<boolean>('enableAutoAnalysis', DEFAULT_CONFIG.enableAutoAnalysis),
            analyzerTimeout: this.getValidatedTimeout(config),
            skipBinaryVerification: config.get<boolean>('skipBinaryVerification', DEFAULT_CONFIG.skipBinaryVerification),
            verboseLogging: config.get<boolean>('verboseLogging', DEFAULT_CONFIG.verboseLogging),
            baseStyleFiles: config.get<string[]>('baseStyleFiles', DEFAULT_CONFIG.baseStyleFiles),
            componentMappingYaml: config.get<string>('componentMappingYaml', DEFAULT_CONFIG.componentMappingYaml),
            similarityThreshold: this.getValidatedSimilarityThreshold(config),
            enableSimilarityScanning: config.get<boolean>('enableSimilarityScanning', DEFAULT_CONFIG.enableSimilarityScanning),
            enableComponentSuggestions: config.get<boolean>('enableComponentSuggestions', DEFAULT_CONFIG.enableComponentSuggestions)
        };
    }

    /**
     * Gets a specific configuration value with type safety
     */
    static get<K extends keyof OptimizerConfig>(key: K): OptimizerConfig[K] {
        const config = this.getConfig();
        return config[key];
    }

    /**
     * Updates a configuration value
     * @param key Configuration key to update
     * @param value New value
     * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
     */
    static async set<K extends keyof OptimizerConfig>(
        key: K,
        value: OptimizerConfig[K],
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        // Validate the value before setting
        this.validateConfigValue(key, value);
        
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update(key, value, target);
    }

    /**
     * Validates a configuration value
     */
    private static validateConfigValue<K extends keyof OptimizerConfig>(
        key: K,
        value: OptimizerConfig[K]
    ): void {
        switch (key) {
            case 'maxNestingDepth':
                this.validateNumber(
                    value as number,
                    VALIDATION_RULES.maxNestingDepth.min,
                    VALIDATION_RULES.maxNestingDepth.max,
                    VALIDATION_RULES.maxNestingDepth.message
                );
                break;
            case 'analyzerTimeout':
                this.validateNumber(
                    value as number,
                    VALIDATION_RULES.analyzerTimeout.min,
                    VALIDATION_RULES.analyzerTimeout.max,
                    VALIDATION_RULES.analyzerTimeout.message
                );
                break;
            case 'aiProvider':
                if (!VALIDATION_RULES.aiProvider.allowedValues.includes(value as string)) {
                    throw new Error(VALIDATION_RULES.aiProvider.message);
                }
                break;
        }
    }

    /**
     * Validates a number is within range
     */
    private static validateNumber(value: number, min: number, max: number, message: string): void {
        if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
            throw new Error(message);
        }
    }

    /**
     * Gets and validates the AI provider setting
     */
    private static getValidatedProvider(config: vscode.WorkspaceConfiguration): 'openai' | 'anthropic' | 'internal' {
        const provider = config.get<string>('aiProvider', DEFAULT_CONFIG.aiProvider);
        
        if (provider !== 'openai' && provider !== 'anthropic' && provider !== 'internal') {
            vscode.window.showWarningMessage(
                `Invalid AI provider "${provider}". Using default: ${DEFAULT_CONFIG.aiProvider}`
            );
            return DEFAULT_CONFIG.aiProvider;
        }
        
        return provider as 'openai' | 'anthropic' | 'internal';
    }

    /**
     * Gets and validates the max nesting depth setting
     */
    private static getValidatedNestingDepth(config: vscode.WorkspaceConfiguration): number {
        const depth = config.get<number>('maxNestingDepth', DEFAULT_CONFIG.maxNestingDepth);
        const { min, max } = VALIDATION_RULES.maxNestingDepth;
        
        if (typeof depth !== 'number' || isNaN(depth) || depth < min || depth > max) {
            vscode.window.showWarningMessage(
                `Invalid max nesting depth "${depth}". Using default: ${DEFAULT_CONFIG.maxNestingDepth}`
            );
            return DEFAULT_CONFIG.maxNestingDepth;
        }
        
        return depth;
    }

    /**
     * Gets and validates the analyzer timeout setting
     */
    private static getValidatedTimeout(config: vscode.WorkspaceConfiguration): number {
        const timeout = config.get<number>('analyzerTimeout', DEFAULT_CONFIG.analyzerTimeout);
        const { min, max } = VALIDATION_RULES.analyzerTimeout;
        
        if (typeof timeout !== 'number' || isNaN(timeout) || timeout < min || timeout > max) {
            vscode.window.showWarningMessage(
                `Invalid analyzer timeout "${timeout}". Using default: ${DEFAULT_CONFIG.analyzerTimeout}`
            );
            return DEFAULT_CONFIG.analyzerTimeout;
        }
        
        return timeout;
    }

    /**
     * Gets and validates the similarity threshold setting
     */
    private static getValidatedSimilarityThreshold(config: vscode.WorkspaceConfiguration): number {
        const threshold = config.get<number>('similarityThreshold', DEFAULT_CONFIG.similarityThreshold);
        const { min, max } = VALIDATION_RULES.similarityThreshold;
        
        if (typeof threshold !== 'number' || isNaN(threshold) || threshold < min || threshold > max) {
            vscode.window.showWarningMessage(
                `Invalid similarity threshold "${threshold}". Using default: ${DEFAULT_CONFIG.similarityThreshold}`
            );
            return DEFAULT_CONFIG.similarityThreshold;
        }
        
        return threshold;
    }

    /**
     * Resets all configuration to defaults
     */
    static async resetToDefaults(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        
        for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof OptimizerConfig>) {
            await config.update(key, DEFAULT_CONFIG[key], target);
        }
    }

    /**
     * Gets the default configuration
     */
    static getDefaults(): OptimizerConfig {
        return { ...DEFAULT_CONFIG };
    }

    /**
     * Checks if a configuration value is at its default
     */
    static isDefault<K extends keyof OptimizerConfig>(key: K): boolean {
        const currentValue = this.get(key);
        const defaultValue = DEFAULT_CONFIG[key];
        return currentValue === defaultValue;
    }

    /**
     * Registers a configuration change listener
     * @param callback Function to call when configuration changes
     * @returns Disposable to unregister the listener
     */
    static onConfigurationChanged(
        callback: (config: OptimizerConfig) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(this.CONFIG_SECTION)) {
                callback(this.getConfig());
            }
        });
    }

    /**
     * Validates the entire configuration and returns any errors
     */
    static validateConfiguration(): string[] {
        const errors: string[] = [];
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);

        // Validate max nesting depth
        const depth = config.get<number>('maxNestingDepth');
        if (depth !== undefined) {
            const { min, max } = VALIDATION_RULES.maxNestingDepth;
            if (typeof depth !== 'number' || isNaN(depth) || depth < min || depth > max) {
                errors.push(VALIDATION_RULES.maxNestingDepth.message);
            }
        }

        // Validate analyzer timeout
        const timeout = config.get<number>('analyzerTimeout');
        if (timeout !== undefined) {
            const { min, max } = VALIDATION_RULES.analyzerTimeout;
            if (typeof timeout !== 'number' || isNaN(timeout) || timeout < min || timeout > max) {
                errors.push(VALIDATION_RULES.analyzerTimeout.message);
            }
        }

        // Validate AI provider
        const provider = config.get<string>('aiProvider');
        if (provider !== undefined && !VALIDATION_RULES.aiProvider.allowedValues.includes(provider)) {
            errors.push(VALIDATION_RULES.aiProvider.message);
        }

        // Validate similarity threshold
        const threshold = config.get<number>('similarityThreshold');
        if (threshold !== undefined) {
            const { min, max } = VALIDATION_RULES.similarityThreshold;
            if (typeof threshold !== 'number' || isNaN(threshold) || threshold < min || threshold > max) {
                errors.push(VALIDATION_RULES.similarityThreshold.message);
            }
        }

        return errors;
    }

    /**
     * Validates base style file paths exist
     * @returns Array of validation errors
     */
    static async validateBaseStyleFiles(): Promise<string[]> {
        const errors: string[] = [];
        const baseStyleFiles = this.get('baseStyleFiles');
        const fs = require('fs').promises;
        const path = require('path');

        if (!baseStyleFiles || baseStyleFiles.length === 0) {
            return errors; // Empty array is valid
        }

        for (const filePath of baseStyleFiles) {
            if (!filePath || filePath.trim() === '') {
                errors.push('Base style files array contains empty path');
                continue;
            }

            // Resolve relative paths from workspace root
            let absolutePath = filePath;
            if (!path.isAbsolute(filePath)) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
                }
            }

            try {
                await fs.access(absolutePath);
                
                // Validate file extension
                const ext = path.extname(absolutePath).toLowerCase();
                if (!['.css', '.scss', '.sass', '.less'].includes(ext)) {
                    errors.push(`Base style file "${filePath}" has invalid extension. Expected .css, .scss, .sass, or .less`);
                }
            } catch (error) {
                errors.push(`Base style file not found: ${filePath}`);
            }
        }

        return errors;
    }

    /**
     * Validates component mapping YAML file path and content
     * @returns Array of validation errors
     */
    static async validateComponentMappingYaml(): Promise<string[]> {
        const errors: string[] = [];
        const yamlPath = this.get('componentMappingYaml');
        
        if (!yamlPath || yamlPath.trim() === '') {
            return errors; // Empty path is valid (feature disabled)
        }

        const fs = require('fs').promises;
        const path = require('path');

        // Resolve relative paths from workspace root
        let absolutePath = yamlPath;
        if (!path.isAbsolute(yamlPath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                absolutePath = path.join(workspaceFolders[0].uri.fsPath, yamlPath);
            }
        }

        try {
            await fs.access(absolutePath);
            
            // Validate file extension
            const ext = path.extname(absolutePath).toLowerCase();
            if (!['.yaml', '.yml'].includes(ext)) {
                errors.push(`Component mapping file "${yamlPath}" has invalid extension. Expected .yaml or .yml`);
                return errors;
            }

            // Try to read and parse YAML content
            try {
                const content = await fs.readFile(absolutePath, 'utf8');
                
                // Basic YAML validation - check if it's not empty and has basic structure
                if (!content || content.trim() === '') {
                    errors.push(`Component mapping file "${yamlPath}" is empty`);
                    return errors;
                }

                // Check for basic YAML structure (components key)
                if (!content.includes('components:')) {
                    errors.push(`Component mapping file "${yamlPath}" is missing required "components:" key`);
                }
            } catch (readError) {
                errors.push(`Failed to read component mapping file "${yamlPath}": ${readError}`);
            }
        } catch (error) {
            errors.push(`Component mapping file not found: ${yamlPath}`);
        }

        return errors;
    }

    /**
     * Validates all file-based configuration options
     * Shows warning messages for any validation errors
     * @returns True if all validations pass, false otherwise
     */
    static async validateFileConfiguration(): Promise<boolean> {
        const baseStyleErrors = await this.validateBaseStyleFiles();
        const yamlErrors = await this.validateComponentMappingYaml();
        
        const allErrors = [...baseStyleErrors, ...yamlErrors];
        
        if (allErrors.length > 0) {
            const errorMessage = allErrors.join('\n');
            vscode.window.showWarningMessage(
                `AI Frontend Optimizer Configuration Issues:\n${errorMessage}`,
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'aiFrontendOptimizer');
                }
            });
            return false;
        }
        
        return true;
    }

    /**
     * Gets base style files with validation
     * Returns only files that exist and are valid
     */
    static async getValidBaseStyleFiles(): Promise<string[]> {
        const baseStyleFiles = this.get('baseStyleFiles');
        if (!baseStyleFiles || baseStyleFiles.length === 0) {
            return [];
        }

        const fs = require('fs').promises;
        const path = require('path');
        const validFiles: string[] = [];

        for (const filePath of baseStyleFiles) {
            if (!filePath || filePath.trim() === '') {
                continue;
            }

            // Resolve relative paths from workspace root
            let absolutePath = filePath;
            if (!path.isAbsolute(filePath)) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
                }
            }

            try {
                await fs.access(absolutePath);
                validFiles.push(absolutePath);
            } catch (error) {
                // Skip invalid files silently
            }
        }

        return validFiles;
    }

    /**
     * Gets component mapping YAML path with validation
     * Returns null if path is invalid or file doesn't exist
     */
    static async getValidComponentMappingYaml(): Promise<string | null> {
        const yamlPath = this.get('componentMappingYaml');
        
        if (!yamlPath || yamlPath.trim() === '') {
            return null;
        }

        const fs = require('fs').promises;
        const path = require('path');

        // Resolve relative paths from workspace root
        let absolutePath = yamlPath;
        if (!path.isAbsolute(yamlPath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                absolutePath = path.join(workspaceFolders[0].uri.fsPath, yamlPath);
            }
        }

        try {
            await fs.access(absolutePath);
            return absolutePath;
        } catch (error) {
            return null;
        }
    }
}
