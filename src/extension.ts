import * as vscode from 'vscode';
import { optimizeFile, optimizeFileWithSimilarity, optimizeFolder, optimizeSelection } from './commands/optimizeCommand';
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

    // Register the optimize with similarity command
    const optimizeWithSimilarityCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.optimizeFileWithSimilarity',
        async (uri: vscode.Uri) => {
            const operationId = `optimize-similarity-${Date.now()}`;
            logger.logOperationStart('optimizeFileWithSimilarity', { operationId, uri: uri?.fsPath });
            const stopTimer = logger.startTimer(operationId);

            try {
                // Get the URI from the active editor if not provided
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                
                if (!targetUri) {
                    logger.warn('No file selected for optimization with similarity');
                    vscode.window.showErrorMessage('No file selected for optimization');
                    return;
                }

                logger.debug('Executing optimize with similarity command', { file: targetUri.fsPath });

                // Execute the optimize with similarity command
                await optimizeFileWithSimilarity(targetUri, context);

                stopTimer();
                logger.logOperationComplete('optimizeFileWithSimilarity', undefined, { operationId });
            } catch (error) {
                stopTimer();
                logger.logOperationFailure('optimizeFileWithSimilarity', error, { operationId });
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
            }
        }
    );

    // Register the compare base styles command
    const compareBaseStylesCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.compareBaseStyles',
        async () => {
            const operationId = `compare-base-styles-${Date.now()}`;
            logger.logOperationStart('compareBaseStyles', { operationId });
            const stopTimer = logger.startTimer(operationId);

            try {
                logger.debug('Executing compare base styles command');

                // Show file picker for selecting multiple CSS/SCSS files
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        'Style Files': ['css', 'scss', 'sass']
                    },
                    title: 'Select Base Style Files to Compare (minimum 2 files)'
                });

                if (!fileUris || fileUris.length < 2) {
                    logger.warn('User cancelled or selected insufficient files for comparison');
                    vscode.window.showWarningMessage('Please select at least 2 files to compare');
                    return;
                }

                const filePaths = fileUris.map(uri => uri.fsPath);
                logger.info('User selected files for comparison', { files: filePaths });

                // Get similarity threshold from configuration
                const similarityThreshold = ConfigurationManager.get('similarityThreshold') as number;

                // Show progress
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Comparing Base Styles',
                        cancellable: true
                    },
                    async (progress, token) => {
                        progress.report({ message: 'Loading and parsing files...' });

                        // Execute comparison
                        const result = await rustAnalyzer.compareBaseStyles(
                            filePaths,
                            similarityThreshold,
                            30,
                            token
                        );

                        progress.report({ message: 'Displaying results...' });

                        // Import and show results panel
                        const { ResultsPanel } = await import('./panels/resultsPanel');
                        const panel = ResultsPanel.createOrShow(context.extensionUri);
                        
                        // Display comparison results
                        panel.updateBaseStyleComparison(result);

                        logger.info('Base style comparison completed', {
                            duplicates: result.baseStyleComparison.duplicates.length,
                            similarClasses: result.baseStyleComparison.similarClasses.length
                        });
                    }
                );

                stopTimer();
                logger.logOperationComplete('compareBaseStyles', undefined, { operationId });
            } catch (error) {
                stopTimer();
                logger.logOperationFailure('compareBaseStyles', error, { operationId });
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
            }
        }
    );

    // Register the optimize folder command
    const optimizeFolderCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.optimizeFolder',
        async (uri: vscode.Uri) => {
            const operationId = `optimize-folder-${Date.now()}`;
            logger.logOperationStart('optimizeFolder', { operationId, uri: uri?.fsPath });
            const stopTimer = logger.startTimer(operationId);

            try {
                if (!uri) {
                    logger.warn('No folder selected for optimization');
                    vscode.window.showErrorMessage('No folder selected for optimization');
                    return;
                }

                logger.debug('Executing optimize folder command', { folder: uri.fsPath });

                // Execute the optimize folder command
                await optimizeFolder(uri, context);

                stopTimer();
                logger.logOperationComplete('optimizeFolder', undefined, { operationId });
            } catch (error) {
                stopTimer();
                logger.logOperationFailure('optimizeFolder', error, { operationId });
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
            }
        }
    );

    // Register the optimize selection command
    const optimizeSelectionCommand = vscode.commands.registerCommand(
        'aiFrontendOptimizer.optimizeSelection',
        async () => {
            const operationId = `optimize-selection-${Date.now()}`;
            logger.logOperationStart('optimizeSelection', { operationId });
            const stopTimer = logger.startTimer(operationId);

            try {
                logger.debug('Executing optimize selection command');

                // Execute the optimize selection command
                await optimizeSelection(context);

                stopTimer();
                logger.logOperationComplete('optimizeSelection', undefined, { operationId });
            } catch (error) {
                stopTimer();
                logger.logOperationFailure('optimizeSelection', error, { operationId });
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
            }
        }
    );

    context.subscriptions.push(optimizeCommand);
    context.subscriptions.push(optimizeWithSimilarityCommand);
    context.subscriptions.push(compareBaseStylesCommand);
    context.subscriptions.push(optimizeFolderCommand);
    context.subscriptions.push(optimizeSelectionCommand);
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
