import * as vscode from 'vscode';
import * as fs from 'fs';
import { resolveComponentFiles, findComponentsInFolder } from '../utils/fileResolver';
import { RustAnalyzerRunner } from '../services/rustAnalyzerRunner';
import { AIService } from '../services/aiService';
import { ResultsPanel } from '../panels/resultsPanel';
import { getLogger } from '../utils/logger';
import { ConfigurationManager } from '../utils/config';

/**
 * Command handler for "AI Optimize with Similarity Analysis"
 * Prompts user to select base style files and performs similarity comparison
 */
export async function optimizeFileWithSimilarity(
    uri: vscode.Uri,
    context: vscode.ExtensionContext
): Promise<void> {
    const logger = getLogger();
    logger.info('Starting file optimization with similarity analysis', { file: uri.fsPath });

    // Prompt user to select base style files
    const baseStyleFiles = await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Style Files': ['css', 'scss', 'sass', 'less']
        },
        title: 'Select Base Style Files for Comparison'
    });

    if (!baseStyleFiles || baseStyleFiles.length === 0) {
        logger.info('User cancelled base style file selection');
        vscode.window.showInformationMessage('Similarity analysis cancelled - no base style files selected');
        return;
    }

    const baseStylePaths = baseStyleFiles.map(file => file.fsPath);
    logger.info('Base style files selected', { count: baseStylePaths.length, files: baseStylePaths });

    // Store selected base style files in workspace configuration for future use
    const config = vscode.workspace.getConfiguration('aiFrontendOptimizer');
    await config.update('baseStyleFiles', baseStylePaths, vscode.ConfigurationTarget.Workspace);

    // Proceed with normal optimization but include base style files
    await optimizeFileInternal(uri, context, baseStylePaths);
}

/**
 * Main command handler for "AI Optimize this file"
 * Orchestrates the optimization workflow for Angular component files
 */
export async function optimizeFile(
    uri: vscode.Uri,
    context: vscode.ExtensionContext
): Promise<void> {
    // Check if user has configured default base style files
    const config = vscode.workspace.getConfiguration('aiFrontendOptimizer');
    const configuredBaseStyles = config.get<string[]>('baseStyleFiles');
    const baseStyleFiles = configuredBaseStyles && configuredBaseStyles.length > 0 ? configuredBaseStyles : undefined;
    
    await optimizeFileInternal(uri, context, baseStyleFiles);
}

/**
 * Internal optimization function that handles the actual analysis
 */
