// Type definitions for the extension

export interface ComponentFiles {
    typescript: string;
    html?: string;
    css?: string;
}

export interface AnalyzerResult {
    cssIssues: CssIssue[];
    tsIssues: TypeScriptIssue[];
    templateIssues: TemplateIssue[];
    metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
    componentName: string;
    analyzedAt: string;
    analysisTimeMs: number;
    filesAnalyzed: {
        typescript: string;
        html?: string;
        css?: string;
    };
}

export interface CssIssue {
    issueType: 'UnusedSelector' | 'DuplicateRule' | 'RedundantSelector';
    selector: string;
    line: number;
    column: number;
    description: string;
}

export interface TypeScriptIssue {
    issueType: 'UnusedImport' | 'MissingAwait' | 'DuplicateLogic';
    line: number;
    column: number;
    identifier: string;
    description: string;
}

export interface TemplateIssue {
    issueType: 'DeepNesting' | 'HeavyPipe' | 'RedundantWrapper';
    line: number;
    description: string;
    severity: 'High' | 'Medium' | 'Low';
}

export interface AIRecommendation {
    category: 'css' | 'typescript' | 'template';
    issueId: string;
    summary: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    codeExample?: string;
    file?: string;
    line?: number;
    column?: number;
}
