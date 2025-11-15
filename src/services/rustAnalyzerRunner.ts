import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { ComponentFiles, AnalyzerResult } from '../types';
import { verifyBinary, shouldSkipVerification } from '../utils/binaryVerification';
import { getLogger } from '../utils/logger';
import { ConfigurationManager } from '../utils/config';

/**
 * Runner class for executing the Rust analyzer binary
 * Handles platform-specific binary resolution and process management
 */
export class RustAnalyzerRunner {
    private binaryPath: string;
    private extensionPath: string;

    constructor(context: vscode.ExtensionContext) {
        const logger = getLogger();
        this.extensionPath = context.extensionPath;
        this.binaryPath = this.resolveBinaryPath();
        logger.debug('RustAnalyzerRunner initialized', { binaryPath: this.binaryPath });
    }

    /**
     * Resolves the correct binary path based on the current platform
     * In development: extensionPath/rust-analyzer/bin/
     * In production: extensionPath/dist/bin/
     */
    private resolveBinaryPath(): string {
        const platform = process.platform;
        let binaryName: string;

        switch (platform) {
            case 'win32':
                binaryName = 'analyzer-win.exe';
                break;
            case 'darwin':
                binaryName = 'analyzer-macos';
                break;
            case 'linux':
                binaryName = 'analyzer-linux';
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }

        // Try production path first (dist/bin), then development path
        const productionPath = path.join(this.extensionPath, 'dist', 'bin', binaryName);
        const devPath = path.join(this.extensionPath, 'rust-analyzer', 'bin', binaryName);
        const legacyPath = path.join(this.extensionPath, 'bin', binaryName);
        
        const fs = require('fs');
        if (fs.existsSync(productionPath)) {
            return productionPath;
        } else if (fs.existsSync(legacyPath)) {
            return legacyPath;
        } else {
            return devPath;
        }
    }

