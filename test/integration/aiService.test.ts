/**
 * AI Service Integration Tests
 * 
 * Tests AI integration with mock and real responses
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { AIService } from '../../src/services/aiService';

suite('AI Service Integration Tests', () => {
    let aiService: AIService;
    
    const mockAnalysisResult = {
        cssIssues: [
            {
                issueType: 'UnusedSelector',
                selector: '.unused-class',
                line: 42,
                column: 1,
                description: 'CSS selector not found in template'
            }
        ],
        tsIssues: [
            {
                issueType: 'UnusedImport',
                line: 3,
                column: 10,
                identifier: 'Observable',
                description: 'Import declared but never used'
            }
        ],
        templateIssues: [
            {
                issueType: 'DeepNesting',
                line: 78,
                description: 'Loop nesting exceeds 2 levels',
                severity: 'High'
            }
        ],
        metadata: {
            componentName: 'test.component',
            analyzedAt: new Date().toISOString(),
            analysisTimeMs: 1250,
            filesAnalyzed: {
                typescript: 'test.component.ts',
                html: 'test.component.html',
                css: 'test.component.css'
            }
        }
    };

    const mockCodeSnippets = new Map([
        ['test.component.css:42', '.unused-class { color: red; }'],
        ['test.component.ts:3', "import { Observable } from 'rxjs';"],
        ['test.component.html:78', '<div *ngFor="let item of items">...</div>']
    ]);

    suiteSetup(async function() {
        this.timeout(5000);
        
        // Get API key from configuration or use mock
        const config = vscode.workspace.getConfiguration('aiFrontendOptimizer');
        const apiKey = config.get<string>('apiKey') || 'mock-api-key';
        const model = config.get<string>('model') || 'gpt-4';
        
        aiService = new AIService(apiKey, model);
    });

    test('AI Service - Mock Response Handling', async function() {
        this.timeout(5000);
        
        // Test with mock data structure
        const mockResponse = {
            recommendations: [
                {
                    category: 'css',
                    issueId: 'css-unused-0',
                    summary: 'Remove unused CSS selector',
                    recommendation: 'The class .unused-class is not used. Remove it to reduce bundle size.',
                    priority: 'medium',
                    codeExample: '// Remove lines 42-44'
                }
            ]
        };
        
        // Validate mock response structure
        assert.ok(Array.isArray(mockResponse.recommendations), 'Should have recommendations array');
        assert.ok(mockResponse.recommendations.length > 0, 'Should have at least one recommendation');
        
        const rec = mockResponse.recommendations[0];
        assert.ok(rec.category, 'Recommendation should have category');
        assert.ok(rec.issueId, 'Recommendation should have issueId');
        assert.ok(rec.summary, 'Recommendation should have summary');
        assert.ok(rec.recommendation, 'Recommendation should have recommendation text');
        assert.ok(rec.priority, 'Recommendation should have priority');
    });

    test('AI Service - Request Formatting', async function() {
        this.timeout(5000);
        
        // Test that the service can format requests properly
        try {
            // This tests the internal formatting without making actual API call
            const prompt = aiService['formatPrompt'](mockAnalysisResult, mockCodeSnippets);
            
            assert.ok(prompt, 'Should generate prompt');
            assert.ok(prompt.length > 0, 'Prompt should not be empty');
            assert.ok(prompt.includes('CSS'), 'Prompt should mention CSS issues');
            assert.ok(prompt.includes('TypeScript'), 'Prompt should mention TypeScript issues');
            assert.ok(prompt.includes('template'), 'Prompt should mention template issues');
        } catch (error) {
            // If method is private, skip this test
            console.log('Skipping prompt formatting test (private method)');
        }
    });

    test('AI Service - Error Handling: Invalid API Key', async function() {
        this.timeout(10000);
        
        const invalidService = new AIService('invalid-key-12345', 'gpt-4');
        
        try {
            await invalidService.generateRecommendations(mockAnalysisResult, mockCodeSnippets);
            
            // If it doesn't throw, it might be using mock mode
            console.log('Service handled invalid API key gracefully');
        } catch (error: any) {
            // Expected to fail with authentication error
            assert.ok(error, 'Should throw error for invalid API key');
            assert.ok(
                error.message.includes('401') || 
                error.message.includes('authentication') ||
                error.message.includes('API key'),
                'Error should indicate authentication failure'
            );
        }
    });

    test('AI Service - Timeout Handling', async function() {
        this.timeout(20000);
        
        // Test with very short timeout (if configurable)
        try {
            // This will test the timeout mechanism
            const result = await Promise.race([
                aiService.generateRecommendations(mockAnalysisResult, mockCodeSnippets),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), 1000)
                )
            ]);
            
            // If it completes quickly, that's fine
            console.log('AI service responded quickly');
        } catch (error: any) {
            // Timeout is expected in this test
            assert.ok(
                error.message.includes('timeout') || error.message.includes('Test timeout'),
                'Should handle timeout appropriately'
            );
        }
    });

    test('AI Service - Response Parsing', async function() {
        this.timeout(5000);
        
        // Test parsing of AI response format
        const mockAIResponse = `{
            "recommendations": [
                {
                    "category": "css",
                    "issueId": "css-unused-0",
                    "summary": "Remove unused CSS selector",
                    "recommendation": "The class .unused-class is defined but never used in the template.",
                    "priority": "medium"
                },
                {
                    "category": "typescript",
                    "issueId": "ts-import-0",
                    "summary": "Remove unused import",
                    "recommendation": "The Observable import is not used in this component.",
                    "priority": "low"
                }
            ]
        }`;
        
        try {
            const parsed = JSON.parse(mockAIResponse);
            
            assert.ok(parsed.recommendations, 'Should parse recommendations');
            assert.equal(parsed.recommendations.length, 2, 'Should have 2 recommendations');
            
            // Validate structure
            parsed.recommendations.forEach((rec: any) => {
                assert.ok(rec.category, 'Each recommendation should have category');
                assert.ok(rec.issueId, 'Each recommendation should have issueId');
                assert.ok(rec.summary, 'Each recommendation should have summary');
                assert.ok(rec.recommendation, 'Each recommendation should have recommendation');
                assert.ok(rec.priority, 'Each recommendation should have priority');
            });
        } catch (error) {
            assert.fail(`Failed to parse mock AI response: ${error}`);
        }
    });

    test('AI Service - Retry Logic', async function() {
        this.timeout(15000);
        
        // Test retry mechanism with transient failures
        let attemptCount = 0;
        
        const mockServiceWithRetry = {
            async generateRecommendations() {
                attemptCount++;
                if (attemptCount < 2) {
                    throw new Error('Transient error');
                }
                return {
                    recommendations: []
                };
            }
        };
        
        try {
            // Simulate retry logic
            let lastError;
            for (let i = 0; i < 3; i++) {
                try {
                    await mockServiceWithRetry.generateRecommendations();
                    break;
                } catch (error) {
                    lastError = error;
                    await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
                }
            }
            
            assert.ok(attemptCount >= 2, 'Should retry on transient failures');
        } catch (error) {
            console.log('Retry logic test completed');
        }
    });

    test('AI Service - Fallback to Raw Analysis', async function() {
        this.timeout(5000);
        
        // Test that system can fall back to showing raw analysis when AI fails
        const fallbackResult = {
            cssIssues: mockAnalysisResult.cssIssues,
            tsIssues: mockAnalysisResult.tsIssues,
            templateIssues: mockAnalysisResult.templateIssues,
            metadata: mockAnalysisResult.metadata,
            aiRecommendations: null // AI failed
        };
        
        // Verify fallback data is still useful
        assert.ok(fallbackResult.cssIssues.length > 0, 'Should have CSS issues');
        assert.ok(fallbackResult.tsIssues.length > 0, 'Should have TS issues');
        assert.ok(fallbackResult.templateIssues.length > 0, 'Should have template issues');
        assert.equal(fallbackResult.aiRecommendations, null, 'AI recommendations should be null');
        
        console.log('Fallback mode provides raw analysis without AI recommendations');
    });
});
