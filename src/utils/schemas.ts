import { z } from "zod";

/**
 * Schema definitions for runtime validation
 */

// Base issue schemas
export const CssIssueSchema = z.object({
  issueType: z.string(),
  line: z.number(),
  column: z.number(),
  selector: z.string(),
  description: z.string(),
});

export const TsIssueSchema = z.object({
  issueType: z.string(),
  line: z.number(),
  column: z.number(),
  identifier: z.string(),
  description: z.string(),
});

export const TemplateIssueSchema = z.object({
  issueType: z.string(),
  line: z.number(),
  description: z.string(),
  severity: z.enum(["High", "Medium", "Low"]),
});

// Files analyzed schema
export const FilesAnalyzedSchema = z.object({
  typescript: z.string(),
  html: z.string().optional(),
  css: z.string().optional(),
});

// Metadata schema
export const AnalysisMetadataSchema = z.object({
  componentName: z.string(),
  analyzedAt: z.string(),
  analysisTimeMs: z.number(),
  filesAnalyzed: FilesAnalyzedSchema,
});

// Analyzer result schema
export const AnalyzerResultSchema = z.object({
  cssIssues: z.array(CssIssueSchema),
  tsIssues: z.array(TsIssueSchema),
  templateIssues: z.array(TemplateIssueSchema),
  metadata: AnalysisMetadataSchema,
});

// AI Recommendation schema
export const AIRecommendationSchema = z.object({
  category: z.enum(["css", "typescript", "template"]),
  issueId: z.string(),
  summary: z.string().min(1).max(200),
  recommendation: z.string().min(1).max(500),
  priority: z.enum(["high", "medium", "low"]),
  codeExample: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
});

export const AIRecommendationsArraySchema = z.array(AIRecommendationSchema);

// Similarity result schema
export const SimilarityResultSchema = z.object({
  currentClass: z.string(),
  similarClass: z.string(),
  similarity: z.number().min(0).max(100),
  file: z.string(),
  line: z.number(),
  suggestion: z.string(),
});

// Component suggestion schema
export const ComponentSuggestionSchema = z.object({
  pattern: z.string(),
  suggestedComponent: z.string(),
  reason: z.string(),
  file: z.string(),
  line: z.number(),
  confidence: z.number().min(0).max(100),
});

// Base style comparison schemas
export const DuplicateClassSchema = z.object({
  className: z.string(),
  files: z.array(z.string()),
  properties: z.record(z.string(), z.string()),
});

export const SimilarClassPairSchema = z.object({
  class1: z.object({
    className: z.string(),
    file: z.string(),
  }),
  class2: z.object({
    className: z.string(),
    file: z.string(),
  }),
  similarity: z.number().min(0).max(100),
  commonProperties: z.array(z.string()),
  suggestion: z.string(),
});

export const BaseStyleComparisonSchema = z.object({
  duplicates: z.array(DuplicateClassSchema),
  similarClasses: z.array(SimilarClassPairSchema),
  analyzedFiles: z.array(z.string()),
  totalClasses: z.number(),
  analysisTime: z.number(),
});

export const BaseStyleComparisonResultSchema = z.object({
  baseStyleComparison: BaseStyleComparisonSchema,
});

/**
 * Type exports
 */
export type CssIssue = z.infer<typeof CssIssueSchema>;
export type TsIssue = z.infer<typeof TsIssueSchema>;
export type TemplateIssue = z.infer<typeof TemplateIssueSchema>;
export type FilesAnalyzed = z.infer<typeof FilesAnalyzedSchema>;
export type AnalysisMetadata = z.infer<typeof AnalysisMetadataSchema>;
export type AnalyzerResult = z.infer<typeof AnalyzerResultSchema>;
export type AIRecommendation = z.infer<typeof AIRecommendationSchema>;
export type SimilarityResult = z.infer<typeof SimilarityResultSchema>;
export type ComponentSuggestion = z.infer<typeof ComponentSuggestionSchema>;
export type DuplicateClass = z.infer<typeof DuplicateClassSchema>;
export type SimilarClassPair = z.infer<typeof SimilarClassPairSchema>;
export type BaseStyleComparison = z.infer<typeof BaseStyleComparisonSchema>;
export type BaseStyleComparisonResult = z.infer<
  typeof BaseStyleComparisonResultSchema
>;

/**
 * Validation helpers
 */
export function validateAnalyzerResult(data: unknown): AnalyzerResult {
  const result = AnalyzerResultSchema.safeParse(data);
  if (!result.success) {
    throw new Error("Validation failed");
  }
  return result.data;
}

export function validateAIRecommendations(data: unknown): AIRecommendation[] {
  const result = AIRecommendationsArraySchema.safeParse(data);
  if (!result.success) {
    throw new Error("Validation failed");
  }
  return result.data;
}

/**
 * Safe validation that returns Result type
 */
import { Result, Ok, Err } from "./result";
import { ValidationError } from "./errors";

export function safeValidateAnalyzerResult(
  data: unknown,
): Result<AnalyzerResult, ValidationError> {
  const result = AnalyzerResultSchema.safeParse(data);
  if (result.success) {
    return Ok(result.data);
  }

  const message = result.error.issues
    .map((e: any) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
  return Err(new ValidationError(message));
}

export function safeValidateAIRecommendations(
  data: unknown,
): Result<AIRecommendation[], ValidationError> {
  const result = AIRecommendationsArraySchema.safeParse(data);
  if (result.success) {
    return Ok(result.data);
  }

  const message = result.error.issues
    .map((e: any) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
  return Err(new ValidationError(message));
}

/**
 * Transform snake_case to camelCase for analyzer results
 */
export function normalizeAnalyzerOutput(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  const normalized: any = {};

  // Handle snake_case to camelCase conversion
  if (data.css_issues !== undefined) {
    normalized.cssIssues = data.css_issues;
  } else if (data.cssIssues !== undefined) {
    normalized.cssIssues = data.cssIssues;
  }

  if (data.ts_issues !== undefined) {
    normalized.tsIssues = data.ts_issues;
  } else if (data.tsIssues !== undefined) {
    normalized.tsIssues = data.tsIssues;
  }

  if (data.template_issues !== undefined) {
    normalized.templateIssues = data.template_issues;
  } else if (data.templateIssues !== undefined) {
    normalized.templateIssues = data.templateIssues;
  }

  if (data.metadata !== undefined) {
    normalized.metadata = data.metadata;
  }

  // Provide defaults if fields are missing
  normalized.cssIssues = normalized.cssIssues || [];
  normalized.tsIssues = normalized.tsIssues || [];
  normalized.templateIssues = normalized.templateIssues || [];

  return normalized;
}