async function optimizeFileInternal(
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    baseStyleFiles?: string[]
): Promise<void> {
    const logger = getLogger();
    logger.info('Starting file optimization', { file: uri.fsPath });

    // Validate file-based configuration before starting analysis
    logger.debug('Validating file-based configuration');
    const configValid = await ConfigurationManager.validateFileConfiguration();
    if (!configValid) {
        logger.warn('Configuration validation failed, but continuing with analysis');
        // Don't block analysis, just warn the user
    }

    // Show progress indicator
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AI Frontend Optimizer',
            cancellable: true
        },
        async (progress, token) => {
            try {
                progress.report({ message: 'Resolving component files...' });
                logger.debug('Resolving component files');

                // Resolve all related component files
                const resolveResult = await resolveComponentFiles(uri);

                if (!resolveResult) {
                    logger.warn('File is not part of an Angular component', { file: uri.fsPath });
                    vscode.window.showErrorMessage(
                        'Selected file is not part of an Angular component'
                    );
                    return;
                }

                const { files: componentFiles, warnings } = resolveResult;
                logger.info('Component files resolved', { 
                    typescript: componentFiles.typescript,
                    html: componentFiles.html,
                    css: componentFiles.css,
                    warningCount: warnings.length
                });

                // Display warnings for missing or inaccessible files
                if (warnings.length > 0) {
                    logger.warn('File resolution warnings', { warnings });
                    for (const warning of warnings) {
                        vscode.window.showWarningMessage(`AI Frontend Optimizer: ${warning}`);
                    }
                }

                // Check for cancellation
                if (token.isCancellationRequested) {
                    logger.info('Analysis cancelled before starting Rust analyzer');
                    return;
                }

                // Initialize Rust analyzer runner
                logger.debug('Initializing Rust analyzer');
                const rustAnalyzer = new RustAnalyzerRunner(context);

                // Get timeout from configuration
                const timeout = ConfigurationManager.get('analyzerTimeout');
                
                // Get validated component mapping YAML from configuration
                const validatedComponentMappingYaml = await ConfigurationManager.getValidComponentMappingYaml();
                const hasComponentMapping = validatedComponentMappingYaml !== null;
                
                // Get validated base style files if not provided
                let validatedBaseStyleFiles = baseStyleFiles;
                if (!validatedBaseStyleFiles) {
                    validatedBaseStyleFiles = await ConfigurationManager.getValidBaseStyleFiles();
                }
                
                logger.debug('Analyzer configuration', { 
                    timeout, 
                    hasComponentMapping,
                    componentMappingYaml: hasComponentMapping ? validatedComponentMappingYaml : 'not configured',
                    baseStyleFilesCount: validatedBaseStyleFiles?.length || 0
                });

                // Execute Rust analyzer with progress reporting and cancellation support
                logger.info('Starting Rust analysis', { 
                    hasBaseStyles: !!validatedBaseStyleFiles && validatedBaseStyleFiles.length > 0,
                    baseStyleCount: validatedBaseStyleFiles?.length || 0,
                    hasComponentMapping
                });
                const analysisStartTime = Date.now();
                const analysisResult = await rustAnalyzer.analyze(
                    componentFiles, 
                    timeout,
                    token,
                    (message: string) => progress.report({ message }),
                    validatedBaseStyleFiles && validatedBaseStyleFiles.length > 0 ? validatedBaseStyleFiles : undefined,
                    hasComponentMapping ? validatedComponentMappingYaml! : undefined
                );
                const analysisDuration = Date.now() - analysisStartTime;
                logger.info('Rust analysis completed', { 
                    duration: analysisDuration,
                    cssIssues: analysisResult.cssIssues.length,
                    tsIssues: analysisResult.tsIssues.length,
                    templateIssues: analysisResult.templateIssues.length,
                    similarityResults: analysisResult.similarityResults?.length || 0
                });

                // Check for cancellation
                if (token.isCancellationRequested) {
                    logger.info('Analysis cancelled after Rust analyzer');
                    vscode.window.showInformationMessage('Analysis cancelled by user');
                    return;
                }

                // Initialize AI service
                logger.debug('Initializing AI service');
                const aiService = new AIService(context);
                
                // Initialize the AI provider
                try {
                    await aiService.initializeProvider();
                    logger.debug('AI provider initialized successfully');
                } catch (error) {
                    logger.error('Failed to initialize AI provider', error);
                }

                // Check if AI is configured
                const isAIConfigured = await aiService.isConfigured();
                logger.info('AI service configuration status', { configured: isAIConfigured });
                
                let recommendations;
                if (isAIConfigured) {
                    try {
                        // Read code snippets for context with error handling
                        logger.debug('Reading code snippets for AI context');
                        const codeSnippets = new Map<string, string>();
                        
                        try {
                            codeSnippets.set('typescript', fs.readFileSync(componentFiles.typescript, 'utf-8'));
                            logger.debug('TypeScript file read successfully');
                        } catch (error) {
                            logger.error('Failed to read TypeScript file', error);
                            throw new Error(`Failed to read TypeScript file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                        
                        if (componentFiles.html) {
                            try {
                                codeSnippets.set('html', fs.readFileSync(componentFiles.html, 'utf-8'));
                                logger.debug('HTML file read successfully');
                            } catch (error) {
                                logger.warn('Failed to read HTML file', error);
                                vscode.window.showWarningMessage(`Failed to read HTML file, continuing without it: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        }
                        
                        if (componentFiles.css) {
                            try {
                                codeSnippets.set('css', fs.readFileSync(componentFiles.css, 'utf-8'));
                                logger.debug('CSS file read successfully');
                            } catch (error) {
                                logger.warn('Failed to read CSS file', error);
                                vscode.window.showWarningMessage(`Failed to read CSS file, continuing without it: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        }

                        // Generate AI recommendations with progress reporting and cancellation support
                        logger.info('Generating AI recommendations');
                        const aiStartTime = Date.now();
                        recommendations = await aiService.generateRecommendations(
                            analysisResult, 
                            codeSnippets,
                            token,
                            (message: string) => progress.report({ message })
                        );
                        const aiDuration = Date.now() - aiStartTime;
                        logger.info('AI recommendations generated', { 
                            duration: aiDuration,
                            recommendationCount: recommendations.length
                        });
                    } catch (error) {
                        // Check if it was a cancellation
                        if (error instanceof Error && error.message.includes('cancelled')) {
                            logger.info('Analysis cancelled during AI processing');
                            vscode.window.showInformationMessage('Analysis cancelled by user');
                            return;
                        }
                        
                        logger.error('AI service error, falling back to basic recommendations', error);
                        // Fall back to recommendations without AI
                        recommendations = await aiService.generateRecommendationsWithoutAI(analysisResult);
                        vscode.window.showWarningMessage('AI service unavailable. Showing basic analysis results.');
                    }
                } else {
                    // Use fallback recommendations without AI
                    logger.info('Using fallback recommendations (AI not configured)');
                    recommendations = await aiService.generateRecommendationsWithoutAI(analysisResult);
                    
                    // Optionally prompt user to configure AI
                    const configure = await vscode.window.showInformationMessage(
                        'AI recommendations are not configured. Would you like to set up your API key?',
                        'Configure',
                        'Not Now'
                    );
                    
                    if (configure === 'Configure') {
                        logger.info('User chose to configure AI');
                        await aiService.promptForApiKey();
                    }
                }

                // Check for cancellation
                if (token.isCancellationRequested) {
                    logger.info('Analysis cancelled before displaying results');
                    return;
                }

                // Display results in panel
                logger.debug('Creating results panel');
                const resultsPanel = ResultsPanel.createOrShow(context.extensionUri);
                resultsPanel.updateResults(recommendations, analysisResult.metadata, analysisResult.similarityResults, analysisResult.componentSuggestions);

                // Show success message
                const totalIssues = recommendations.length;
                const similarityCount = analysisResult.similarityResults?.length || 0;
                const componentSuggestionCount = analysisResult.componentSuggestions?.length || 0;
                logger.info('Analysis completed successfully', { 
                    totalRecommendations: totalIssues,
                    similarityResults: similarityCount,
                    componentSuggestions: componentSuggestionCount,
                    componentName: analysisResult.metadata.componentName
                });
                
                let message = `Analysis complete! Found ${totalIssues} recommendations`;
                if (similarityCount > 0) {
                    message += `, ${similarityCount} similar classes`;
                }
                if (componentSuggestionCount > 0) {
                    message += `, ${componentSuggestionCount} component suggestions`;
                }
                message += '.';
                
                vscode.window.showInformationMessage(message);

            } catch (error) {
                // Check if it was a cancellation
                if (error instanceof Error && error.message.includes('cancelled')) {
                    logger.info('Analysis cancelled by user');
                    vscode.window.showInformationMessage('Analysis cancelled by user');
                    return;
                }
                
                logger.error('Analysis failed with error', error);
                // Re-throw other errors to be handled by VSCode
                throw error;
            }
        }
    );
}

/**
 * Command handler for "AI Optimize this folder"
 * Recursively finds Angular components in a folder and allows user to select which to analyze
 */
export async function optimizeFolder(
    folderUri: vscode.Uri,
    context: vscode.ExtensionContext
): Promise<void> {
    const logger = getLogger();
    logger.info('Starting folder optimization', { folder: folderUri.fsPath });

    try {
        // Show progress while searching for components
        const componentUris = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for Angular components...',
                cancellable: false
            },
            async () => {
                return await findComponentsInFolder(folderUri);
            }
        );

        if (componentUris.length === 0) {
            logger.warn('No Angular components found in folder', { folder: folderUri.fsPath });
            vscode.window.showInformationMessage('No Angular components found in the selected folder');
            return;
        }

        logger.info('Found components in folder', { count: componentUris.length, folder: folderUri.fsPath });

        // Show component selection UI (will be implemented in next subtask)
        const selectedComponents = await showComponentSelectionUI(componentUris);

        if (!selectedComponents || selectedComponents.length === 0) {
            logger.info('User cancelled component selection');
            return;
        }

        logger.info('User selected components for analysis', { count: selectedComponents.length });

        // Analyze selected components in batch (will be implemented in subtask 17.5)
        await analyzeBatch(selectedComponents, context);

    } catch (error) {
        logger.error('Folder optimization failed', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
    }
}

/**
 * Interface for component quick pick items
 */
interface ComponentQuickPickItem extends vscode.QuickPickItem {
    uri: vscode.Uri;
    picked: boolean;
}

/**
 * Shows a quick pick UI for selecting components to analyze
 */
async function showComponentSelectionUI(componentUris: vscode.Uri[]): Promise<vscode.Uri[] | undefined> {
    const logger = getLogger();
    
    // Create quick pick items from component URIs
    const items: ComponentQuickPickItem[] = componentUris.map(uri => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder 
            ? vscode.workspace.asRelativePath(uri, false)
            : uri.fsPath;
        
        // Extract component name from file path
        const fileName = uri.fsPath.split(/[\\/]/).pop() || '';
        const componentName = fileName.replace('.component.ts', '');
        
        return {
            label: componentName,
            description: relativePath,
            uri: uri,
            picked: true // Select all by default
        };
    });

    // Sort items alphabetically by label
    items.sort((a, b) => a.label.localeCompare(b.label));

    // Create quick pick with multi-select
    const quickPick = vscode.window.createQuickPick<ComponentQuickPickItem>();
    quickPick.title = 'Select Angular Components to Analyze';
    quickPick.placeholder = `Select components (${items.length} found)`;
    quickPick.canSelectMany = true;
    quickPick.items = items;
    quickPick.selectedItems = items; // Select all by default
    quickPick.matchOnDescription = true;

    // Add buttons for select all / deselect all
    quickPick.buttons = [
        {
            iconPath: new vscode.ThemeIcon('check-all'),
            tooltip: 'Select All'
        },
        {
            iconPath: new vscode.ThemeIcon('close-all'),
            tooltip: 'Deselect All'
        }
    ];

    return new Promise<vscode.Uri[] | undefined>((resolve) => {
        // Handle button clicks
        quickPick.onDidTriggerButton((button) => {
            if (button.tooltip === 'Select All') {
                quickPick.selectedItems = items;
            } else if (button.tooltip === 'Deselect All') {
                quickPick.selectedItems = [];
            }
        });

        // Handle accept (Enter key or OK button)
        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems;
            logger.info('User selected components', { count: selected.length });
            quickPick.hide();
            resolve(selected.map(item => item.uri));
        });

        // Handle cancel (Escape key)
        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });
}

/**
 * Analyzes multiple components in batch with progress tracking
 */
async function analyzeBatch(
    componentUris: vscode.Uri[],
    context: vscode.ExtensionContext
): Promise<void> {
    const logger = getLogger();
    const totalComponents = componentUris.length;
    
    logger.info('Starting batch analysis', { totalComponents });

    // Validate file-based configuration before starting batch analysis
    logger.debug('Validating file-based configuration for batch analysis');
    const configValid = await ConfigurationManager.validateFileConfiguration();
    if (!configValid) {
        logger.warn('Configuration validation failed, but continuing with batch analysis');
        // Don't block analysis, just warn the user
    }

    // Show progress indicator with cancellation support
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AI Frontend Optimizer',
            cancellable: true
        },
        async (progress, token) => {
            // Aggregate results from all components
            const allRecommendations: any[] = [];
            const allMetadata: any[] = [];
            const allSimilarityResults: any[] = [];
            const allComponentSuggestions: any[] = [];
            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < componentUris.length; i++) {
                // Check for cancellation
                if (token.isCancellationRequested) {
                    logger.info('Batch analysis cancelled by user', { 
                        processed: i, 
                        total: totalComponents 
                    });
                    vscode.window.showInformationMessage(
                        `Batch analysis cancelled. Processed ${i} of ${totalComponents} components.`
                    );
                    return;
                }

                const uri = componentUris[i];
                const currentNumber = i + 1;
                
                // Update progress
                const percentComplete = (currentNumber / totalComponents) * 100;
                progress.report({
                    message: `Analyzing ${currentNumber}/${totalComponents}: ${uri.fsPath.split(/[\\/]/).pop()}`,
                    increment: percentComplete / totalComponents
                });

                logger.debug('Processing component in batch', { 
                    index: currentNumber, 
                    total: totalComponents,
                    file: uri.fsPath 
                });

                try {
                    // Analyze single component and collect results
                    const result = await analyzeSingleComponent(uri, context, token);
                    
                    if (result) {
                        // Add file information to recommendations
                        const recommendationsWithFile = result.recommendations.map(rec => ({
                            ...rec,
                            file: result.metadata.componentName
                        }));
                        
                        allRecommendations.push(...recommendationsWithFile);
                        allMetadata.push(result.metadata);
                        
                        if (result.similarityResults) {
                            allSimilarityResults.push(...result.similarityResults);
                        }
                        
                        if (result.componentSuggestions) {
                            allComponentSuggestions.push(...result.componentSuggestions);
                        }
                        
                        successCount++;
                        logger.debug('Component analyzed successfully', { 
                            component: result.metadata.componentName,
                            recommendations: result.recommendations.length
                        });
                    }
                } catch (error) {
                    failureCount++;
                    logger.error(`Failed to analyze component in batch: ${uri.fsPath}`, error);
                    // Continue with next component instead of failing entire batch
                }
            }

            // Check for cancellation before displaying results
            if (token.isCancellationRequested) {
                logger.info('Batch analysis cancelled before displaying results');
                return;
            }

            // Display aggregated results
            if (allRecommendations.length > 0 || allSimilarityResults.length > 0 || allComponentSuggestions.length > 0) {
                logger.info('Displaying batch analysis results', {
                    totalRecommendations: allRecommendations.length,
                    totalSimilarityResults: allSimilarityResults.length,
                    totalComponentSuggestions: allComponentSuggestions.length,
                    successCount,
                    failureCount
                });

                // Create aggregated metadata
                const aggregatedMetadata = {
                    componentName: `Batch Analysis (${successCount} components)`,
                    analyzedAt: new Date().toISOString(),
                    analysisTimeMs: 0,
                    filesAnalyzed: {
                        typescript: `${successCount} components analyzed`
                    }
                };

                // Display results in panel
                const resultsPanel = ResultsPanel.createOrShow(context.extensionUri);
                resultsPanel.updateResults(
                    allRecommendations,
                    aggregatedMetadata,
                    allSimilarityResults.length > 0 ? allSimilarityResults : undefined,
                    allComponentSuggestions.length > 0 ? allComponentSuggestions : undefined
                );

                // Show summary message
                let message = `Batch analysis complete! Analyzed ${successCount} components`;
                if (failureCount > 0) {
                    message += ` (${failureCount} failed)`;
                }
                message += `. Found ${allRecommendations.length} recommendations`;
                if (allSimilarityResults.length > 0) {
                    message += `, ${allSimilarityResults.length} similar classes`;
                }
                if (allComponentSuggestions.length > 0) {
                    message += `, ${allComponentSuggestions.length} component suggestions`;
                }
                message += '.';
                
                vscode.window.showInformationMessage(message);
            } else {
                logger.warn('No results from batch analysis', { successCount, failureCount });
                vscode.window.showWarningMessage(
                    `Batch analysis complete. Analyzed ${successCount} components but found no issues.`
                );
            }
        }
    );
}

/**
 * Analyzes a single component and returns the results
 * This is a helper function for batch analysis
 */
async function analyzeSingleComponent(
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    token: vscode.CancellationToken
): Promise<{ recommendations: any[], metadata: any, similarityResults?: any[], componentSuggestions?: any[] } | null> {
    const logger = getLogger();
    
    try {
        // Resolve component files
        const resolveResult = await resolveComponentFiles(uri);
        
        if (!resolveResult) {
            logger.warn('File is not part of an Angular component', { file: uri.fsPath });
            return null;
        }

        const { files: componentFiles } = resolveResult;

        // Check for cancellation
        if (token.isCancellationRequested) {
            return null;
        }

        // Initialize Rust analyzer runner
        const rustAnalyzer = new RustAnalyzerRunner(context);
        const timeout = ConfigurationManager.get('analyzerTimeout');
        
        // Get validated configuration
        const validatedComponentMappingYaml = await ConfigurationManager.getValidComponentMappingYaml();
        const hasComponentMapping = validatedComponentMappingYaml !== null;
        const validatedBaseStyleFiles = await ConfigurationManager.getValidBaseStyleFiles();
        const hasBaseStyles = validatedBaseStyleFiles && validatedBaseStyleFiles.length > 0;

        // Execute Rust analyzer
        const analysisResult = await rustAnalyzer.analyze(
            componentFiles,
            timeout,
            token,
            () => {}, // No progress reporting for individual components in batch
            hasBaseStyles ? validatedBaseStyleFiles : undefined,
            hasComponentMapping ? validatedComponentMappingYaml! : undefined
        );

        // Check for cancellation
        if (token.isCancellationRequested) {
            return null;
        }

        // Initialize AI service
        const aiService = new AIService(context);
        const isAIConfigured = await aiService.isConfigured();
        
        let recommendations;
        if (isAIConfigured) {
            try {
                // Read code snippets for context
                const codeSnippets = new Map<string, string>();
                
                try {
                    codeSnippets.set('typescript', fs.readFileSync(componentFiles.typescript, 'utf-8'));
                } catch (error) {
                    logger.warn('Failed to read TypeScript file for AI context', error);
                }
                
                if (componentFiles.html) {
                    try {
                        codeSnippets.set('html', fs.readFileSync(componentFiles.html, 'utf-8'));
                    } catch (error) {
                        logger.warn('Failed to read HTML file for AI context', error);
                    }
                }
                
                if (componentFiles.css) {
                    try {
                        codeSnippets.set('css', fs.readFileSync(componentFiles.css, 'utf-8'));
                    } catch (error) {
                        logger.warn('Failed to read CSS file for AI context', error);
                    }
                }

                // Generate AI recommendations
                recommendations = await aiService.generateRecommendations(
                    analysisResult,
                    codeSnippets,
                    token,
                    () => {} // No progress reporting for individual components in batch
                );
            } catch (error) {
                // Fall back to recommendations without AI
                logger.warn('AI service error in batch, using fallback', error);
                recommendations = await aiService.generateRecommendationsWithoutAI(analysisResult);
            }
        } else {
            // Use fallback recommendations without AI
            recommendations = await aiService.generateRecommendationsWithoutAI(analysisResult);
        }

        return {
            recommendations,
            metadata: analysisResult.metadata,
            similarityResults: analysisResult.similarityResults,
            componentSuggestions: analysisResult.componentSuggestions
        };

    } catch (error) {
        logger.error(`Error analyzing single component: ${uri.fsPath}`, error);
        throw error;
    }
}

/**
 * Command handler for "AI Frontend Optimizer: Scan Selection"
 * Analyzes currently selected files from VSCode explorer
 */
export async function optimizeSelection(context: vscode.ExtensionContext): Promise<void> {
    const logger = getLogger();
    logger.info('Starting selection optimization');

    try {
        // Get currently selected files from explorer
        // VSCode doesn't provide a direct API for this, so we'll use the active editor
        // and prompt the user to select files
        const selectedUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            filters: {
                'Angular Files': ['ts', 'html', 'css', 'scss']
            },
            title: 'Select Angular Component Files to Analyze'
        });

        if (!selectedUris || selectedUris.length === 0) {
            logger.info('User cancelled file selection');
            return;
        }

        logger.info('User selected files for analysis', { count: selectedUris.length });

        // Filter for Angular component files only
        const componentUris: vscode.Uri[] = [];
        for (const uri of selectedUris) {
            const fileName = uri.fsPath.split(/[\\/]/).pop() || '';
            
            // Check if it's a component file or related file
            if (fileName.endsWith('.component.ts') || 
                fileName.endsWith('.component.html') || 
                fileName.endsWith('.component.css') ||
                fileName.endsWith('.component.scss')) {
                
                // For non-.ts files, we need to find the .ts file
                if (fileName.endsWith('.component.ts')) {
                    componentUris.push(uri);
                } else {
                    // Try to resolve the component from the related file
                    const resolveResult = await resolveComponentFiles(uri);
                    if (resolveResult && !componentUris.some(u => u.fsPath === resolveResult.files.typescript)) {
                        componentUris.push(vscode.Uri.file(resolveResult.files.typescript));
                    }
                }
            }
        }

        if (componentUris.length === 0) {
            logger.warn('No Angular component files found in selection');
            vscode.window.showWarningMessage('No Angular component files found in selection');
            return;
        }

        logger.info('Filtered component files', { count: componentUris.length });

        // Analyze selected components in batch
        await analyzeBatch(componentUris, context);

    } catch (error) {
        logger.error('Selection optimization failed', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`AI Frontend Optimizer: ${errorMessage}`);
    }
}
