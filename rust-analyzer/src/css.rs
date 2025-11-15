use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use lightningcss::rules::CssRule;
use lightningcss::selector::{Component, Selector};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CssIssue {
    pub issue_type: CssIssueType,
    pub selector: String,
    pub line: usize,
    pub column: usize,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum CssIssueType {
    UnusedSelector,
    DuplicateRule,
    RedundantSelector,
}

#[derive(Debug, Clone)]
struct SelectorInfo {
    selector_text: String,
    line: usize,
    column: usize,
    classes: Vec<String>,
}

pub struct CssAnalyzer {
    stylesheet: StyleSheet<'static, 'static>,
    selectors: Vec<SelectorInfo>,
}

impl CssAnalyzer {
    pub fn new(css_content: &str) -> Result<Self, String> {
        // Parse the CSS using lightningcss
        let stylesheet = StyleSheet::parse(
            css_content,
            ParserOptions::default(),
        ).map_err(|e| format!("CSS parsing error: {:?}", e))?;

        // Extract all selectors with their line/column information
        let selectors = Self::extract_selectors(&stylesheet);

        Ok(CssAnalyzer {
            stylesheet,
            selectors,
        })
    }

    /// Extract all selectors from the stylesheet with line and column tracking
    fn extract_selectors(stylesheet: &StyleSheet) -> Vec<SelectorInfo> {
        let mut selectors = Vec::new();

        for rule in &stylesheet.rules.0 {
            Self::process_rule(rule, &mut selectors);
        }

        selectors
    }

    /// Recursively process CSS rules to extract selectors
    fn process_rule(rule: &CssRule, selectors: &mut Vec<SelectorInfo>) {
        match rule {
            CssRule::Style(style_rule) => {
                // Extract location information
                let loc = &style_rule.loc;
                let line = loc.line as usize;
                let column = loc.column as usize;

                // Process each selector in the rule
                for selector in &style_rule.selectors.0 {
                    let selector_text = Self::selector_to_string(selector);
                    let classes = Self::extract_classes_from_selector(selector);

                    selectors.push(SelectorInfo {
                        selector_text,
                        line,
                        column,
                        classes,
                    });
                }
            }
            CssRule::Media(media_rule) => {
                // Process nested rules in media queries
                for nested_rule in &media_rule.rules.0 {
                    Self::process_rule(nested_rule, selectors);
                }
            }
            CssRule::Supports(supports_rule) => {
                // Process nested rules in @supports
                for nested_rule in &supports_rule.rules.0 {
                    Self::process_rule(nested_rule, selectors);
                }
            }
            _ => {
                // Ignore other rule types (imports, keyframes, etc.)
            }
        }
    }

    /// Convert a selector to a string representation
    fn selector_to_string(selector: &Selector) -> String {
        let mut result = String::new();
        
        for component in &selector.0 {
            match component {
                Component::Class(class_name) => {
                    result.push('.');
                    result.push_str(&class_name.0.to_string());
                }
                Component::ID(id) => {
                    result.push('#');
                    result.push_str(&id.0.to_string());
                }
                Component::LocalName(name) => {
                    result.push_str(&name.name.0.to_string());
                }
                Component::Combinator(combinator) => {
                    result.push_str(&format!(" {:?} ", combinator));
                }
                Component::PseudoClass(pseudo) => {
                    result.push_str(&format!(":{:?}", pseudo));
                }
                Component::PseudoElement(pseudo) => {
                    result.push_str(&format!("::{:?}", pseudo));
                }
                Component::AttributeInNoNamespace { local_name, operator, value, .. } => {
                    result.push('[');
                    result.push_str(&local_name.0.to_string());
                    if let Some(op) = operator {
                        result.push_str(&format!("{:?}", op));
                        result.push_str(&value.0.to_string());
                    }
                    result.push(']');
                }
                _ => {
                    // Handle other component types
                    result.push_str(&format!("{:?}", component));
                }
            }
        }
        
        result
    }

    /// Extract class names from a selector
    fn extract_classes_from_selector(selector: &Selector) -> Vec<String> {
        let mut classes = Vec::new();
        
        for component in &selector.0 {
            if let Component::Class(class_name) = component {
                classes.push(class_name.0.to_string());
            }
        }
        
        classes
    }

    pub fn find_unused_selectors(&self, html_classes: &std::collections::HashSet<String>) -> Vec<CssIssue> {
        let mut issues = Vec::new();

        for selector_info in &self.selectors {
            // Check if any class in this selector is used in the HTML
            let mut has_used_class = false;
            let mut unused_classes = Vec::new();

            for class in &selector_info.classes {
                if html_classes.contains(class) {
                    has_used_class = true;
                } else {
                    unused_classes.push(class.clone());
                }
            }

            // If the selector contains classes and none are used, report it as unused
            if !selector_info.classes.is_empty() && !has_used_class {
                issues.push(CssIssue {
                    issue_type: CssIssueType::UnusedSelector,
                    selector: selector_info.selector_text.clone(),
                    line: selector_info.line,
                    column: selector_info.column,
                    description: format!(
                        "CSS selector '{}' is not used in the template. Classes not found: {}",
                        selector_info.selector_text,
                        unused_classes.join(", ")
                    ),
                });
            }
        }

        issues
    }

    pub fn find_duplicate_rules(&self) -> Vec<CssIssue> {
        let mut issues = Vec::new();
        let mut selector_map: HashMap<String, Vec<&SelectorInfo>> = HashMap::new();

        // Group selectors by their text representation
        for selector_info in &self.selectors {
            selector_map
                .entry(selector_info.selector_text.clone())
                .or_insert_with(Vec::new)
                .push(selector_info);
        }

        // Find duplicate selectors (same selector appearing multiple times)
        for (selector_text, occurrences) in &selector_map {
            if occurrences.len() > 1 {
                // Report all but the first occurrence as duplicates
                for (idx, occurrence) in occurrences.iter().enumerate() {
                    if idx > 0 {
                        issues.push(CssIssue {
                            issue_type: CssIssueType::DuplicateRule,
                            selector: selector_text.clone(),
                            line: occurrence.line,
                            column: occurrence.column,
                            description: format!(
                                "Duplicate selector '{}' found. This selector was already defined at line {}. Later rules may override earlier ones.",
                                selector_text,
                                occurrences[0].line
                            ),
                        });
                    }
                }
            }
        }

        // Find redundant selectors (selectors that are subsets of others)
        // For example, if we have both ".btn" and ".btn.primary", the first might be redundant
        let selector_texts: Vec<String> = selector_map.keys().cloned().collect();
        
        for (i, selector1) in selector_texts.iter().enumerate() {
            for selector2 in selector_texts.iter().skip(i + 1) {
                // Check if one selector is a subset of another
                if Self::is_redundant_selector(selector1, selector2) {
                    if let Some(occurrences) = selector_map.get(selector1) {
                        if let Some(first) = occurrences.first() {
                            issues.push(CssIssue {
                                issue_type: CssIssueType::RedundantSelector,
                                selector: selector1.clone(),
                                line: first.line,
                                column: first.column,
                                description: format!(
                                    "Selector '{}' may be redundant. A more specific selector '{}' exists that might override these styles.",
                                    selector1, selector2
                                ),
                            });
                        }
                    }
                }
            }
        }

        issues
    }

    /// Check if selector1 is potentially redundant compared to selector2
    fn is_redundant_selector(selector1: &str, selector2: &str) -> bool {
        // Simple heuristic: if selector2 contains all parts of selector1 plus more,
        // selector1 might be redundant
        
        // Extract class names from both selectors
        let classes1: HashSet<&str> = selector1
            .split(|c: char| c.is_whitespace() || c == '>' || c == '+' || c == '~')
            .filter(|s| s.starts_with('.'))
            .collect();
        
        let classes2: HashSet<&str> = selector2
            .split(|c: char| c.is_whitespace() || c == '>' || c == '+' || c == '~')
            .filter(|s| s.starts_with('.'))
            .collect();

        // If selector1 has classes and all of them are in selector2, and selector2 has more
        !classes1.is_empty() && 
        classes1.is_subset(&classes2) && 
        classes2.len() > classes1.len()
    }
}
