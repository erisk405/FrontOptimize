import * as vscode from 'vscode';
import axios from 'axios';
import { AnalyzerResult, AIRecommendation } from '../types';
import { ConfigurationManager } from '../utils/config';

// Provider interface for AI services
export interface AIProvider {
    generateRecommendations(
        prompt: string,
        context: AnalysisContext,
        cancellationToken?: vscode.CancellationToken
    ): Promise<string>;
}

export interface AnalysisContext {
    analysisResult: AnalyzerResult;
    codeSnippets: Map<string, string>;
}

// OpenAI provider implementation
export class OpenAIProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private timeout: number;
    private maxRetries: number;

    constructor(apiKey: string, model: string = 'gpt-4', timeout: number = 15000, maxRetries: number = 3) {
        this.apiKey = apiKey;
        this.model = model;
        this.timeout = timeout;
        this.maxRetries = maxRetries;
    }

    async generateRecommendations(
        prompt: string,
        context: AnalysisContext,
        cancellationToken?: vscode.CancellationToken
    ): Promise<string> {
        return this.executeWithRetry(async () => {
            // Check for cancellation before making request
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('Request cancelled by user');
            }

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert frontend developer specializing in Angular optimization. Provide clear, actionable recommendations for code improvements.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout,
                    // Support cancellation via axios
                    signal: cancellationToken ? this.createAbortSignal(cancellationToken) : undefined
                }
            );

            return response.data.choices[0].message.content;
        });
    }

    // Create an AbortSignal from VSCode CancellationToken
    private createAbortSignal(cancellationToken: vscode.CancellationToken): AbortSignal {
        const controller = new AbortController();
        cancellationToken.onCancellationRequested(() => {
            controller.abort();
        });
        return controller.signal;
    }

    // Execute request with exponential backoff retry
    private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Don't retry on authentication errors
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    throw new Error('Invalid API key. Please check your OpenAI API key configuration.');
                }

                // Don't retry on client errors (except rate limits)
                if (axios.isAxiosError(error) && 
                    error.response?.status && 
                    error.response.status >= 400 && 
                    error.response.status < 500 &&
                    error.response.status !== 429) {
                    throw lastError;
                }

                // If this is the last attempt, throw the error
                if (attempt === this.maxRetries - 1) {
                    break;
                }

                // Calculate exponential backoff delay: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`AI request failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }

        throw lastError || new Error('AI request failed after maximum retries');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main AI Service class with configuration management
export class AIService {
    private provider: AIProvider;
    private context: vscode.ExtensionContext;
    private static readonly API_KEY_SECRET = 'aiFrontendOptimizer.apiKey';

    constructor(context: vscode.ExtensionContext, provider?: AIProvider) {
        this.context = context;
        if (provider) {
            this.provider = provider;
        } else {
            // Will be initialized when needed
            this.provider = null as any;
        }
    }

    // Initialize provider based on configuration
    async initializeProvider(): Promise<void> {
        const providerType = ConfigurationManager.get('aiProvider');
        const model = ConfigurationManager.get('model');
        
        // Get API key from SecretStorage
        const apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('API key not configured. Please set your API key in settings.');
        }

