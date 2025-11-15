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

// Anthropic provider implementation
export class AnthropicProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private timeout: number;
    private maxRetries: number;

    constructor(apiKey: string, model: string = 'claude-sonnet-4-5-20250929', timeout: number = 45000, maxRetries: number = 3) {
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
                'https://api.anthropic.com/v1/messages',
                {
                    model: this.model,
                    max_tokens: 4000,
                    system: 'You are an expert Angular developer with deep knowledge of TypeScript, RxJS, Angular best practices, CSS optimization, and performance tuning. Analyze code issues carefully and provide specific, actionable recommendations with clear explanations. Focus on practical solutions that improve code quality, performance, and maintainability. Always return valid JSON responses when requested.',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2025-10-16'
                    },
                    timeout: this.timeout,
                    // Support cancellation via axios
                    signal: cancellationToken ? this.createAbortSignal(cancellationToken) : undefined
                }
            );

            // Handle Anthropic API response format
            if (response.data.content && response.data.content.length > 0) {
                return response.data.content[0].text;
            } else if (response.data.completion) {
                // Fallback for older API format
                return response.data.completion;
            } else {
                throw new Error('Invalid response format from Anthropic API');
            }
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
                    throw new Error('Invalid API key. Please check your Anthropic API key configuration.');
                }

                // Handle 404 errors specifically for Anthropic
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    console.error('Anthropic API 404 error. Response:', error.response.data);
                    throw new Error('Anthropic API endpoint not found. Please check if your API key has access to the Claude models.');
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

