import * as vscode from 'vscode';
import { AIRecommendation, AnalysisMetadata } from '../types';

export class ResultsPanel {
    public static currentPanel: ResultsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set up event handlers
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'goToCode':
                        this._handleGoToCode(message.file, message.line, message.column);
                        break;
                    case 'dismissIssue':
                        // Future: Handle issue dismissal
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri): ResultsPanel {
        // If we already have a panel, show it
        if (ResultsPanel.currentPanel) {
            ResultsPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            return ResultsPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'aiOptimizerResults',
            'AI Optimizer Results',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        ResultsPanel.currentPanel = new ResultsPanel(panel, extensionUri);
        return ResultsPanel.currentPanel;
    }

    public updateResults(recommendations: AIRecommendation[], metadata: AnalysisMetadata): void {
        this._panel.webview.html = this._getHtmlContent(recommendations, metadata);
    }

    public dispose(): void {
        ResultsPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async _handleGoToCode(file: string, line: number, column: number): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
            
            // Convert to 0-based indexing
            const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
            const range = new vscode.Range(position, position);
            
            // Reveal the line and select it
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private _getHtmlContent(recommendations: AIRecommendation[], metadata: AnalysisMetadata): string {
        // Group recommendations by category
        const cssRecs = recommendations.filter(r => r.category === 'css');
        const tsRecs = recommendations.filter(r => r.category === 'typescript');
        const templateRecs = recommendations.filter(r => r.category === 'template');

        // Format timestamp
        const timestamp = new Date(metadata.analyzedAt).toLocaleString();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Optimizer Results</title>
                <style>
                    ${this._getStyles()}
                </style>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1 class="title">AI Optimizer Results</h1>
                        <div class="metadata">
                            <div class="component-name">${this._escapeHtml(metadata.componentName)}</div>
                            <div class="timestamp">Analyzed: ${this._escapeHtml(timestamp)}</div>
                            <div class="analysis-time">Analysis time: ${metadata.analysisTimeMs}ms</div>
                        </div>
                    </header>

                    <div class="tabs">
                        <button class="tab-button active" data-tab="css">
                            CSS Issues <span class="badge">${cssRecs.length}</span>
                        </button>
                        <button class="tab-button" data-tab="typescript">
                            TypeScript Issues <span class="badge">${tsRecs.length}</span>
                        </button>
                        <button class="tab-button" data-tab="template">
                            Template Issues <span class="badge">${templateRecs.length}</span>
                        </button>
                    </div>

                    <div class="tab-content active" id="css-tab">
                        ${this._renderIssues(cssRecs, metadata, 'css')}
                    </div>

                    <div class="tab-content" id="typescript-tab">
                        ${this._renderIssues(tsRecs, metadata, 'typescript')}
                    </div>

                    <div class="tab-content" id="template-tab">
                        ${this._renderIssues(templateRecs, metadata, 'template')}
                    </div>
                </div>

                <script>
                    ${this._getScript()}
                </script>
            </body>
            </html>
        `;
    }

    private _renderIssues(recommendations: AIRecommendation[], metadata: AnalysisMetadata, category: string): string {
        if (recommendations.length === 0) {
            return `<div class="no-issues">No ${category} issues found! 🎉</div>`;
        }

        // Sort by priority (high -> medium -> low)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const sortedRecs = [...recommendations].sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        return sortedRecs.map(rec => this._renderIssueCard(rec, metadata)).join('');
    }

    private _renderIssueCard(rec: AIRecommendation, metadata: AnalysisMetadata): string {
        const file = rec.file || this._getFileForCategory(rec.category, metadata);
        const line = rec.line || 1;
        const column = rec.column || 1;
        const severityClass = `severity-${rec.priority}`;
        
        return `
            <div class="issue-card ${severityClass}">
                <div class="issue-header">
                    <span class="severity-badge ${severityClass}">${rec.priority.toUpperCase()}</span>
                    <span class="issue-id">${this._escapeHtml(rec.issueId)}</span>
                </div>
                <h3 class="issue-summary">${this._escapeHtml(rec.summary)}</h3>
                <p class="issue-recommendation">${this._escapeHtml(rec.recommendation)}</p>
                ${rec.codeExample ? `
                    <div class="code-example">
                        <div class="code-example-header">Suggested Fix:</div>
                        <pre><code>${this._escapeHtml(rec.codeExample)}</code></pre>
                    </div>
                ` : ''}
                <div class="issue-actions">
                    <button class="btn btn-primary go-to-code" 
                            data-file="${this._escapeHtml(file)}" 
                            data-line="${line}" 
                            data-column="${column}">
                        Go to Code
                    </button>
                </div>
            </div>
        `;
    }

    private _getFileForCategory(category: string, metadata: AnalysisMetadata): string {
        switch (category) {
            case 'css':
                return metadata.filesAnalyzed.css || '';
            case 'typescript':
                return metadata.filesAnalyzed.typescript;
            case 'template':
                return metadata.filesAnalyzed.html || '';
            default:
                return '';
        }
    }

    private _escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    private _getStyles(): string {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 0;
                margin: 0;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }

            .header {
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--vscode-foreground);
            }

            .metadata {
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
            }

            .component-name {
                font-weight: 600;
                color: var(--vscode-textLink-foreground);
            }

            .tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .tab-button {
                background: transparent;
                border: none;
                padding: 10px 16px;
                cursor: pointer;
                color: var(--vscode-foreground);
                font-size: 14px;
                font-family: var(--vscode-font-family);
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tab-button:hover {
                background-color: var(--vscode-list-hoverBackground);
            }

            .tab-button.active {
                border-bottom-color: var(--vscode-textLink-foreground);
                color: var(--vscode-textLink-foreground);
            }

            .badge {
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 12px;
                font-weight: 600;
            }

            .tab-content {
                display: none;
            }

            .tab-content.active {
                display: block;
            }

            .no-issues {
                text-align: center;
                padding: 60px 20px;
                font-size: 18px;
                color: var(--vscode-descriptionForeground);
            }

            .issue-card {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 16px;
                transition: all 0.2s;
            }

            .issue-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .issue-card.severity-high {
                border-left: 4px solid #f14c4c;
            }

            .issue-card.severity-medium {
                border-left: 4px solid #cca700;
            }

            .issue-card.severity-low {
                border-left: 4px solid #89d185;
            }

            .issue-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 12px;
            }

            .severity-badge {
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .severity-badge.severity-high {
                background-color: rgba(241, 76, 76, 0.2);
                color: #f14c4c;
            }

            .severity-badge.severity-medium {
                background-color: rgba(204, 167, 0, 0.2);
                color: #cca700;
            }

            .severity-badge.severity-low {
                background-color: rgba(137, 209, 133, 0.2);
                color: #89d185;
            }

            .issue-id {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                font-family: var(--vscode-editor-font-family);
            }

            .issue-summary {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--vscode-foreground);
            }

            .issue-recommendation {
                line-height: 1.6;
                margin-bottom: 16px;
                color: var(--vscode-foreground);
            }

            .code-example {
                background-color: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                margin-bottom: 16px;
                overflow: hidden;
            }

            .code-example-header {
                padding: 8px 12px;
                background-color: var(--vscode-editorGroupHeader-tabsBackground);
                font-size: 12px;
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
            }

            .code-example pre {
                margin: 0;
                padding: 12px;
                overflow-x: auto;
            }

            .code-example code {
                font-family: var(--vscode-editor-font-family);
                font-size: 13px;
                color: var(--vscode-editor-foreground);
            }

            .issue-actions {
                display: flex;
                gap: 10px;
            }

            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-family: var(--vscode-font-family);
                transition: all 0.2s;
            }

            .btn-primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .btn-primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            .btn-primary:active {
                transform: translateY(1px);
            }
        `;
    }

    private _getScript(): string {
        return `
            const vscode = acquireVsCodeApi();

            // Tab switching
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.getAttribute('data-tab');
                    
                    // Update active tab button
                    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                    
                    // Update active tab content
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    document.getElementById(tabName + '-tab').classList.add('active');
                });
            });

            // Go to code functionality
            document.querySelectorAll('.go-to-code').forEach(button => {
                button.addEventListener('click', () => {
                    const file = button.getAttribute('data-file');
                    const line = parseInt(button.getAttribute('data-line'));
                    const column = parseInt(button.getAttribute('data-column'));
                    
                    vscode.postMessage({
                        command: 'goToCode',
                        file: file,
                        line: line,
                        column: column
                    });
                });
            });
        `;
    }
}
