use clap::Parser;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::PathBuf;

mod css;
mod html;
mod ts;

#[derive(Parser, Debug)]
#[command(name = "angular-analyzer")]
#[command(about = "Analyzes Angular component files for optimization opportunities")]
struct Args {
    /// Path to TypeScript component file
    #[arg(short, long)]
    ts_file: PathBuf,

    /// Path to HTML template file
    #[arg(short = 'H', long)]
    html_file: Option<PathBuf>,

    /// Path to CSS stylesheet file
    #[arg(short, long)]
    css_file: Option<PathBuf>,

    /// Maximum allowed nesting depth for loops (default: 2)
    #[arg(short = 'd', long, default_value = "2")]
    max_nesting_depth: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisOutput {
    css_issues: Vec<css::CssIssue>,
    ts_issues: Vec<ts::TypeScriptIssue>,
    template_issues: Vec<html::TemplateIssue>,
    metadata: AnalysisMetadata,
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
    
    // Run analysis and handle errors
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

fn run_analysis(args: Args) -> Result<AnalysisOutput, Box<dyn Error>> {
    let start_time = std::time::Instant::now();

    // Validate TypeScript file exists
    if !args.ts_file.exists() {
        return Err(format!("TypeScript file not found: {}", args.ts_file.display()).into());
    }

    // Extract component name from TypeScript file
    let component_name = args
        .ts_file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Initialize result vectors
    let mut css_issues = Vec::new();
    let mut ts_issues = Vec::new();
    let mut template_issues = Vec::new();

    // Read TypeScript file
    let ts_content = std::fs::read_to_string(&args.ts_file)
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

    // Analyze HTML file if provided
    let mut html_classes = std::collections::HashSet::new();
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
    if let Some(css_path) = &args.css_file {
        if css_path.exists() {
            match std::fs::read_to_string(css_path) {
                Ok(css_content) => {
                    match css::CssAnalyzer::new(&css_content) {
                        Ok(css_analyzer) => {
                            css_issues.extend(css_analyzer.find_unused_selectors(&html_classes));
                            css_issues.extend(css_analyzer.find_duplicate_rules());
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
        metadata: AnalysisMetadata {
            component_name,
            analyzed_at: chrono::Utc::now().to_rfc3339(),
            analysis_time_ms: analysis_time,
            files_analyzed: FilesAnalyzed {
                typescript: args.ts_file.to_string_lossy().to_string(),
                html: args.html_file.as_ref().map(|p| p.to_string_lossy().to_string()),
                css: args.css_file.as_ref().map(|p| p.to_string_lossy().to_string()),
            },
        },
    })
}
