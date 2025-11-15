import * as vscode from 'vscode';
import * as fs from 'fs';
import { resolveComponentFiles } from '../utils/fileResolver';
import { RustAnalyzerRunner } from '../services/rustAnalyzerRunner';
import { AIService } from '../services/aiService';
import { ResultsPanel } from '../panels/resultsPanel';
import { getLogger } from '../utils/logger';
import { ConfigurationManager } from '../utils/config';

/**
 * Main command handler for "AI Optimize this file"
 * Orchestrates the optimization workflow for Angular component files
 */
export async function optimizeFile(
    uri: vscode.Uri,
    context: vscode.ExtensionContext
): Promise<void> {
    const logger = getLogger();
    logger.info('Starting file optimization', { file: uri.fsPath });

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
                logger.debug('Analyzer configuration', { timeout });

                // Execute Rust analyzer with progress reporting and cancellation support
                logger.info('Starting Rust analysis');
                const analysisStartTime = Date.now();
                const analysisResult = await rustAnalyzer.analyze(
                    componentFiles, 
                    timeout,
                    token,
                    (message: string) => progress.report({ message })
                );
                const analysisDuration = Date.now() - analysisStartTime;
                logger.info('Rust analysis completed', { 
                    duration: analysisDuration,
                    cssIssues: analysisResult.cssIssues.length,
                    tsIssues: analysisResult.tsIssues.length,
                    templateIssues: analysisResult.templateIssues.length
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
                resultsPanel.updateResults(recommendations, analysisResult.metadata);

                // Show success message
                const totalIssues = recommendations.length;
                logger.info('Analysis completed successfully', { 
                    totalRecommendations: totalIssues,
                    componentName: analysisResult.metadata.componentName
                });
                vscode.window.showInformationMessage(
                    `Analysis complete! Found ${totalIssues} recommendations.`
                );

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