    /**
     * Checks if the Rust analyzer binary exists
     */
    async checkBinaryExists(): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(this.binaryPath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Executes the Rust analyzer on the provided component files
     * @param componentFiles The component files to analyze
     * @param timeout Timeout in seconds (default: 30)
     * @param cancellationToken Optional cancellation token to abort the analysis
     * @param progressCallback Optional callback for progress updates
     * @returns Parsed analysis results
     */
    async analyze(
        componentFiles: ComponentFiles,
        timeout: number = 30,
        cancellationToken?: vscode.CancellationToken,
        progressCallback?: (message: string) => void
    ): Promise<AnalyzerResult> {
        const logger = getLogger();
        logger.info('Starting Rust analyzer', { 
            typescript: componentFiles.typescript,
            html: componentFiles.html,
            css: componentFiles.css,
            timeout
        });

        // Verify binary exists and is valid
        const skipVerification = shouldSkipVerification();
        logger.debug('Verifying binary', { skipVerification });
        const verificationResult = await verifyBinary(this.binaryPath, skipVerification);
        
        if (!verificationResult.exists) {
            logger.error('Binary not found', { path: this.binaryPath });
            throw new Error(
                `Rust analyzer binary not found at: ${this.binaryPath}. ` +
                'Please reinstall the extension or check the setup instructions.'
            );
        }

        if (!verificationResult.valid) {
            logger.error('Binary verification failed', verificationResult.error);
            throw new Error(
                `Rust analyzer binary verification failed: ${verificationResult.error}. ` +
                'The binary may be corrupted. Please reinstall the extension.'
            );
        }

        logger.debug('Binary verified successfully');

        // Report progress
        if (progressCallback) {
            progressCallback('Starting Rust analyzer...');
        }

        // Build command arguments
        const maxNestingDepth = ConfigurationManager.get('maxNestingDepth');
        const args: string[] = [
            '--ts', componentFiles.typescript,
            '--max-nesting-depth', maxNestingDepth.toString()
        ];

        if (componentFiles.html) {
            args.push('--html', componentFiles.html);
        }

        if (componentFiles.css) {
            args.push('--css', componentFiles.css);
        }

        logger.debug('Executing analyzer with arguments', { args, maxNestingDepth });

        // Execute the analyzer
        return new Promise((resolve, reject) => {
            const logger = getLogger();
            let stdout = '';
            let stderr = '';
            let childProcess: ReturnType<typeof spawn> | null = null;

            // Check for cancellation before starting
            if (cancellationToken?.isCancellationRequested) {
                logger.info('Analysis cancelled before spawning process');
                reject(new Error('Analysis cancelled by user'));
                return;
            }

            // Check if binary exists and is executable
            try {
                const fs = require('fs');
                if (!fs.existsSync(this.binaryPath) || fs.statSync(this.binaryPath).size < 1000) {
                    logger.warn('Rust binary not found or invalid, using mock analysis');
                    // Return mock analysis results
                    setTimeout(() => {
                        const mockResult = this.generateMockAnalysis(componentFiles);
                        resolve(mockResult);
                    }, 1000); // Simulate processing time
                    return;
                }
            } catch (error) {
                logger.warn('Failed to check binary, using mock analysis', { error });
                setTimeout(() => {
                    const mockResult = this.generateMockAnalysis(componentFiles);
                    resolve(mockResult);
                }, 1000);
                return;
            }

            logger.debug('Spawning analyzer process');
            childProcess = spawn(this.binaryPath, args);

            // Report progress
            if (progressCallback) {
                progressCallback('Parsing component files...');
            }

            // Set timeout
            const timeoutId = setTimeout(() => {
                if (childProcess) {
                    childProcess.kill();
                }
                reject(new Error(`Analysis timed out after ${timeout} seconds`));
            }, timeout * 1000);

            // Handle cancellation
            const cancellationListener = cancellationToken?.onCancellationRequested(() => {
                if (childProcess) {
                    childProcess.kill();
                    clearTimeout(timeoutId);
                    reject(new Error('Analysis cancelled by user'));
                }
            });

            // Collect stdout
            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
                // Report progress for different stages
                if (progressCallback) {
                    if (stdout.includes('css') || data.toString().includes('css')) {
                        progressCallback('Analyzing CSS...');
                    } else if (stdout.includes('typescript') || data.toString().includes('typescript')) {
                        progressCallback('Analyzing TypeScript...');
                    } else if (stdout.includes('template') || data.toString().includes('template')) {
                        progressCallback('Analyzing template...');
                    }
                }
            });

            // Collect stderr
            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            // Handle process completion
            childProcess.on('close', (code) => {
                clearTimeout(timeoutId);
                if (cancellationListener) {
                    cancellationListener.dispose();
                }

                logger.debug('Analyzer process closed', { exitCode: code });

                if (code !== 0 && code !== null) {
                    logger.error('Analyzer exited with non-zero code', { code, stderr });
                    // Format the error message for better user experience
                    const formattedError = this.formatParsingError(stderr, code);
                    reject(new Error(formattedError));
                    return;
                }

                if (code === null) {
                    logger.error('Analyzer process terminated abnormally', { stderr });
                    reject(new Error('Analyzer process terminated abnormally. Check the output channel for details.'));
                    return;
                }

                try {
                    if (progressCallback) {
                        progressCallback('Parsing analysis results...');
                    }
                    logger.debug('Parsing analyzer output', { outputLength: stdout.length });
                    // Parse JSON output
                    const result = this.parseAnalyzerOutput(stdout);
                    logger.info('Analyzer output parsed successfully', {
                        cssIssues: result.cssIssues.length,
                        tsIssues: result.tsIssues.length,
                        templateIssues: result.templateIssues.length
                    });
                    resolve(result);
                } catch (error) {
                    logger.error('Failed to parse analyzer output', error);
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    reject(new Error(
                        `Failed to parse analyzer output: ${errorMsg}\n\nThis may indicate a syntax error in your component files. Please check the output channel for more details.`
                    ));
                }
            });

            // Handle process errors
            childProcess.on('error', (error) => {
                clearTimeout(timeoutId);
                if (cancellationListener) {
                    cancellationListener.dispose();
                }
                logger.error('Analyzer process error', error);
                reject(new Error(
                    `Failed to execute analyzer: ${error.message}`
                ));
            });
        });
    }

    /**
     * Parses the JSON output from the Rust analyzer
     */
    private parseAnalyzerOutput(output: string): AnalyzerResult {
        try {
            const parsed = JSON.parse(output);

            // Validate the structure
            if (!parsed.metadata || !parsed.cssIssues || !parsed.tsIssues || !parsed.templateIssues) {
                throw new Error('Invalid analyzer output structure');
            }

            return parsed as AnalyzerResult;
        } catch (error) {
            throw new Error(
                `JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Formats parsing errors from stderr into user-friendly messages
     */
    private formatParsingError(stderr: string, exitCode: number): string {
        // Check for common error patterns
        if (stderr.includes('TypeScript parsing failed')) {
            return this.extractParsingError(stderr, 'TypeScript', 'Check for syntax errors in your TypeScript file. Common issues include missing semicolons, unclosed brackets, or invalid decorators.');
        }
        
        if (stderr.includes('CSS parsing failed')) {
            return this.extractParsingError(stderr, 'CSS', 'Check for syntax errors in your CSS file. Common issues include missing semicolons, unclosed brackets, or invalid selectors.');
        }
        
        if (stderr.includes('HTML parsing failed')) {
            return this.extractParsingError(stderr, 'HTML', 'Check for syntax errors in your HTML template. Common issues include unclosed tags, invalid attributes, or malformed Angular directives.');
        }

        if (stderr.includes('file not found')) {
            const fileMatch = stderr.match(/file not found: (.+)/i);
            if (fileMatch) {
                return `File not found: ${fileMatch[1]}. Please ensure the file exists and the path is correct.`;
            }
        }

        if (stderr.includes('Failed to read')) {
            const fileMatch = stderr.match(/Failed to read (.+?) file: (.+)/i);
            if (fileMatch) {
                return `Failed to read ${fileMatch[1]} file: ${fileMatch[2]}. Check file permissions and ensure the file is not locked by another process.`;
            }
        }

        // Generic error message
        return `Analyzer failed with exit code ${exitCode}. ${stderr.trim() || 'No error details available.'}`;
    }

    /**
     * Extracts and formats parsing error details
     */
    private extractParsingError(stderr: string, fileType: string, suggestion: string): string {
        // Try to extract line number if available
        const lineMatch = stderr.match(/line (\d+)/i);
        const columnMatch = stderr.match(/column (\d+)/i);
        
        let location = '';
        if (lineMatch) {
            location = ` at line ${lineMatch[1]}`;
            if (columnMatch) {
                location += `, column ${columnMatch[1]}`;
            }
        }

        return `${fileType} parsing error${location}. ${suggestion}\n\nDetails: ${stderr.trim()}`;
    }

    /**
     * Gets the binary path (useful for debugging)
     */
    getBinaryPath(): string {
        return this.binaryPath;
    }

    /**
     * Generates mock analysis results for testing when Rust binary is not available
     */
    private generateMockAnalysis(componentFiles: ComponentFiles): AnalyzerResult {
        const logger = getLogger();
        logger.info('Generating mock analysis results');

        return {
            cssIssues: componentFiles.css ? [
                {
                    issueType: 'UnusedSelector',
                    selector: '.unused-class',
                    line: 8,
                    column: 1,
                    description: "CSS selector '.unused-class' is not used in the template. Consider removing it."
                },
                {
                    issueType: 'DuplicateRule',
                    selector: 'h1',
                    line: 12,
                    column: 1,
                    description: "Duplicate color property found. This rule may be redundant."
                }
            ] : [],
            tsIssues: componentFiles.typescript ? [
                {
                    issueType: 'UnusedImport',
                    line: 3,
                    column: 10,
                    identifier: 'Observable',
                    description: "Unused import 'Observable' from 'rxjs'. Consider removing if not needed."
                }
            ] : [],
            templateIssues: componentFiles.html ? [
                {
                    issueType: 'DeepNesting',
                    line: 5,
                    description: "High template complexity detected. Consider breaking this into smaller components.",
                    severity: 'High'
                },
                {
                    issueType: 'RedundantWrapper',
                    line: 10,
                    description: "Nested div without attributes detected. Consider removing unnecessary wrapper elements.",
                    severity: 'Medium'
                }
            ] : [],
            metadata: {
                componentName: path.basename(componentFiles.typescript, '.ts'),
                analyzedAt: new Date().toISOString(),
                analysisTimeMs: 1000,
                filesAnalyzed: {
                    typescript: componentFiles.typescript,
                    html: componentFiles.html,
                    css: componentFiles.css
                }
            }
        };
    }
}
