use clap::Parser;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::PathBuf;

mod css;
mod html;
mod ts;
mod yaml_config;

#[derive(Parser, Debug)]
#[command(name = "angular-analyzer")]
#[command(about = "Analyzes Angular component files for optimization opportunities")]
struct Args {
    /// Path to TypeScript component file
    #[arg(short, long)]
    ts_file: Option<PathBuf>,

    /// Path to HTML template file
    #[arg(short = 'H', long)]
    html_file: Option<PathBuf>,

    /// Path to CSS stylesheet file
    #[arg(short, long)]
    css_file: Option<PathBuf>,

    /// Maximum allowed nesting depth for loops (default: 2)
    #[arg(short = 'd', long, default_value = "2")]
    max_nesting_depth: usize,

    /// Base style files for similarity comparison (comma-separated paths)
    #[arg(short = 'b', long)]
    base_styles: Option<String>,

    /// Path to YAML configuration file for component mapping
    #[arg(short = 'y', long)]
    component_mapping_yaml: Option<PathBuf>,

    /// Compare multiple base style files (comma-separated paths)
    #[arg(long)]
    compare_base_styles: Option<String>,

    /// Similarity threshold for cross-file comparison (0-100, default: 80)
    #[arg(long, default_value = "80")]
    similarity_threshold: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisOutput {
    css_issues: Vec<css::CssIssue>,
    ts_issues: Vec<ts::TypeScriptIssue>,
    template_issues: Vec<html::TemplateIssue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    similarity_results: Option<Vec<css::SimilarityResult>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    component_suggestions: Option<Vec<html::ComponentSuggestion>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    base_style_comparison: Option<css::BaseStyleComparison>,
    metadata: AnalysisMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
struct BaseStyleComparisonOutput {
    base_style_comparison: css::BaseStyleComparison,
    metadata: ComparisonMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
struct ComparisonMetadata {
    analyzed_at: String,
    analysis_time_ms: u128,
    files_compared: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisMetadata {
    component_name: String,
    analyzed_at: String,
    analysis_time_ms: u128,
    files_analyzed: FilesAnalyzed,
}

#[derive(Debug, Serialize, Deserialize)]
struct FilesAnalyzed {
    typescript: String,
    html: Option<String>,
    css: Option<String>,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    
    // Check if this is a base style comparison operation
    if let Some(compare_files) = &args.compare_base_styles {
        match run_base_style_comparison(compare_files, args.similarity_threshold) {
            Ok(output) => {
                println!("{}", serde_json::to_string_pretty(&output)?);
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        // Run normal component analysis
        match run_analysis(args) {
            Ok(output) => {
                // Output JSON to stdout
                println!("{}", serde_json::to_string_pretty(&output)?);
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
    }
}

fn run_base_style_comparison(compare_files: &str, similarity_threshold: f32) -> Result<BaseStyleComparisonOutput, Box<dyn Error>> {
    let start_time = std::time::Instant::now();

    // Parse comma-separated file paths
    let file_paths: Vec<std::path::PathBuf> = compare_files
        .split(',')
        .map(|s| std::path::PathBuf::from(s.trim()))
        .collect();

    if file_paths.len() < 2 {
        return Err("At least 2 files are required for comparison".into());
    }

    // Validate that all files exist
    for path in &file_paths {
        if !path.exists() {
            return Err(format!("File not found: {}", path.display()).into());
        }
    }

    // Perform comparison
    let comparison = css::compare_multiple_base_files(&file_paths, similarity_threshold)?;

    let analysis_time = start_time.elapsed().as_millis();

    Ok(BaseStyleComparisonOutput {
        base_style_comparison: comparison,
        metadata: ComparisonMetadata {
            analyzed_at: chrono::Utc::now().to_rfc3339(),
            analysis_time_ms: analysis_time,
            files_compared: file_paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
        },
    })
}

fn run_analysis(args: Args) -> Result<AnalysisOutput, Box<dyn Error>> {
    let start_time = std::time::Instant::now();

    // Validate TypeScript file exists
    let ts_file = args.ts_file.ok_or("TypeScript file is required for component analysis")?;
    if !ts_file.exists() {
        return Err(format!("TypeScript file not found: {}", ts_file.display()).into());
    }

    // Extract component name from TypeScript file
    let component_name = ts_file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Initialize result vectors
    let mut css_issues = Vec::new();
    let mut ts_issues = Vec::new();
    let mut template_issues = Vec::new();

    // Read TypeScript file
    let ts_content = std::fs::read_to_string(&ts_file)
        .map_err(|e| format!("Failed to read TypeScript file: {}", e))?;

    // Analyze TypeScript file
    match ts::TypeScriptAnalyzer::new(&ts_content) {
        Ok(ts_analyzer) => {
            ts_issues.extend(ts_analyzer.find_unused_imports());
            ts_issues.extend(ts_analyzer.find_missing_awaits());
            ts_issues.extend(ts_analyzer.detect_duplicate_logic());
        }
        Err(e) => {
            eprintln!("Warning: TypeScript parsing failed: {}", e);
        }
    }

    // Load component mapping if provided
    let component_mapping = if let Some(yaml_path) = &args.component_mapping_yaml {
        match yaml_config::ComponentMapping::from_file(yaml_path) {
            Ok(mapping) => Some(mapping),
            Err(e) => {
                eprintln!("Warning: Failed to load component mapping: {}", e);
                None
            }
        }
    } else {
        None
    };

    // Analyze HTML file if provided
    let mut html_classes = std::collections::HashSet::new();
    let mut component_suggestions = None;
    
    if let Some(html_path) = &args.html_file {
        if html_path.exists() {
            match std::fs::read_to_string(html_path) {
                Ok(html_content) => {
                    match html::HtmlAnalyzer::new(&html_content) {
                        Ok(html_analyzer) => {
                            html_classes = html_analyzer.extract_classes();
                            template_issues.extend(html_analyzer.find_deep_nesting(args.max_nesting_depth));
                            template_issues.extend(html_analyzer.find_heavy_pipes());
                            template_issues.extend(html_analyzer.find_redundant_wrappers());
                            
                            // Generate component suggestions if mapping is available
                            if let Some(ref mapping) = component_mapping {
                                let suggestions = html_analyzer.suggest_components(mapping);
                                if !suggestions.is_empty() {
                                    component_suggestions = Some(suggestions);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Warning: HTML parsing failed: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to read HTML file: {}", e);
                }
            }
        } else {
            eprintln!("Warning: HTML file not found: {}", html_path.display());
        }
    }

    // Analyze CSS file if provided
    let mut similarity_results = None;
    if let Some(css_path) = &args.css_file {
        if css_path.exists() {
            match std::fs::read_to_string(css_path) {
                Ok(css_content) => {
                    let css_path_str = css_path.to_string_lossy().to_string();
                    match css::CssAnalyzer::new_with_path(&css_content, &css_path_str) {
                        Ok(css_analyzer) => {
                            css_issues.extend(css_analyzer.find_unused_selectors(&html_classes));
                            css_issues.extend(css_analyzer.find_duplicate_rules());
                            
                            // Perform similarity analysis if base styles are provided
                            if let Some(base_styles_str) = &args.base_styles {
                                let base_style_paths: Vec<PathBuf> = base_styles_str
                                    .split(',')
                                    .map(|s| PathBuf::from(s.trim()))
                                    .collect();
                                
                                match css::load_base_styles(&base_style_paths) {
                                    Ok(base_classes) => {
                                        similarity_results = Some(css_analyzer.compare_with_base_styles(&base_classes));
                                    }
                                    Err(e) => {
                                        eprintln!("Warning: Failed to load base styles: {}", e);
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Warning: CSS parsing failed: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to read CSS file: {}", e);
                }
            }
        } else {
            eprintln!("Warning: CSS file not found: {}", css_path.display());
        }
    }

    let analysis_time = start_time.elapsed().as_millis();

    Ok(AnalysisOutput {
        css_issues,
        ts_issues,
        template_issues,
        similarity_results,
        component_suggestions,
        base_style_comparison: None,
        metadata: AnalysisMetadata {
            component_name,
            analyzed_at: chrono::Utc::now().to_rfc3339(),
            analysis_time_ms: analysis_time,
            files_analyzed: FilesAnalyzed {
                typescript: ts_file.to_string_lossy().to_string(),
                html: args.html_file.as_ref().map(|p| p.to_string_lossy().to_string()),
                css: args.css_file.as_ref().map(|p| p.to_string_lossy().to_string()),
            },
        },
    })
}
