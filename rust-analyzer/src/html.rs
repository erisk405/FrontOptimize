use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TemplateIssue {
    pub issue_type: TemplateIssueType,
    pub line: usize,
    pub description: String,
    pub severity: Severity,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum TemplateIssueType {
    DeepNesting,
    HeavyPipe,
    RedundantWrapper,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum Severity {
    High,
    Medium,
    Low,
}

pub struct HtmlAnalyzer {
    document: Html,
    content: String,
}

impl HtmlAnalyzer {
    pub fn new(html_content: &str) -> Result<Self, String> {
        let document = Html::parse_document(html_content);
        
        Ok(HtmlAnalyzer {
            document,
            content: html_content.to_string(),
        })
    }

    /// Extract all CSS class names from the HTML template
    pub fn extract_classes(&self) -> HashSet<String> {
        let mut classes = HashSet::new();
        
        // Select all elements with class attributes
        let selector = Selector::parse("[class]").unwrap();
        
        for element in self.document.select(&selector) {
            if let Some(class_attr) = element.value().attr("class") {
                // Split by whitespace and add each class
                for class_name in class_attr.split_whitespace() {
                    // Handle Angular class binding syntax: [class.some-class]="condition"
                    let clean_class = class_name.trim();
                    if !clean_class.is_empty() {
                        classes.insert(clean_class.to_string());
                    }
                }
            }
        }
        
        // Also extract classes from Angular [class.xxx] bindings
        // Pattern: [class.class-name]="condition"
        for line in self.content.lines() {
            if let Some(start) = line.find("[class.") {
                let after_start = &line[start + 7..];
                if let Some(end) = after_start.find(']') {
                    let class_name = &after_start[..end];
                    classes.insert(class_name.to_string());
                }
            }
            
            // Also handle [ngClass] with object syntax
            // This is a simplified extraction - full implementation would need proper parsing
            if line.contains("[ngClass]") || line.contains("ngClass") {
                // Extract class names from common patterns like {'class-name': condition}
                let mut chars = line.chars().peekable();
                let mut in_quotes = false;
                let mut current_class = String::new();
                
                while let Some(ch) = chars.next() {
                    match ch {
                        '\'' | '"' => {
                            if in_quotes && !current_class.is_empty() {
                                // Check if this looks like a CSS class (contains hyphen or is lowercase)
                                if current_class.contains('-') || current_class.chars().all(|c| c.is_lowercase() || c == '-' || c == '_') {
                                    classes.insert(current_class.clone());
                                }
                                current_class.clear();
                            }
                            in_quotes = !in_quotes;
                        }
                        _ if in_quotes => {
                            current_class.push(ch);
                        }
                        _ => {}
                    }
                }
            }
        }
        
        classes
    }

    pub fn find_deep_nesting(&self, max_depth: usize) -> Vec<TemplateIssue> {
        let mut issues = Vec::new();
        
        // Track *ngFor directives and their nesting depth
        let lines: Vec<&str> = self.content.lines().collect();
        let mut nesting_stack: Vec<(usize, usize)> = Vec::new(); // (line_number, depth)
        
        for (line_num, line) in lines.iter().enumerate() {
            let line_number = line_num + 1;
            
            // Check for *ngFor directive
            if line.contains("*ngFor") {
                let current_depth = nesting_stack.len() + 1;
                
                // If we exceed max depth, create an issue
                if current_depth > max_depth {
                    issues.push(TemplateIssue {
                        issue_type: TemplateIssueType::DeepNesting,
                        line: line_number,
                        description: format!(
                            "Loop nesting exceeds {} levels (current depth: {}). Consider refactoring into separate components.",
                            max_depth, current_depth
                        ),
                        severity: Severity::High,
                    });
                }
                
                // Track opening tag depth
                nesting_stack.push((line_number, current_depth));
            }
            
            // Track closing tags to maintain proper nesting depth
            // Count opening and closing tags on this line
            let open_count = line.matches('<').filter(|&s| !s.starts_with("</")).count();
            let close_count = line.matches("</").count();
            
            // If we have more closing tags than opening, pop from stack
            if close_count > open_count && !nesting_stack.is_empty() {
                for _ in 0..(close_count - open_count) {
                    if !nesting_stack.is_empty() {
                        nesting_stack.pop();
                    }
                }
            }
        }
        
        issues
    }

    pub fn find_heavy_pipes(&self) -> Vec<TemplateIssue> {
        let mut issues = Vec::new();
        
        let lines: Vec<&str> = self.content.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            let line_number = line_num + 1;
            
            // Check if line contains *ngFor (indicating we're in a loop)
            let in_loop = line.contains("*ngFor");
            
            // Count pipes in the line (excluding || operator)
            let pipe_count = line.matches(" | ")
                .filter(|_| !line.contains("||"))
                .count();
            
            // Detect pipes used in loops
            if in_loop && pipe_count > 0 {
                issues.push(TemplateIssue {
                    issue_type: TemplateIssueType::HeavyPipe,
                    line: line_number,
                    description: format!(
                        "Pipe used inside *ngFor loop. Consider moving pipe logic to component or using memoization."
                    ),
                    severity: Severity::Medium,
                });
            }
            
            // Detect multiple pipe chains (3 or more pipes chained together)
            if pipe_count >= 3 {
                issues.push(TemplateIssue {
                    issue_type: TemplateIssueType::HeavyPipe,
                    line: line_number,
                    description: format!(
                        "Multiple pipe chains detected ({} pipes). Consider preprocessing data in component.",
                        pipe_count
                    ),
                    severity: Severity::Medium,
                });
            }
            
            // Check for pipes in complex expressions (containing method calls or ternary operators)
            if line.contains(" | ") {
                // Look for method calls: something()
                let has_method_call = line.contains("(") && line.contains(")");
                // Look for ternary operators: condition ? true : false
                let has_ternary = line.contains("?") && line.contains(":");
                
                if (has_method_call || has_ternary) && pipe_count > 0 {
                    // Check if the pipe comes after the complex expression
                    if let Some(pipe_pos) = line.find(" | ") {
                        let before_pipe = &line[..pipe_pos];
                        if before_pipe.contains("(") || before_pipe.contains("?") {
                            issues.push(TemplateIssue {
                                issue_type: TemplateIssueType::HeavyPipe,
                                line: line_number,
                                description: "Pipe applied to complex expression. Consider simplifying in component.".to_string(),
                                severity: Severity::Low,
                            });
                        }
                    }
                }
            }
        }
        
        issues
    }

    pub fn find_redundant_wrappers(&self) -> Vec<TemplateIssue> {
        let mut issues = Vec::new();
        
        let lines: Vec<&str> = self.content.lines().collect();
        let mut consecutive_divs: Vec<usize> = Vec::new();
        
        for (line_num, line) in lines.iter().enumerate() {
            let line_number = line_num + 1;
            let trimmed = line.trim();
            
            // Check if this is a div opening tag without meaningful attributes
            if trimmed.starts_with("<div") && !trimmed.starts_with("</div") {
                // Check if div has no attributes or only has basic structural attributes
                let has_meaningful_attrs = trimmed.contains("class=") 
                    || trimmed.contains("id=")
                    || trimmed.contains("[") 
                    || trimmed.contains("*ng")
                    || trimmed.contains("(")
                    || trimmed.contains("#");
                
                if !has_meaningful_attrs {
                    consecutive_divs.push(line_number);
                } else {
                    // Reset if we find a div with meaningful attributes
                    if consecutive_divs.len() >= 2 {
                        // Report the middle divs as potentially redundant
                        for &div_line in &consecutive_divs[1..] {
                            issues.push(TemplateIssue {
                                issue_type: TemplateIssueType::RedundantWrapper,
                                line: div_line,
                                description: "Nested div without attributes detected. Consider removing unnecessary wrapper elements.".to_string(),
                                severity: Severity::Low,
                            });
                        }
                    }
                    consecutive_divs.clear();
                    if !has_meaningful_attrs {
                        consecutive_divs.push(line_number);
                    }
                }
            } else if trimmed.starts_with("</div>") {
                // Don't reset on closing tags, just continue tracking
                continue;
            } else if !trimmed.is_empty() && !trimmed.starts_with("<!--") {
                // Reset on any other non-empty, non-comment line
                if consecutive_divs.len() >= 2 {
                    // Report the divs as potentially redundant
                    for &div_line in &consecutive_divs[1..] {
                        issues.push(TemplateIssue {
                            issue_type: TemplateIssueType::RedundantWrapper,
                            line: div_line,
                            description: "Nested div without attributes detected. Consider removing unnecessary wrapper elements.".to_string(),
                            severity: Severity::Low,
                        });
                    }
                }
                consecutive_divs.clear();
            }
        }
        
        // Check remaining consecutive divs at end of file
        if consecutive_divs.len() >= 2 {
            for &div_line in &consecutive_divs[1..] {
                issues.push(TemplateIssue {
                    issue_type: TemplateIssueType::RedundantWrapper,
                    line: div_line,
                    description: "Nested div without attributes detected. Consider removing unnecessary wrapper elements.".to_string(),
                    severity: Severity::Low,
                });
            }
        }
        
        issues
    }
}