        // Create provider based on configuration
        if (providerType === 'openai') {
            this.provider = new OpenAIProvider(apiKey, model);
        } else {
            throw new Error(`Unsupported AI provider: ${providerType}`);
        }
    }

    // Get API key from SecretStorage
    async getApiKey(): Promise<string | undefined> {
        // First check SecretStorage
        let apiKey = await this.context.secrets.get(AIService.API_KEY_SECRET);
        
        // If not in SecretStorage, check configuration and migrate
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('aiFrontendOptimizer');
            const configApiKey = config.get<string>('apiKey');
            
            if (configApiKey && configApiKey.trim() !== '') {
                // Migrate to SecretStorage
                await this.setApiKey(configApiKey);
                apiKey = configApiKey;
                
                // Clear from configuration
                await config.update('apiKey', '', vscode.ConfigurationTarget.Global);
            }
        }
        
        return apiKey;
    }

    // Set API key in SecretStorage
    async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store(AIService.API_KEY_SECRET, apiKey);
    }

    // Prompt user for API key if not configured
    async promptForApiKey(): Promise<boolean> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key',
            password: true,
            placeHolder: 'sk-...',
            ignoreFocusOut: true
        });

        if (apiKey && apiKey.trim() !== '') {
            await this.setApiKey(apiKey);
            return true;
        }

        return false;
    }

    // Check if API key is configured
    async isConfigured(): Promise<boolean> {
        const apiKey = await this.getApiKey();
        return !!apiKey;
    }

    async generateRecommendations(
        analysisResult: AnalyzerResult,
        codeSnippets: Map<string, string>,
        cancellationToken?: vscode.CancellationToken,
        progressCallback?: (message: string) => void
    ): Promise<AIRecommendation[]> {
        try {
            // Check for cancellation before starting
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('AI processing cancelled by user');
            }

            // Ensure provider is initialized
            if (!this.provider) {
                if (progressCallback) {
                    progressCallback('Initializing AI provider...');
                }
                await this.initializeProvider();
            }

            const context: AnalysisContext = {
                analysisResult,
                codeSnippets
            };

            // Build prompt with analysis results
            if (progressCallback) {
                progressCallback('Building AI prompt...');
            }
            const prompt = this.buildPrompt(analysisResult, codeSnippets);

            // Check for cancellation before AI call
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('AI processing cancelled by user');
            }

            // Get AI response with timeout handling
            if (progressCallback) {
                progressCallback('Requesting AI recommendations...');
            }
            const aiResponse = await this.provider.generateRecommendations(prompt, context, cancellationToken);

            // Check for cancellation after AI call
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('AI processing cancelled by user');
            }

            // Parse response into structured recommendations
            if (progressCallback) {
                progressCallback('Parsing AI recommendations...');
            }
            const recommendations = this.parseAIResponse(aiResponse, analysisResult);

            return recommendations;

        } catch (error) {
            // Check if it was a cancellation
            if (error instanceof Error && error.message.includes('cancelled')) {
                throw error;
            }

            console.error('AI service error:', error);
            
            // Log the error for debugging
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`AI recommendations unavailable: ${errorMessage}. Falling back to raw analysis.`);

            // Fallback to raw analysis when AI is unavailable
            return this.createFallbackRecommendations(analysisResult);
        }
    }

    // Generate recommendations without AI (fallback mode)
    async generateRecommendationsWithoutAI(
        analysisResult: AnalyzerResult
    ): Promise<AIRecommendation[]> {
        return this.createFallbackRecommendations(analysisResult);
    }

    // Build prompt for AI with analysis results and code context
    private buildPrompt(analysisResult: AnalyzerResult, codeSnippets: Map<string, string>): string {
        const { cssIssues, tsIssues, templateIssues, metadata } = analysisResult;

        let prompt = `Analyze the following Angular component and provide optimization recommendations.\n\n`;
        prompt += `Component: ${metadata.componentName}\n`;
        prompt += `Files analyzed: ${Object.values(metadata.filesAnalyzed).filter(f => f).join(', ')}\n\n`;

        // Add CSS issues
        if (cssIssues.length > 0) {
            prompt += `## CSS Issues (${cssIssues.length})\n\n`;
            cssIssues.forEach((issue, index) => {
                prompt += `${index + 1}. ${issue.issueType} at line ${issue.line}:\n`;
                prompt += `   Selector: ${issue.selector}\n`;
                prompt += `   Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const cssSnippet = this.extractRelevantSnippet(codeSnippets.get('css') || '', issue.line, 3);
                if (cssSnippet) {
                    prompt += `   Code:\n${cssSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        // Add TypeScript issues
        if (tsIssues.length > 0) {
            prompt += `## TypeScript Issues (${tsIssues.length})\n\n`;
            tsIssues.forEach((issue, index) => {
                prompt += `${index + 1}. ${issue.issueType} at line ${issue.line}:\n`;
                prompt += `   Identifier: ${issue.identifier}\n`;
                prompt += `   Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const tsSnippet = this.extractRelevantSnippet(codeSnippets.get('typescript') || '', issue.line, 3);
                if (tsSnippet) {
                    prompt += `   Code:\n${tsSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        // Add Template issues
        if (templateIssues.length > 0) {
            prompt += `## Template Issues (${templateIssues.length})\n\n`;
            templateIssues.forEach((issue, index) => {
                prompt += `${index + 1}. ${issue.issueType} at line ${issue.line} (Severity: ${issue.severity}):\n`;
                prompt += `   Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const htmlSnippet = this.extractRelevantSnippet(codeSnippets.get('html') || '', issue.line, 3);
                if (htmlSnippet) {
                    prompt += `   Code:\n${htmlSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        prompt += `\nFor each issue, provide:\n`;
        prompt += `1. A brief summary of the problem\n`;
        prompt += `2. A specific, actionable recommendation\n`;
        prompt += `3. Priority level (high/medium/low)\n`;
        prompt += `4. Optional code example showing the fix\n\n`;
        prompt += `Format your response as a JSON array with this structure:\n`;
        prompt += `[\n`;
        prompt += `  {\n`;
        prompt += `    "category": "css|typescript|template",\n`;
        prompt += `    "issueId": "unique-id",\n`;
        prompt += `    "summary": "Brief problem summary",\n`;
        prompt += `    "recommendation": "Detailed recommendation",\n`;
        prompt += `    "priority": "high|medium|low",\n`;
        prompt += `    "codeExample": "Optional code example"\n`;
        prompt += `  }\n`;
        prompt += `]\n`;

        return prompt;
    }

    // Extract relevant code snippet around a specific line
    private extractRelevantSnippet(content: string, line: number, contextLines: number = 3): string {
        if (!content) {
            return '';
        }

        const lines = content.split('\n');
        const startLine = Math.max(0, line - contextLines - 1);
        const endLine = Math.min(lines.length, line + contextLines);
        
        const snippet = lines.slice(startLine, endLine)
            .map((l, i) => {
                const lineNum = startLine + i + 1;
                const marker = lineNum === line ? '→' : ' ';
                return `${marker} ${lineNum.toString().padStart(4)}: ${l}`;
            })
            .join('\n');

        return '```\n' + snippet + '\n```';
    }

    // Parse AI response into structured recommendations
    private parseAIResponse(aiResponse: string, analysisResult: AnalyzerResult): AIRecommendation[] {
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                // If no JSON found, create fallback recommendations
                return this.createFallbackRecommendations(analysisResult);
            }

            const recommendations = JSON.parse(jsonMatch[0]) as AIRecommendation[];
            
            // Validate and sanitize recommendations
            return recommendations.filter(rec => 
                rec.category && 
                rec.summary && 
                rec.recommendation &&
                rec.priority
            ).map((rec, index) => ({
                ...rec,
                issueId: rec.issueId || `${rec.category}-${index}`
            }));

        } catch (error) {
            console.error('Failed to parse AI response:', error);
            return this.createFallbackRecommendations(analysisResult);
        }
    }

    // Create fallback recommendations when AI parsing fails
    private createFallbackRecommendations(analysisResult: AnalyzerResult): AIRecommendation[] {
        const recommendations: AIRecommendation[] = [];

        // CSS recommendations
        analysisResult.cssIssues.forEach((issue, index) => {
            recommendations.push({
                category: 'css',
                issueId: `css-${index}`,
                summary: `${issue.issueType}: ${issue.selector}`,
                recommendation: issue.description,
                priority: issue.issueType === 'UnusedSelector' ? 'medium' : 'low',
                file: analysisResult.metadata.filesAnalyzed.css,
                line: issue.line,
                column: issue.column
            });
        });

        // TypeScript recommendations
        analysisResult.tsIssues.forEach((issue, index) => {
            recommendations.push({
                category: 'typescript',
                issueId: `ts-${index}`,
                summary: `${issue.issueType}: ${issue.identifier}`,
                recommendation: issue.description,
                priority: issue.issueType === 'MissingAwait' ? 'high' : 'medium',
                file: analysisResult.metadata.filesAnalyzed.typescript,
                line: issue.line,
                column: issue.column
            });
        });

        // Template recommendations
        analysisResult.templateIssues.forEach((issue, index) => {
            const priority = issue.severity === 'High' ? 'high' : 
                           issue.severity === 'Medium' ? 'medium' : 'low';
            recommendations.push({
                category: 'template',
                issueId: `template-${index}`,
                summary: `${issue.issueType} at line ${issue.line}`,
                recommendation: issue.description,
                priority,
                file: analysisResult.metadata.filesAnalyzed.html,
                line: issue.line,
                column: 1
            });
        });

        return recommendations;
    }
}