// OpenAI provider implementation
export class OpenAIProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private timeout: number;
    private maxRetries: number;

    constructor(apiKey: string, model: string = 'gpt-4o', timeout: number = 45000, maxRetries: number = 3) {
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
                            content: 'You are an expert Angular developer with deep knowledge of TypeScript, RxJS, Angular best practices, CSS optimization, and performance tuning. Analyze code issues carefully and provide specific, actionable recommendations with clear explanations. Focus on practical solutions that improve code quality, performance, and maintainability. Always return valid JSON responses when requested.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 4000
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

        // Get timeout from configuration (in seconds, convert to milliseconds)
        const timeoutSeconds = ConfigurationManager.get('analyzerTimeout');
        const timeoutMs = timeoutSeconds * 1000;

        // Create provider based on configuration
        if (providerType === 'openai') {
            this.provider = new OpenAIProvider(apiKey, model, timeoutMs);
        } else if (providerType === 'anthropic') {
            this.provider = new AnthropicProvider(apiKey, model, timeoutMs);
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
        const providerType = ConfigurationManager.get('aiProvider');
        const providerName = providerType === 'anthropic' ? 'Anthropic' : 'OpenAI';
        const placeholder = providerType === 'anthropic' ? 'sk-ant-...' : 'sk-...';
        
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter your ${providerName} API key`,
            password: true,
            placeHolder: placeholder,
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
            console.log("codesnipet",codeSnippets)
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
            console.log("aiResponse",aiResponse)

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

        let prompt = `You are an expert Angular developer. Analyze the following component issues and provide detailed, actionable optimization recommendations.\n\n`;
        prompt += `Component: ${metadata.componentName}\n`;
        prompt += `Files analyzed: ${Object.values(metadata.filesAnalyzed).filter(f => f).join(', ')}\n\n`;

        // Add CSS issues with context
        if (cssIssues.length > 0) {
            prompt += `## CSS Issues (${cssIssues.length})\n\n`;
            cssIssues.forEach((issue, index) => {
                prompt += `### Issue ${index + 1}: ${issue.issueType}\n`;
                prompt += `- Location: Line ${issue.line}, Column ${issue.column}\n`;
                prompt += `- Selector: \`${issue.selector}\`\n`;
                prompt += `- Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const cssSnippet = this.extractRelevantSnippet(codeSnippets.get('css') || '', issue.line, 3);
                if (cssSnippet) {
                    prompt += `- Code Context:\n${cssSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        // Add TypeScript issues with context
        if (tsIssues.length > 0) {
            prompt += `## TypeScript Issues (${tsIssues.length})\n\n`;
            tsIssues.forEach((issue, index) => {
                prompt += `### Issue ${index + 1}: ${issue.issueType}\n`;
                prompt += `- Location: Line ${issue.line}, Column ${issue.column}\n`;
                prompt += `- Identifier: \`${issue.identifier}\`\n`;
                prompt += `- Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const tsSnippet = this.extractRelevantSnippet(codeSnippets.get('typescript') || '', issue.line, 3);
                if (tsSnippet) {
                    prompt += `- Code Context:\n${tsSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        // Add Template issues with context
        if (templateIssues.length > 0) {
            prompt += `## Template Issues (${templateIssues.length})\n\n`;
            templateIssues.forEach((issue, index) => {
                prompt += `### Issue ${index + 1}: ${issue.issueType}\n`;
                prompt += `- Location: Line ${issue.line}\n`;
                prompt += `- Severity: ${issue.severity}\n`;
                prompt += `- Description: ${issue.description}\n`;
                
                // Add relevant code snippet if available
                const htmlSnippet = this.extractRelevantSnippet(codeSnippets.get('html') || '', issue.line, 3);
                if (htmlSnippet) {
                    prompt += `- Code Context:\n${htmlSnippet}\n`;
                }
                prompt += `\n`;
            });
        }

        prompt += `\n## Instructions\n\n`;
        prompt += `For EACH issue above, provide a detailed recommendation with:\n`;
        prompt += `1. **Summary**: A clear, concise problem statement (1-2 sentences)\n`;
        prompt += `2. **Recommendation**: Specific, actionable steps to fix the issue (2-4 sentences)\n`;
        prompt += `3. **Priority**: Set based on impact:\n`;
        prompt += `   - "high": Critical issues affecting functionality, performance, or security\n`;
        prompt += `   - "medium": Important issues affecting code quality or maintainability\n`;
        prompt += `   - "low": Minor improvements or style issues\n`;
        prompt += `4. **Code Example** (optional): Show the corrected code if applicable\n\n`;
        prompt += `Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:\n`;
        prompt += `[\n`;
        prompt += `  {\n`;
        prompt += `    "category": "css" | "typescript" | "template",\n`;
        prompt += `    "issueId": "css-0" | "ts-0" | "template-0" (increment for each issue),\n`;
        prompt += `    "summary": "Clear problem statement",\n`;
        prompt += `    "recommendation": "Detailed, actionable recommendation with specific steps",\n`;
        prompt += `    "priority": "high" | "medium" | "low",\n`;
        prompt += `    "codeExample": "Optional: Show the fixed code"\n`;
        prompt += `  }\n`;
        prompt += `]\n\n`;
        prompt += `IMPORTANT: Return ONLY the JSON array, nothing else. Make recommendations specific and actionable.`;

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
            // Determine priority based on issue type
            let priority: 'high' | 'medium' | 'low' = 'low';
            if (issue.issueType === 'UnusedSelector') {
                priority = 'medium';
            } else if (issue.issueType === 'DuplicateRule') {
                priority = 'high';
            }

            // Enhanced recommendation text
            let recommendation = issue.description;
            if (issue.issueType === 'UnusedSelector') {
                recommendation = `The CSS selector "${issue.selector}" is not used in the template. Consider removing it to reduce bundle size and improve maintainability.`;
            } else if (issue.issueType === 'DuplicateRule') {
                recommendation = `The CSS selector "${issue.selector}" has duplicate rules. Consolidate these rules to avoid conflicts and improve code quality.`;
            } else if (issue.issueType === 'RedundantSelector') {
                recommendation = `The CSS selector "${issue.selector}" may be redundant. Review and simplify your CSS structure.`;
            }

            recommendations.push({
                category: 'css',
                issueId: `css-${index}`,
                summary: `${issue.issueType}: ${issue.selector}`,
                recommendation,
                priority,
                file: analysisResult.metadata.filesAnalyzed.css || '',
                line: issue.line,
                column: issue.column
            });
        });

        // TypeScript recommendations
        analysisResult.tsIssues.forEach((issue, index) => {
            // Determine priority based on issue type
            let priority: 'high' | 'medium' | 'low' = 'medium';
            if (issue.issueType === 'MissingAwait') {
                priority = 'high';
            } else if (issue.issueType === 'UnusedImport') {
                priority = 'low';
            }

            // Enhanced recommendation text
            let recommendation = issue.description;
            if (issue.issueType === 'UnusedImport') {
                recommendation = `The import "${issue.identifier}" is not used in this file. Remove it to keep your code clean and reduce bundle size.`;
            } else if (issue.issueType === 'MissingAwait') {
                recommendation = `The async function call "${issue.identifier}" is missing an await keyword. This can lead to race conditions and unexpected behavior. Add "await" before this call.`;
            } else if (issue.issueType === 'DuplicateLogic') {
                recommendation = `Duplicate logic detected for "${issue.identifier}". Consider extracting this into a reusable function or service to follow DRY principles.`;
            }

            recommendations.push({
                category: 'typescript',
                issueId: `ts-${index}`,
                summary: `${issue.issueType}: ${issue.identifier}`,
                recommendation,
                priority,
                file: analysisResult.metadata.filesAnalyzed.typescript || '',
                line: issue.line,
                column: issue.column
            });
        });

        // Template recommendations
        analysisResult.templateIssues.forEach((issue, index) => {
            const priority = issue.severity === 'High' ? 'high' : 
                           issue.severity === 'Medium' ? 'medium' : 'low';
            
            // Enhanced recommendation text
            let recommendation = issue.description;
            if (issue.issueType === 'DeepNesting') {
                recommendation = `Deep nesting detected in the template. ${issue.description} Consider flattening the structure or extracting nested content into separate components for better performance and maintainability.`;
            } else if (issue.issueType === 'HeavyPipe') {
                recommendation = `Heavy pipe usage detected. ${issue.description} Consider using memoization or moving the transformation to the component class to improve performance.`;
            } else if (issue.issueType === 'RedundantWrapper') {
                recommendation = `Redundant wrapper element detected. ${issue.description} Simplify the template structure by removing unnecessary wrapper elements.`;
            }

            recommendations.push({
                category: 'template',
                issueId: `template-${index}`,
                summary: `${issue.issueType} at line ${issue.line}`,
                recommendation,
                priority,
                file: analysisResult.metadata.filesAnalyzed.html || '',
                line: issue.line,
                column: 1
            });
        });

        return recommendations;
    }
}
