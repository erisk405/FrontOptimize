import * as vscode from 'vscode';
import { optimizeFile } from './commands/optimizeCommand';
import { verifyBinary, shouldSkipVerification, showSetupWizard } from './utils/binaryVerification';
import { RustAnalyzerRunner } from './services/rustAnalyzerRunner';
import { getLogger } from './utils/logger';
import { ConfigurationManager } from './utils/config';
import { AIService } from './services/aiService';

export async function activate(context: vscode.ExtensionContext) {
    const logger = getLogger();
    logger.info('AI Frontend Optimizer extension is activating...');

    // Validate configuration on activation
    logger.debug('Validating configuration');
    const configErrors = ConfigurationManager.validateConfiguration();
    if (configErrors.length > 0) {
        logger.warn('Configuration validation errors found', { errors: configErrors });
        vscode.window.showWarningMessage(
            `AI Frontend Optimizer: Configuration issues detected: ${configErrors.join(', ')}`
        );
    }

    // Listen for configuration changes
    const configListener = ConfigurationManager.onConfigurationChanged((config) => {
        logger.info('Configuration changed', config);
        logger.updateLogLevel();
        
        // Validate new configuration
        const errors = ConfigurationManager.validateConfiguration();
        if (errors.length > 0) {
            logger.warn('Configuration validation errors after change', { errors });
            vscode.window.showWarningMessage(
                `AI Frontend Optimizer: Configuration issues: ${errors.join(', ')}`
            );
        }
    });
    context.subscriptions.push(configListener);

    // Verify binary on activation
    logger.debug('Starting binary verification');
    const rustAnalyzer = new RustAnalyzerRunner(context);
    const binaryPath = rustAnalyzer.getBinaryPath();
    const skipVerification = shouldSkipVerification();

    logger.debug('Binary path', { path: binaryPath, skipVerification });

    const verificationResult = await verifyBinary(binaryPath, skipVerification);

    if (!verificationResult.exists || !verificationResult.valid) {
        logger.error('Binary verification failed', verificationResult.error);
        
        // Show setup wizard for first-time users
        const retry = await showSetupWizard(context.extensionPath);
        
        if (retry) {
            logger.info('User requested retry of binary verification');
            // Re-verify after user action
            const retryResult = await verifyBinary(binaryPath, skipVerification);
            if (!retryResult.exists || !retryResult.valid) {
                logger.error('Binary verification failed after retry', retryResult.error);
                vscode.window.showErrorMessage(
                    'AI Frontend Optimizer: Binary verification still failed. Extension functionality will be limited.'
                );
            } else {
                logger.info('Binary verified successfully after retry');
                vscode.window.showInformationMessage('AI Frontend Optimizer: Binary verified successfully!');
            }
        }
    } else {
        logger.info('Binary verified successfully');
        if (verificationResult.error) {
            logger.debug('Verification note', verificationResult.error);
        }
    }

    // Register the optimize command
    const optimizeCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.optimizeFile',
        async (uri: vscode.Uri) => {
            const operationId = `optimize-${Date.now()}`;
            logger.logOperationStart('optimizeFile', { operationId, uri: uri?.fsPath });
            const stopTimer = logger.startTimer(operationId);

            try {
                // Get the URI from the active editor if not provided
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                
                if (!targetUri) {
                    logger.warn('No file selected for optimization');
                    vscode.window.showErrorMessage('No file selected for optimization');
                    return;
                }

                logger.debug('Executing optimize command', { file: targetUri.fsPath });

                // Execute the optimize command
                await optimizeFile(targetUri, context);

                stopTimer();
                logger.logOperationComplete('optimizeFile', undefined, { operationId });
            } catch (error) {
                stopTimer();
                logger.logOperationFailure('optimizeFile', error, { operationId });
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
            }
        }
    );

    // Register command to show output channel
    const showLogsCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.showLogs',
        () => {
            logger.show();
        }
    );

    // Register command to configure API key
    const configureApiKeyCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.configureApiKey',
        async () => {
            logger.info('User requested API key configuration');
            const aiService = new AIService(context);
            const success = await aiService.promptForApiKey();
            
            if (success) {
                logger.info('API key configured successfully');
                vscode.window.showInformationMessage('AI Frontend Optimizer: API key configured successfully!');
            } else {
                logger.info('API key configuration cancelled');
                vscode.window.showInformationMessage('API key configuration cancelled');
            }
        }
    );

    // Register command to reset configuration to defaults
    const resetConfigCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.resetConfiguration',
        async () => {
            logger.info('User requested configuration reset');
            const confirm = await vscode.window.showWarningMessage(
                'Reset all AI Frontend Optimizer settings to defaults?',
                { modal: true },
                'Reset',
                'Cancel'
            );
            
            if (confirm === 'Reset') {
                try {
                    await ConfigurationManager.resetToDefaults();
                    logger.info('Configuration reset to defaults');
                    vscode.window.showInformationMessage('AI Frontend Optimizer: Configuration reset to defaults');
                } catch (error) {
                    logger.error('Failed to reset configuration', error);
                    vscode.window.showErrorMessage('Failed to reset configuration');
                }
            }
        }
    );

    context.subscriptions.push(optimizeCommand);
    context.subscriptions.push(showLogsCommand);
    context.subscriptions.push(configureApiKeyCommand);
    context.subscriptions.push(resetConfigCommand);
    context.subscriptions.push(logger);

    logger.info('AI Frontend Optimizer extension activated successfully');
}

export function deactivate() {
    const logger = getLogger();
    logger.info('AI Frontend Optimizer extension is deactivating...');
    logger.dispose();
}
