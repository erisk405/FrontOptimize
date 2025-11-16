import * as vscode from "vscode";
import {
  AIRecommendation,
  AnalysisMetadata,
  SimilarityResult,
  ComponentSuggestion,
} from "../types";

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
      (message) => {
        switch (message.command) {
          case "goToCode":
            this._handleGoToCode(message.file, message.line, message.column);
            break;
          case "goToBaseClass":
            this._handleGoToBaseClass(message.file, message.className);
            break;
          case "goToElement":
            this._handleGoToCode(message.file, message.line, 1);
            break;
          case "compareFiles":
            this._handleCompareFiles(
              message.file1,
              message.file2,
              message.class1,
              message.class2,
            );
            break;
          case "dismissIssue":
            // Future: Handle issue dismissal
            break;
        }
      },
      null,
      this._disposables,
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
      "aiOptimizerResults",
      "AI Optimizer Results",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    ResultsPanel.currentPanel = new ResultsPanel(panel, extensionUri);
    return ResultsPanel.currentPanel;
  }

  public updateResults(
    recommendations: AIRecommendation[],
    metadata: AnalysisMetadata,
    similarityResults?: SimilarityResult[],
    componentSuggestions?: ComponentSuggestion[],
    baseStyleComparison?: import("../types").BaseStyleComparisonResult,
  ): void {
    this._panel.webview.html = this._getHtmlContent(
      recommendations,
      metadata,
      similarityResults,
      componentSuggestions,
      baseStyleComparison,
    );
  }

  public updateBaseStyleComparison(
    result: import("../types").BaseStyleComparisonResult,
  ): void {
    // For backward compatibility, also support showing base style comparison in standalone view
    this._panel.webview.html = this._getBaseStyleComparisonHtml(result);
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

  private async _handleGoToCode(
    file: string,
    line: number,
    column: number,
  ): Promise<void> {
    try {
      // Validate file path
      if (!file || file.trim().length === 0) {
        vscode.window.showWarningMessage(
          "No file path available for this issue",
        );
        return;
      }

      // Check if file path looks valid (not just a directory separator)
      if (file === "\\" || file === "/" || file === ".") {
        vscode.window.showWarningMessage("Invalid file path");
        return;
      }

      const document = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.One,
      );

      // Convert to 0-based indexing
      const position = new vscode.Position(
        Math.max(0, line - 1),
        Math.max(0, column - 1),
      );
      const range = new vscode.Range(position, position);

      // Reveal the line and select it
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  private async _handleGoToBaseClass(
    file: string,
    className: string,
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.One,
      );

      // Search for the class name in the document
      const text = document.getText();
      const classPattern = new RegExp(
        `\\.${className.replace(".", "\\.")}\\s*\\{`,
        "g",
      );
      const match = classPattern.exec(text);

      if (match) {
        const position = document.positionAt(match.index);
        const range = new vscode.Range(position, position);

        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } else {
        // If exact match not found, just open the file
        vscode.window.showInformationMessage(
          `Opened ${file}, but couldn't find class ${className}`,
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  private async _handleCompareFiles(
    file1: string,
    file2: string,
    class1?: string,
    class2?: string,
  ): Promise<void> {
    try {
      // Open both files side by side
      const doc1 = await vscode.workspace.openTextDocument(file1);
      const doc2 = await vscode.workspace.openTextDocument(file2);

      // Show first file in column one
      const editor1 = await vscode.window.showTextDocument(
        doc1,
        vscode.ViewColumn.One,
      );

      // Show second file in column two
      const editor2 = await vscode.window.showTextDocument(
        doc2,
        vscode.ViewColumn.Two,
      );

      // If class names are provided, try to navigate to them
      if (class1) {
        const text1 = doc1.getText();
        const classPattern1 = new RegExp(
          `\\.${class1.replace(".", "\\.")}\\s*\\{`,
          "g",
        );
        const match1 = classPattern1.exec(text1);

        if (match1) {
          const position1 = doc1.positionAt(match1.index);
          const range1 = new vscode.Range(position1, position1);
          editor1.selection = new vscode.Selection(position1, position1);
          editor1.revealRange(range1, vscode.TextEditorRevealType.InCenter);
        }
      }

      if (class2) {
        const text2 = doc2.getText();
        const classPattern2 = new RegExp(
          `\\.${class2.replace(".", "\\.")}\\s*\\{`,
          "g",
        );
        const match2 = classPattern2.exec(text2);

        if (match2) {
          const position2 = doc2.positionAt(match2.index);
          const range2 = new vscode.Range(position2, position2);
          editor2.selection = new vscode.Selection(position2, position2);
          editor2.revealRange(range2, vscode.TextEditorRevealType.InCenter);
        }
      }

      vscode.window.showInformationMessage(
        "Files opened side by side for comparison",
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to compare files: ${error}`);
    }
  }

  private _getHtmlContent(
    recommendations: AIRecommendation[],
    metadata: AnalysisMetadata,
    similarityResults?: SimilarityResult[],
    componentSuggestions?: ComponentSuggestion[],
    baseStyleComparison?: import("../types").BaseStyleComparisonResult,
  ): string {
    // Group recommendations by category
    const cssRecs = recommendations.filter((r) => r.category === "css");
    const tsRecs = recommendations.filter((r) => r.category === "typescript");
    const templateRecs = recommendations.filter(
      (r) => r.category === "template",
    );

    // Format timestamp
    const timestamp = new Date(metadata.analyzedAt).toLocaleString();

    const hasSimilarityResults =
      similarityResults && similarityResults.length > 0;
    const hasComponentSuggestions =
      componentSuggestions && componentSuggestions.length > 0;
    const hasBaseStyleComparison =
      baseStyleComparison &&
      (baseStyleComparison.baseStyleComparison.duplicates.length > 0 ||
        baseStyleComparison.baseStyleComparison.similarClasses.length > 0);

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
                        ${
                          hasSimilarityResults
                            ? `
                        <button class="tab-button" data-tab="similarity">
                            Similarity Analysis <span class="badge">${similarityResults.length}</span>
                        </button>
                        `
                            : ""
                        }
                        ${
                          hasComponentSuggestions
                            ? `
                        <button class="tab-button" data-tab="components">
                            Component Suggestions <span class="badge">${componentSuggestions.length}</span>
                        </button>
                        `
                            : ""
                        }
                        ${
                          hasBaseStyleComparison
                            ? `
                        <button class="tab-button" data-tab="basestyle">
                            Base Style Comparison <span class="badge">${baseStyleComparison.baseStyleComparison.duplicates.length + baseStyleComparison.baseStyleComparison.similarClasses.length}</span>
                        </button>
                        `
                            : ""
                        }
                    </div>

                    <div class="tab-content active" id="css-tab">
                        ${this._renderIssues(cssRecs, metadata, "css")}
                    </div>

                    <div class="tab-content" id="typescript-tab">
                        ${this._renderIssues(tsRecs, metadata, "typescript")}
                    </div>

                    <div class="tab-content" id="template-tab">
                        ${this._renderIssues(templateRecs, metadata, "template")}
                    </div>

                    ${
                      hasSimilarityResults
                        ? `
                    <div class="tab-content" id="similarity-tab">
                        ${this._renderSimilarityResults(similarityResults, metadata)}
                    </div>
                    `
                        : ""
                    }

                    ${
                      hasComponentSuggestions
                        ? `
                    <div class="tab-content" id="components-tab">
                        ${this._renderComponentSuggestions(componentSuggestions, metadata)}
                    </div>
                    `
                        : ""
                    }

                    ${
                      hasBaseStyleComparison
                        ? `
                    <div class="tab-content" id="basestyle-tab">
                        ${this._renderBaseStyleComparisonTab(baseStyleComparison)}
                    </div>
                    `
                        : ""
                    }
                </div>

                <script>
                    ${this._getScript()}
                </script>
            </body>
            </html>
        `;
  }

  private _renderIssues(
    recommendations: AIRecommendation[],
    metadata: AnalysisMetadata,
    category: string,
  ): string {
    if (recommendations.length === 0) {
      return `<div class="no-issues">No ${category} issues found! 🎉</div>`;
    }

    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedRecs = [...recommendations].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    return sortedRecs
      .map((rec) => this._renderIssueCard(rec, metadata))
      .join("");
  }

  private _renderIssueCard(
    rec: AIRecommendation,
    metadata: AnalysisMetadata,
  ): string {
    const file = rec.file || this._getFileForCategory(rec.category, metadata);
    const line = rec.line || 1;
    const column = rec.column || 1;
    const severityClass = `severity-${rec.priority}`;
    const hasValidFile = file && file.trim().length > 0;

    return `
            <div class="issue-card ${severityClass}">
                <div class="issue-header">
                    <span class="severity-badge ${severityClass}">${rec.priority.toUpperCase()}</span>
                    <span class="issue-id">${this._escapeHtml(rec.issueId)}</span>
                </div>
                <h3 class="issue-summary">${this._escapeHtml(rec.summary)}</h3>
                <p class="issue-recommendation">${this._escapeHtml(rec.recommendation)}</p>
                ${
                  rec.codeExample
                    ? `
                    <div class="code-example">
                        <div class="code-example-header">Suggested Fix:</div>
                        <pre><code>${this._escapeHtml(rec.codeExample)}</code></pre>
                    </div>
                `
                    : ""
                }
                ${
                  hasValidFile
                    ? `
                <div class="issue-actions">
                    <button class="btn btn-primary go-to-code"
                            data-file="${this._escapeHtml(file)}"
                            data-line="${line}"
                            data-column="${column}">
                        Go to Code
                    </button>
                </div>
                `
                    : ""
                }
            </div>
        `;
  }

  private _getFileForCategory(
    category: string,
    metadata: AnalysisMetadata,
  ): string {
    if (!metadata.filesAnalyzed) {
      return "";
    }

    switch (category) {
      case "css":
        return metadata.filesAnalyzed.css || "";
      case "typescript":
        return metadata.filesAnalyzed.typescript || "";
      case "template":
        return metadata.filesAnalyzed.html || "";
      default:
        return "";
    }
  }

  private _renderSimilarityResults(
    results: SimilarityResult[],
    metadata: AnalysisMetadata,
  ): string {
    if (results.length === 0) {
      return `<div class="no-issues">No similar classes found in base styles.</div>`;
    }

    // Sort by similarity percentage (highest first)
    const sortedResults = [...results].sort(
      (a, b) => b.bestMatch.similarityPercent - a.bestMatch.similarityPercent,
    );

    return sortedResults
      .map((result) => this._renderSimilarityCard(result, metadata))
      .join("");
  }

  private _renderSimilarityCard(
    result: SimilarityResult,
    metadata: AnalysisMetadata,
  ): string {
    const similarityPercent = result.bestMatch.similarityPercent.toFixed(1);
    const cssFile = metadata.filesAnalyzed.css || "";

    // Determine similarity level for styling
    let similarityClass = "similarity-low";
    if (result.bestMatch.similarityPercent >= 80) {
      similarityClass = "similarity-high";
    } else if (result.bestMatch.similarityPercent >= 50) {
      similarityClass = "similarity-medium";
    }

    return `
            <div class="similarity-card ${similarityClass}">
                <div class="similarity-header">
                    <div class="class-comparison">
                        <span class="local-class">${this._escapeHtml(result.localClass)}</span>
                        <span class="similarity-arrow">→</span>
                        <span class="base-class">${this._escapeHtml(result.bestMatch.baseClass)}</span>
                    </div>
                    <div class="similarity-percent">
                        <div class="progress-bar">
                            <div class="progress-fill ${similarityClass}" style="width: ${similarityPercent}%"></div>
                        </div>
                        <span class="percent-text">${similarityPercent}% similar</span>
                    </div>
                </div>

                <div class="base-file-info">
                    <span class="label">Base Style:</span>
                    <span class="file-path">${this._escapeHtml(result.bestMatch.baseFile)}</span>
                </div>

                ${
                  result.matchingProperties.length > 0
                    ? `
                <div class="property-section">
                    <div class="property-header matching">
                        <span class="property-icon">✓</span>
                        <span>Matching Properties (${result.matchingProperties.length})</span>
                    </div>
                    <div class="property-list matching">
                        ${result.matchingProperties
                          .map(
                            (prop) =>
                              `<div class="property-item">
                                <span class="property-icon-small">✓</span>
                                <span>${this._escapeHtml(prop)}</span>
                            </div>`,
                          )
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }

                ${
                  result.differingProperties.length > 0
                    ? `
                <div class="property-section">
                    <div class="property-header differing">
                        <span class="property-icon">⚠</span>
                        <span>Differing Properties (${result.differingProperties.length})</span>
                    </div>
                    <div class="property-list differing">
                        ${result.differingProperties
                          .map(
                            (diff) => `
                            <div class="property-diff">
                                <div class="property-name">
                                    <span class="property-icon-small">⚠</span>
                                    <span>${this._escapeHtml(diff.property)}</span>
                                </div>
                                <div class="value-comparison">
                                    <span class="local-value">
                                        <span class="value-label">Local:</span> ${this._escapeHtml(diff.localValue)}
                                    </span>
                                    <span class="base-value">
                                        <span class="value-label">Base:</span> ${this._escapeHtml(diff.baseValue)}
                                    </span>
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }

                ${
                  result.redundantProperties.length > 0
                    ? `
                <div class="property-section">
                    <div class="property-header redundant">
                        <span class="property-icon">✗</span>
                        <span>Redundant Properties (${result.redundantProperties.length})</span>
                    </div>
                    <div class="property-list redundant">
                        ${result.redundantProperties
                          .map(
                            (prop) =>
                              `<div class="property-item">
                                <span class="property-icon-small">✗</span>
                                <span>${this._escapeHtml(prop)}</span>
                            </div>`,
                          )
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }

                <div class="similarity-actions">
                    <button class="btn btn-secondary go-to-base-class"
                            data-file="${this._escapeHtml(cssFile)}"
                            data-class="${this._escapeHtml(result.localClass)}">
                        Go to Local Class
                    </button>
                    <button class="btn btn-primary go-to-base-class"
                            data-file="${this._escapeHtml(result.bestMatch.baseFile)}"
                            data-class="${this._escapeHtml(result.bestMatch.baseClass)}">
                        Go to Base Class
                    </button>
                </div>
            </div>
        `;
  }

  private _renderComponentSuggestions(
    suggestions: ComponentSuggestion[],
    metadata: AnalysisMetadata,
  ): string {
    if (suggestions.length === 0) {
      return `<div class="no-issues">No component suggestions found. All elements are using design system components! 🎉</div>`;
    }

    // Sort by line number
    const sortedSuggestions = [...suggestions].sort((a, b) => a.line - b.line);

    return sortedSuggestions
      .map((suggestion) =>
        this._renderComponentSuggestionCard(suggestion, metadata),
      )
      .join("");
  }

  private _renderComponentSuggestionCard(
    suggestion: ComponentSuggestion,
    metadata: AnalysisMetadata,
  ): string {
    const htmlFile = metadata.filesAnalyzed.html || "";

    return `
            <div class="component-suggestion-card">
                <div class="suggestion-header">
                    <span class="element-badge">&lt;${this._escapeHtml(suggestion.nativeElement)}&gt;</span>
                    <span class="line-number">Line ${suggestion.line}</span>
                </div>

                <div class="suggestion-content">
                    <div class="suggestion-reason">
                        ${this._escapeHtml(suggestion.reason)}
                    </div>

                    <div class="code-comparison">
                        <div class="code-comparison-section">
                            <div class="code-comparison-label before">Current (Native Element)</div>
                            <div class="code-comparison-code">
                                <code>&lt;${this._escapeHtml(suggestion.nativeElement)}&gt;...&lt;/${this._escapeHtml(suggestion.nativeElement)}&gt;</code>
                            </div>
                        </div>

                        <div class="code-comparison-arrow">→</div>

                        <div class="code-comparison-section">
                            <div class="code-comparison-label after">Suggested (Design System)</div>
                            <div class="code-comparison-code">
                                <code>&lt;${this._escapeHtml(suggestion.suggestedComponent)}&gt;...&lt;/${this._escapeHtml(suggestion.suggestedComponent)}&gt;</code>
                            </div>
                        </div>
                    </div>

                    <div class="suggestion-benefits">
                        <div class="benefits-title">Benefits of using ${this._escapeHtml(suggestion.suggestedComponent)}:</div>
                        <ul class="benefits-list">
                            <li>Consistent styling across the application</li>
                            <li>Built-in accessibility features</li>
                            <li>Reduced maintenance overhead</li>
                            <li>Automatic theme support</li>
                        </ul>
                    </div>
                </div>

                <div class="suggestion-actions">
                    <button class="btn btn-primary go-to-element"
                            data-file="${this._escapeHtml(htmlFile)}"
                            data-line="${suggestion.line}">
                        Go to Element
                    </button>
                </div>
            </div>
        `;
  }

  private _renderBaseStyleComparisonTab(
    result: import("../types").BaseStyleComparisonResult,
  ): string {
    const { duplicates, similarClasses } = result.baseStyleComparison;

    let content = '<div class="basestyle-comparison-container">';

    // Render duplicates section
    if (duplicates.length > 0) {
      content += `
                <div class="comparison-section">
                    <h2 class="section-title">Duplicate Classes (${duplicates.length})</h2>
                    <p class="section-description">Classes with identical names found in multiple files</p>
                    ${duplicates.map((dup) => this._renderDuplicateClassCard(dup)).join("")}
                </div>
            `;
    }

    // Render similar classes section
    if (similarClasses.length > 0) {
      content += `
                <div class="comparison-section">
                    <h2 class="section-title">Similar Classes (${similarClasses.length})</h2>
                    <p class="section-description">Classes with different names but similar properties</p>
                    ${similarClasses.map((pair) => this._renderSimilarClassPairCard(pair)).join("")}
                </div>
            `;
    }

    if (duplicates.length === 0 && similarClasses.length === 0) {
      content +=
        '<div class="no-issues">No duplicate or similar classes found! 🎉</div>';
    }

    content += "</div>";
    return content;
  }

  private _renderDuplicateClassCard(
    duplicate: import("../types").DuplicateClass,
  ): string {
    return `
            <div class="basestyle-card duplicate-card">
                <div class="basestyle-header">
                    <span class="severity-badge severity-high">DUPLICATE</span>
                    <span class="class-name">${this._escapeHtml(duplicate.className)}</span>
                </div>
                <div class="basestyle-content">
                    <p class="duplicate-description">
                        This class appears in ${duplicate.files.length} different files.
                        Consider consolidating to a single location to avoid conflicts.
                    </p>
                    <div class="file-list">
                        <div class="file-list-header">Found in:</div>
                        ${duplicate.files
                          .map(
                            (file) => `
                            <div class="file-list-item">
                                <code class="file-path">${this._escapeHtml(file)}</code>
                                <button class="btn btn-secondary go-to-base-class"
                                        data-file="${this._escapeHtml(file)}"
                                        data-class="${this._escapeHtml(duplicate.className)}">
                                    Open File
                                </button>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            </div>
        `;
  }

  private _renderSimilarClassPairCard(
    pair: import("../types").SimilarClassPair,
  ): string {
    const similarityPercent = pair.similarityPercent.toFixed(1);

    // Determine similarity level for styling
    let similarityClass = "similarity-low";
    if (pair.similarityPercent >= 90) {
      similarityClass = "similarity-high";
    } else if (pair.similarityPercent >= 80) {
      similarityClass = "similarity-medium";
    }

    return `
            <div class="basestyle-card similar-card ${similarityClass}">
                <div class="basestyle-header">
                    <div class="similarity-badge-container">
                        <div class="progress-bar">
                            <div class="progress-fill ${similarityClass}" style="width: ${similarityPercent}%"></div>
                        </div>
                        <span class="percent-text">${similarityPercent}% similar</span>
                    </div>
                </div>
                <div class="basestyle-content">
                    <div class="class-pair-comparison">
                        <div class="class-pair-item">
                            <div class="class-pair-name">${this._escapeHtml(pair.class1.name)}</div>
                            <div class="class-pair-file">${this._escapeHtml(pair.class1.file)}</div>
                            <button class="btn btn-secondary go-to-base-class"
                                    data-file="${this._escapeHtml(pair.class1.file)}"
                                    data-class="${this._escapeHtml(pair.class1.name)}">
                                Open File
                            </button>
                        </div>
                        <div class="class-pair-arrow">↔</div>
                        <div class="class-pair-item">
                            <div class="class-pair-name">${this._escapeHtml(pair.class2.name)}</div>
                            <div class="class-pair-file">${this._escapeHtml(pair.class2.file)}</div>
                            <button class="btn btn-secondary go-to-base-class"
                                    data-file="${this._escapeHtml(pair.class2.file)}"
                                    data-class="${this._escapeHtml(pair.class2.name)}">
                                Open File
                            </button>
                        </div>
                    </div>
                    <div class="comparison-actions">
                        <button class="btn btn-primary compare-files-btn"
                                data-file1="${this._escapeHtml(pair.class1.file)}"
                                data-file2="${this._escapeHtml(pair.class2.file)}"
                                data-class1="${this._escapeHtml(pair.class1.name)}"
                                data-class2="${this._escapeHtml(pair.class2.name)}">
                            Compare Files Side by Side
                        </button>
                    </div>
                    <p class="similar-description">
                        These classes share ${similarityPercent}% of their properties.
                        Consider consolidating them or using a common base class.
                    </p>
                </div>
            </div>
        `;
  }

  private _escapeHtml(text: string | undefined | null): string {
    if (!text) {
      return "";
    }

    const map: { [key: string]: string } = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "&": "&amp;",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "<": "&lt;",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ">": "&gt;",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '"': "&quot;",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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

            .btn-secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .btn-secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            /* Similarity Analysis Styles */
            .similarity-card {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 16px;
                transition: all 0.2s;
            }

            .similarity-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .similarity-card.similarity-high {
                border-left: 4px solid #89d185;
            }

            .similarity-card.similarity-medium {
                border-left: 4px solid #cca700;
            }

            .similarity-card.similarity-low {
                border-left: 4px solid #858585;
            }

            .similarity-header {
                margin-bottom: 16px;
            }

            .class-comparison {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                font-size: 16px;
                font-weight: 600;
            }

            .local-class {
                color: var(--vscode-textLink-foreground);
                font-family: var(--vscode-editor-font-family);
            }

            .similarity-arrow {
                color: var(--vscode-descriptionForeground);
            }

            .base-class {
                color: #89d185;
                font-family: var(--vscode-editor-font-family);
            }

            .similarity-percent {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .progress-bar {
                flex: 1;
                height: 8px;
                background-color: var(--vscode-editorWidget-background);
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                transition: width 0.3s ease;
            }

            .progress-fill.similarity-high {
                background-color: #89d185;
            }

            .progress-fill.similarity-medium {
                background-color: #cca700;
            }

            .progress-fill.similarity-low {
                background-color: #858585;
            }

            .percent-text {
                font-size: 14px;
                font-weight: 600;
                min-width: 80px;
                text-align: right;
                padding: 4px 10px;
                border-radius: 4px;
                background-color: var(--vscode-textCodeBlock-background);
            }

            .similarity-high .percent-text {
                color: #89d185;
                border: 1px solid #89d185;
            }

            .similarity-medium .percent-text {
                color: #cca700;
                border: 1px solid #cca700;
            }

            .similarity-low .percent-text {
                color: #858585;
                border: 1px solid #858585;
            }

            .base-file-info {
                margin-bottom: 16px;
                padding: 8px 12px;
                background-color: var(--vscode-textCodeBlock-background);
                border-radius: 4px;
                font-size: 12px;
            }

            .base-file-info .label {
                color: var(--vscode-descriptionForeground);
                margin-right: 8px;
            }

            .base-file-info .file-path {
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-foreground);
            }

            .property-section {
                margin-bottom: 16px;
            }

            .property-header {
                padding: 8px 12px;
                font-size: 13px;
                font-weight: 600;
                border-radius: 4px 4px 0 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .property-header.matching {
                background-color: rgba(137, 209, 133, 0.2);
                color: #89d185;
            }

            .property-header.differing {
                background-color: rgba(204, 167, 0, 0.2);
                color: #cca700;
            }

            .property-header.redundant {
                background-color: rgba(241, 76, 76, 0.2);
                color: #f14c4c;
            }

            .property-icon {
                font-size: 16px;
                font-weight: bold;
            }

            .property-list {
                border: 1px solid var(--vscode-panel-border);
                border-top: none;
                border-radius: 0 0 4px 4px;
                padding: 8px;
                max-height: 200px;
                overflow-y: auto;
            }

            .property-item {
                padding: 4px 8px;
                font-family: var(--vscode-editor-font-family);
                font-size: 12px;
                color: var(--vscode-foreground);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .property-icon-small {
                font-size: 12px;
                opacity: 0.7;
            }

            .property-diff {
                padding: 8px;
                margin-bottom: 8px;
                background-color: var(--vscode-textCodeBlock-background);
                border-radius: 4px;
            }

            .property-diff:last-child {
                margin-bottom: 0;
            }

            .property-name {
                font-weight: 600;
                margin-bottom: 4px;
                font-family: var(--vscode-editor-font-family);
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .value-comparison {
                display: flex;
                gap: 16px;
                font-size: 11px;
                font-family: var(--vscode-editor-font-family);
                margin-left: 18px;
            }

            .local-value {
                color: var(--vscode-textLink-foreground);
                padding: 4px 8px;
                background-color: rgba(86, 156, 214, 0.1);
                border-radius: 3px;
            }

            .base-value {
                color: #89d185;
                padding: 4px 8px;
                background-color: rgba(137, 209, 133, 0.1);
                border-radius: 3px;
            }

            .value-label {
                font-weight: 600;
                opacity: 0.8;
            }

            .similarity-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            /* Component Suggestion Styles */
            .component-suggestion-card {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-left: 4px solid #569cd6;
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 16px;
                transition: all 0.2s;
            }

            .component-suggestion-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .suggestion-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .element-badge {
                background-color: rgba(86, 156, 214, 0.2);
                color: #569cd6;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 600;
                font-family: var(--vscode-editor-font-family);
            }

            .line-number {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                font-family: var(--vscode-editor-font-family);
            }

            .suggestion-content {
                margin-bottom: 16px;
            }

            .suggestion-reason {
                margin-bottom: 16px;
                line-height: 1.6;
                color: var(--vscode-foreground);
            }

            .code-comparison {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                padding: 16px;
                background-color: var(--vscode-textCodeBlock-background);
                border-radius: 4px;
            }

            .code-comparison-section {
                flex: 1;
            }

            .code-comparison-label {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }

            .code-comparison-label.before {
                color: #cca700;
            }

            .code-comparison-label.after {
                color: #89d185;
            }

            .code-comparison-code {
                padding: 8px 12px;
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
            }

            .code-comparison-code code {
                font-family: var(--vscode-editor-font-family);
                font-size: 13px;
                color: var(--vscode-editor-foreground);
            }

            .code-comparison-arrow {
                font-size: 24px;
                color: var(--vscode-descriptionForeground);
                flex-shrink: 0;
            }

            .suggestion-benefits {
                padding: 12px;
                background-color: rgba(137, 209, 133, 0.1);
                border-left: 3px solid #89d185;
                border-radius: 4px;
            }

            .benefits-title {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--vscode-foreground);
            }

            .benefits-list {
                margin: 0;
                padding-left: 20px;
                font-size: 13px;
                line-height: 1.8;
                color: var(--vscode-foreground);
            }

            .benefits-list li {
                margin-bottom: 4px;
            }

            .suggestion-actions {
                display: flex;
                gap: 10px;
            }

            /* Base Style Comparison Styles */
            .basestyle-comparison-container {
                padding: 0;
            }

            .comparison-section {
                margin-bottom: 32px;
            }

            .section-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--vscode-foreground);
            }

            .section-description {
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 16px;
            }

            .basestyle-card {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 16px;
                transition: all 0.2s;
            }

            .basestyle-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .duplicate-card {
                border-left: 4px solid #f14c4c;
            }

            .similar-card.similarity-high {
                border-left: 4px solid #f14c4c;
            }

            .similar-card.similarity-medium {
                border-left: 4px solid #cca700;
            }

            .similar-card.similarity-low {
                border-left: 4px solid #858585;
            }

            .basestyle-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .class-name {
                font-size: 16px;
                font-weight: 600;
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-textLink-foreground);
            }

            .basestyle-content {
                color: var(--vscode-foreground);
            }

            .duplicate-description,
            .similar-description {
                margin-bottom: 16px;
                line-height: 1.6;
            }

            .file-list {
                background-color: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: 12px;
            }

            .file-list-header {
                font-size: 12px;
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 8px;
            }

            .file-list-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px;
                margin-bottom: 8px;
                background-color: var(--vscode-editor-background);
                border-radius: 4px;
            }

            .file-list-item:last-child {
                margin-bottom: 0;
            }

            .file-path {
                font-family: var(--vscode-editor-font-family);
                font-size: 12px;
                color: var(--vscode-foreground);
                flex: 1;
            }

            .similarity-badge-container {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }

            .class-pair-comparison {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 16px;
                padding: 16px;
                background-color: var(--vscode-textCodeBlock-background);
                border-radius: 4px;
            }

            .class-pair-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .class-pair-name {
                font-size: 15px;
                font-weight: 600;
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-textLink-foreground);
            }

            .class-pair-file {
                font-size: 11px;
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-descriptionForeground);
                word-break: break-all;
            }

            .class-pair-arrow {
                font-size: 24px;
                color: var(--vscode-descriptionForeground);
                flex-shrink: 0;
            }

            .comparison-actions {
                display: flex;
                justify-content: center;
                margin: 16px 0;
            }

            .compare-files-btn {
                display: flex;
                align-items: center;
                gap: 8px;
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

            // Go to base class functionality
            document.querySelectorAll('.go-to-base-class').forEach(button => {
                button.addEventListener('click', () => {
                    const file = button.getAttribute('data-file');
                    const className = button.getAttribute('data-class');

                    vscode.postMessage({
                        command: 'goToBaseClass',
                        file: file,
                        className: className
                    });
                });
            });

            // Go to element functionality
            document.querySelectorAll('.go-to-element').forEach(button => {
                button.addEventListener('click', () => {
                    const file = button.getAttribute('data-file');
                    const line = parseInt(button.getAttribute('data-line'));

                    vscode.postMessage({
                        command: 'goToElement',
                        file: file,
                        line: line
                    });
                });
            });

            // Compare files functionality
            document.querySelectorAll('.compare-files-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const file1 = button.getAttribute('data-file1');
                    const file2 = button.getAttribute('data-file2');
                    const class1 = button.getAttribute('data-class1');
                    const class2 = button.getAttribute('data-class2');

                    vscode.postMessage({
                        command: 'compareFiles',
                        file1: file1,
                        file2: file2,
                        class1: class1,
                        class2: class2
                    });
                });
            });
        `;
  }

  private _getBaseStyleComparisonHtml(
    result: import("../types").BaseStyleComparisonResult,
  ): string {
    const timestamp = new Date(result.metadata.analyzedAt).toLocaleString();
    const { duplicates, similarClasses } = result.baseStyleComparison;

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Base Style Comparison</title>
                <style>
                    ${this._getStyles()}
                </style>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1 class="title">Base Style Comparison</h1>
                        <div class="metadata">
                            <div class="timestamp">Analyzed: ${this._escapeHtml(timestamp)}</div>
                            <div class="analysis-time">Analysis time: ${result.metadata.analysisTimeMs}ms</div>
                            <div class="files-compared">Files compared: ${result.metadata.filesCompared.length}</div>
                        </div>
                    </header>

                    <div class="tabs">
                        <button class="tab-button active" data-tab="duplicates">
                            Duplicate Classes <span class="badge">${duplicates.length}</span>
                        </button>
                        <button class="tab-button" data-tab="similar">
                            Similar Classes <span class="badge">${similarClasses.length}</span>
                        </button>
                        <button class="tab-button" data-tab="files">
                            Files <span class="badge">${result.metadata.filesCompared.length}</span>
                        </button>
                    </div>

                    <div class="tab-content active" id="duplicates-tab">
                        ${this._renderDuplicateClasses(duplicates)}
                    </div>

                    <div class="tab-content" id="similar-tab">
                        ${this._renderSimilarClasses(similarClasses)}
                    </div>

                    <div class="tab-content" id="files-tab">
                        ${this._renderComparedFiles(result.metadata.filesCompared)}
                    </div>
                </div>

                <script>
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

                    // Handle go to file buttons
                    document.querySelectorAll('.go-to-file-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            const file = button.getAttribute('data-file');
                            const className = button.getAttribute('data-class');
                            vscode.postMessage({
                                command: 'goToBaseClass',
                                file: file,
                                className: className
                            });
                        });
                    });
                </script>
            </body>
            </html>
        `;
  }

  private _renderDuplicateClasses(
    duplicates: import("../types").DuplicateClass[],
  ): string {
    if (duplicates.length === 0) {
      return '<div class="empty-state">No duplicate classes found across the compared files.</div>';
    }

    return `
            <div class="issues-container">
                <div class="section-header">
                    <h2>Duplicate Classes</h2>
                    <p class="section-description">Classes with identical names found in multiple files</p>
                </div>
                ${duplicates
                  .map(
                    (dup) => `
                    <div class="issue-card duplicate-card">
                        <div class="issue-header">
                            <span class="severity-badge high">Duplicate</span>
                            <h3 class="issue-title">${this._escapeHtml(dup.className)}</h3>
                        </div>
                        <div class="issue-body">
                            <p class="issue-description">
                                This class appears in ${dup.files.length} different files.
                                Consider consolidating to a single location to avoid conflicts.
                            </p>
                            <div class="file-list">
                                <strong>Found in:</strong>
                                <ul>
                                    ${dup.files
                                      .map(
                                        (file) => `
                                        <li>
                                            <code>${this._escapeHtml(file)}</code>
                                            <button class="go-to-file-btn"
                                                    data-file="${this._escapeHtml(file)}"
                                                    data-class="${this._escapeHtml(dup.className)}">
                                                Open File
                                            </button>
                                        </li>
                                    `,
                                      )
                                      .join("")}
                                </ul>
                            </div>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
  }

  private _renderSimilarClasses(
    similarClasses: import("../types").SimilarClassPair[],
  ): string {
    if (similarClasses.length === 0) {
      return '<div class="empty-state">No similar classes found above the similarity threshold.</div>';
    }

    return `
            <div class="issues-container">
                <div class="section-header">
                    <h2>Similar Classes</h2>
                    <p class="section-description">Classes with different names but similar properties across files</p>
                </div>
                ${similarClasses
                  .map((pair) => {
                    const severityClass =
                      pair.similarityPercent >= 90
                        ? "high"
                        : pair.similarityPercent >= 80
                          ? "medium"
                          : "low";
                    return `
                        <div class="issue-card similarity-card">
                            <div class="issue-header">
                                <span class="severity-badge ${severityClass}">${pair.similarityPercent.toFixed(1)}% Similar</span>
                                <h3 class="issue-title">Similar Classes Detected</h3>
                            </div>
                            <div class="issue-body">
                                <div class="similarity-comparison">
                                    <div class="class-reference">
                                        <strong>${this._escapeHtml(pair.class1.name)}</strong>
                                        <div class="file-path">${this._escapeHtml(pair.class1.file)}</div>
                                        <button class="go-to-file-btn"
                                                data-file="${this._escapeHtml(pair.class1.file)}"
                                                data-class="${this._escapeHtml(pair.class1.name)}">
                                            Open File
                                        </button>
                                    </div>
                                    <div class="similarity-arrow">↔</div>
                                    <div class="class-reference">
                                        <strong>${this._escapeHtml(pair.class2.name)}</strong>
                                        <div class="file-path">${this._escapeHtml(pair.class2.file)}</div>
                                        <button class="go-to-file-btn"
                                                data-file="${this._escapeHtml(pair.class2.file)}"
                                                data-class="${this._escapeHtml(pair.class2.name)}">
                                            Open File
                                        </button>
                                    </div>
                                </div>
                                <div class="similarity-bar-container">
                                    <div class="similarity-bar" style="width: ${pair.similarityPercent}%"></div>
                                </div>
                                <p class="issue-description">
                                    These classes share ${pair.similarityPercent.toFixed(1)}% of their properties.
                                    Consider consolidating them or using a common base class.
                                </p>
                            </div>
                        </div>
                    `;
                  })
                  .join("")}
            </div>
        `;
  }

  private _renderComparedFiles(files: string[]): string {
    return `
            <div class="issues-container">
                <div class="section-header">
                    <h2>Compared Files</h2>
                    <p class="section-description">List of all files included in this comparison</p>
                </div>
                <div class="file-list-container">
                    <ul class="compared-files-list">
                        ${files
                          .map(
                            (file, index) => `
                            <li class="file-item">
                                <span class="file-number">${index + 1}</span>
                                <code class="file-path">${this._escapeHtml(file)}</code>
                                <button class="go-to-file-btn"
                                        data-file="${this._escapeHtml(file)}"
                                        data-class="">
                                    Open File
                                </button>
                            </li>
                        `,
                          )
                          .join("")}
                    </ul>
                </div>
            </div>
        `;
  }
}
