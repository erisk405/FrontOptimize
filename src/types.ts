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
    similarityResults?: SimilarityResult[];
    componentSuggestions?: ComponentSuggestion[];
    baseStyleComparison?: BaseStyleComparison;
    metadata: AnalysisMetadata;
}

export interface BaseStyleComparison {
    duplicates: DuplicateClass[];
    similarClasses: SimilarClassPair[];
}

export interface DuplicateClass {
    className: string;
    files: string[];
}

export interface SimilarClassPair {
    class1: ClassReference;
    class2: ClassReference;
    similarityPercent: number;
}

export interface ClassReference {
    name: string;
    file: string;
}

export interface BaseStyleComparisonResult {
    baseStyleComparison: BaseStyleComparison;
    metadata: {
        analyzedAt: string;
        analysisTimeMs: number;
        filesCompared: string[];
    };
}

export interface ComponentSuggestion {
    nativeElement: string;
    line: number;
    suggestedComponent: string;
    reason: string;
}

export interface SimilarityResult {
    localClass: string;
    bestMatch: {
        baseClass: string;
        baseFile: string;
        similarityPercent: number;
    };
    matchingProperties: string[];
    differingProperties: Array<{
        property: string;
        localValue: string;
        baseValue: string;
    }>;
    redundantProperties: string[];
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
