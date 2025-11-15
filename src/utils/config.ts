import * as vscode from 'vscode';

/**
 * Configuration interface for AI Frontend Optimizer settings
 */
export interface OptimizerConfig {
    aiProvider: 'openai' | 'internal';
    model: string;
    maxNestingDepth: number;
    enableAutoAnalysis: boolean;
    analyzerTimeout: number;
    skipBinaryVerification: boolean;
    verboseLogging: boolean;
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
    verboseLogging: false
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
        allowedValues: ['openai', 'internal'],
        message: 'AI provider must be either "openai" or "internal"'
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
            verboseLogging: config.get<boolean>('verboseLogging', DEFAULT_CONFIG.verboseLogging)
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
    private static getValidatedProvider(config: vscode.WorkspaceConfiguration): 'openai' | 'internal' {
        const provider = config.get<string>('aiProvider', DEFAULT_CONFIG.aiProvider);
        
        if (provider !== 'openai' && provider !== 'internal') {
            vscode.window.showWarningMessage(
                `Invalid AI provider "${provider}". Using default: ${DEFAULT_CONFIG.aiProvider}`
            );
            return DEFAULT_CONFIG.aiProvider;
        }
        
        return provider;
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

        return errors;
    }
}
