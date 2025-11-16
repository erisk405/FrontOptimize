use lightningcss::declaration::DeclarationBlock;
use lightningcss::properties::Property;
use lightningcss::rules::CssRule;
use lightningcss::selector::{Component, Selector};
use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CssClass {
    pub name: String,
    pub properties: HashMap<String, String>,
    pub line: usize,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityResult {
    pub local_class: String,
    pub best_match: BestMatch,
    pub matching_properties: Vec<String>,
    pub differing_properties: Vec<PropertyDiff>,
    pub redundant_properties: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BestMatch {
    pub base_class: String,
    pub base_file: String,
    pub similarity_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PropertyDiff {
    pub property: String,
    pub local_value: String,
    pub base_value: String,
}

#[derive(Debug, Clone)]
struct SelectorInfo {
    selector_text: String,
    line: usize,
    column: usize,
    classes: Vec<String>,
}

#[derive(Debug, Clone)]
struct ClassInfo {
    name: String,
    properties: HashMap<String, String>,
    line: usize,
}

pub struct CssAnalyzer<'i> {
    stylesheet: StyleSheet<'i, 'i>,
    selectors: Vec<SelectorInfo>,
    file_path: String,
    _css_content: String,
}

impl<'i> CssAnalyzer<'i> {
    pub fn new(css_content: &str) -> Result<Self, String> {
        Self::new_with_path(css_content, "unknown")
    }

    pub fn new_with_path(css_content: &str, file_path: &str) -> Result<Self, String> {
        // Store the content to ensure it lives long enough
        let owned_content = css_content.to_string();

        // Parse the CSS using lightningcss
        // SAFETY: We're transmuting the lifetime to make it work with our owned string
        // The stylesheet will be valid as long as _css_content is kept alive
        let stylesheet = unsafe {
            std::mem::transmute::<StyleSheet<'_, '_>, StyleSheet<'i, 'i>>(
                StyleSheet::parse(&owned_content, ParserOptions::default())
                    .map_err(|e| format!("CSS parsing error: {:?}", e))?,
            )
        };

        // Extract all selectors with their line/column information
        let selectors = Self::extract_selectors(&stylesheet);

        Ok(CssAnalyzer {
            stylesheet,
            selectors,
            file_path: file_path.to_string(),
            _css_content: owned_content,
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

        for component in selector.iter() {
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
                Component::PseudoElement(pseudo) => {
                    result.push_str(&format!("::{:?}", pseudo));
                }
                Component::AttributeInNoNamespace {
                    local_name, value, ..
                } => {
                    result.push('[');
                    result.push_str(&local_name.0.to_string());
                    result.push('=');
                    result.push_str(&value.0.to_string());
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

        for component in selector.iter() {
            if let Component::Class(class_name) = component {
                classes.push(class_name.0.to_string());
            }
        }

        classes
    }

    pub fn find_unused_selectors(
        &self,
        html_classes: &std::collections::HashSet<String>,
    ) -> Vec<CssIssue> {
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
        !classes1.is_empty() && classes1.is_subset(&classes2) && classes2.len() > classes1.len()
    }

    /// Extract all CSS classes with their properties from the stylesheet
    pub fn extract_classes(&self) -> Vec<CssClass> {
        let mut classes = Vec::new();

        for rule in &self.stylesheet.rules.0 {
            Self::extract_classes_from_rule(rule, &mut classes, &self.file_path);
        }

        classes
    }

    /// Recursively extract classes from CSS rules
    fn extract_classes_from_rule(rule: &CssRule, classes: &mut Vec<CssClass>, file_path: &str) {
        match rule {
            CssRule::Style(style_rule) => {
                let loc = &style_rule.loc;
                let line = loc.line as usize;

                // Extract properties from the declaration block
                let properties = Self::extract_properties(&style_rule.declarations);

                // Process each selector in the rule
                for selector in &style_rule.selectors.0 {
                    // Extract class names from this selector
                    let class_names = Self::extract_classes_from_selector(selector);

                    // Create a CssClass entry for each class in the selector
                    for class_name in class_names {
                        classes.push(CssClass {
                            name: class_name,
                            properties: properties.clone(),
                            line,
                            file: file_path.to_string(),
                        });
                    }
                }
            }
            CssRule::Media(media_rule) => {
                // Process nested rules in media queries
                for nested_rule in &media_rule.rules.0 {
                    Self::extract_classes_from_rule(nested_rule, classes, file_path);
                }
            }
            CssRule::Supports(supports_rule) => {
                // Process nested rules in @supports
                for nested_rule in &supports_rule.rules.0 {
                    Self::extract_classes_from_rule(nested_rule, classes, file_path);
                }
            }
            _ => {
                // Ignore other rule types (imports, keyframes, etc.)
            }
        }
    }

    /// Extract property-value pairs from a declaration block
    fn extract_properties(declarations: &DeclarationBlock) -> HashMap<String, String> {
        let mut properties = HashMap::new();

        for declaration in &declarations.declarations {
            let property_name = Self::property_to_name(&declaration);
            let property_value = Self::property_to_value(&declaration);

            if !property_name.is_empty() && !property_value.is_empty() {
                properties.insert(property_name, property_value);
            }
        }

        properties
    }

    /// Convert a Property to its name string
    fn property_to_name(property: &Property) -> String {
        match property {
            Property::BackgroundColor(_) => "background-color".to_string(),
            Property::Color(_) => "color".to_string(),
            Property::Display(_) => "display".to_string(),
            Property::Width(_) => "width".to_string(),
            Property::Height(_) => "height".to_string(),
            Property::Margin(_) => "margin".to_string(),
            Property::MarginTop(_) => "margin-top".to_string(),
            Property::MarginRight(_) => "margin-right".to_string(),
            Property::MarginBottom(_) => "margin-bottom".to_string(),
            Property::MarginLeft(_) => "margin-left".to_string(),
            Property::Padding(_) => "padding".to_string(),
            Property::PaddingTop(_) => "padding-top".to_string(),
            Property::PaddingRight(_) => "padding-right".to_string(),
            Property::PaddingBottom(_) => "padding-bottom".to_string(),
            Property::PaddingLeft(_) => "padding-left".to_string(),
            Property::Border(_) => "border".to_string(),
            Property::BorderTop(_) => "border-top".to_string(),
            Property::BorderRight(_) => "border-right".to_string(),
            Property::BorderBottom(_) => "border-bottom".to_string(),
            Property::BorderLeft(_) => "border-left".to_string(),
            Property::BorderRadius(_, _) => "border-radius".to_string(),
            Property::FontSize(_) => "font-size".to_string(),
            Property::FontWeight(_) => "font-weight".to_string(),
            Property::FontFamily(_) => "font-family".to_string(),
            Property::LineHeight(_) => "line-height".to_string(),
            Property::TextAlign(_) => "text-align".to_string(),
            Property::Position(_) => "position".to_string(),
            Property::Top(_) => "top".to_string(),
            Property::Right(_) => "right".to_string(),
            Property::Bottom(_) => "bottom".to_string(),
            Property::Left(_) => "left".to_string(),
            Property::ZIndex(_) => "z-index".to_string(),
            Property::Flex(..) => "flex".to_string(),
            Property::FlexDirection(..) => "flex-direction".to_string(),
            Property::JustifyContent(..) => "justify-content".to_string(),
            Property::AlignItems(..) => "align-items".to_string(),
            Property::Gap(_) => "gap".to_string(),
            Property::Opacity(_) => "opacity".to_string(),
            Property::Cursor(_) => "cursor".to_string(),
            Property::Overflow(_) => "overflow".to_string(),
            Property::OverflowX(_) => "overflow-x".to_string(),
            Property::OverflowY(_) => "overflow-y".to_string(),
            Property::BoxShadow(..) => "box-shadow".to_string(),
            Property::TextDecoration(..) => "text-decoration".to_string(),
            Property::Transform(..) => "transform".to_string(),
            Property::Transition(..) => "transition".to_string(),
            Property::Unparsed(unparsed) => format!("{:?}", unparsed.property_id),
            _ => format!("{:?}", property)
                .split('(')
                .next()
                .unwrap_or("unknown")
                .to_lowercase(),
        }
    }

    /// Convert a Property to its value string
    fn property_to_value(property: &Property) -> String {
        // Use debug format as a simple way to get the value
        // This is a simplified approach; a more robust solution would pattern match each property type
        format!("{:?}", property)
            .split('(')
            .skip(1)
            .collect::<Vec<_>>()
            .join("(")
            .trim_end_matches(')')
            .to_string()
    }

    /// Calculate similarity between two CSS classes using Jaccard index
    /// Returns a percentage (0-100) indicating how similar the classes are
    pub fn calculate_similarity(local: &CssClass, base: &CssClass) -> f32 {
        if local.properties.is_empty() && base.properties.is_empty() {
            return 100.0;
        }

        if local.properties.is_empty() || base.properties.is_empty() {
            return 0.0;
        }

        // Get all unique property keys from both classes
        let local_keys: HashSet<&String> = local.properties.keys().collect();
        let base_keys: HashSet<&String> = base.properties.keys().collect();

        // Calculate intersection: properties that exist in both with the same value
        let mut matching_count = 0;
        for key in local_keys.intersection(&base_keys) {
            if let (Some(local_val), Some(base_val)) =
                (local.properties.get(*key), base.properties.get(*key))
            {
                // Normalize values for comparison (remove whitespace, lowercase)
                let local_normalized = local_val.to_lowercase().replace(" ", "");
                let base_normalized = base_val.to_lowercase().replace(" ", "");

                if local_normalized == base_normalized {
                    matching_count += 1;
                }
            }
        }

        // Calculate union: all unique properties from both classes
        let union_count = local_keys.union(&base_keys).count();

        // Jaccard similarity: intersection / union
        if union_count == 0 {
            return 0.0;
        }

        (matching_count as f32 / union_count as f32) * 100.0
    }

    /// Compare local CSS classes with base style classes
    /// Returns similarity results for each local class with its best match
    pub fn compare_with_base_styles(&self, base_classes: &[CssClass]) -> Vec<SimilarityResult> {
        let local_classes = self.extract_classes();
        let mut results = Vec::new();

        for local_class in &local_classes {
            // Find the best matching base class
            let mut best_match: Option<(f32, &CssClass)> = None;

            for base_class in base_classes {
                let similarity = Self::calculate_similarity(local_class, base_class);

                if let Some((best_similarity, _)) = best_match {
                    if similarity > best_similarity {
                        best_match = Some((similarity, base_class));
                    }
                } else {
                    best_match = Some((similarity, base_class));
                }
            }

            // Generate similarity result if we found a match
            if let Some((similarity_percent, base_class)) = best_match {
                // Only include results with meaningful similarity (> 0%)
                if similarity_percent > 0.0 {
                    let (matching, differing, redundant) =
                        Self::compare_properties(local_class, base_class);

                    results.push(SimilarityResult {
                        local_class: local_class.name.clone(),
                        best_match: BestMatch {
                            base_class: base_class.name.clone(),
                            base_file: base_class.file.clone(),
                            similarity_percent,
                        },
                        matching_properties: matching,
                        differing_properties: differing,
                        redundant_properties: redundant,
                    });
                }
            }
        }

        results
    }

    /// Compare properties between local and base classes
    /// Returns (matching, differing, redundant) properties
    fn compare_properties(
        local: &CssClass,
        base: &CssClass,
    ) -> (Vec<String>, Vec<PropertyDiff>, Vec<String>) {
        let mut matching = Vec::new();
        let mut differing = Vec::new();
        let mut redundant = Vec::new();

        let local_keys: HashSet<&String> = local.properties.keys().collect();

        // Find matching and differing properties
        for key in &local_keys {
            if let Some(local_val) = local.properties.get(*key) {
                if let Some(base_val) = base.properties.get(*key) {
                    // Normalize for comparison
                    let local_normalized = local_val.to_lowercase().replace(" ", "");
                    let base_normalized = base_val.to_lowercase().replace(" ", "");

                    if local_normalized == base_normalized {
                        // Property matches
                        matching.push(format!("{}: {}", key, local_val));
                    } else {
                        // Property exists in both but with different values
                        differing.push(PropertyDiff {
                            property: (*key).clone(),
                            local_value: local_val.clone(),
                            base_value: base_val.clone(),
                        });
                    }
                } else {
                    // Property exists in local but not in base (redundant)
                    redundant.push(format!("{}: {}", key, local_val));
                }
            }
        }

        // Properties in base but not in local are not redundant, they're missing
        // We don't report those here as they're not redundant in the local class

        (matching, differing, redundant)
    }
}

/// Load and parse multiple base style files
pub fn load_base_styles(file_paths: &[PathBuf]) -> Result<Vec<CssClass>, String> {
    let mut all_classes = Vec::new();

    for path in file_paths {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;

        let file_path_str = path.to_string_lossy().to_string();
        let analyzer = CssAnalyzer::new_with_path(&content, &file_path_str)?;

        let mut classes = analyzer.extract_classes();
        all_classes.append(&mut classes);
    }

    Ok(all_classes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseStyleComparison {
    pub duplicates: Vec<DuplicateClass>,
    pub similar_classes: Vec<SimilarClassPair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateClass {
    pub class_name: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarClassPair {
    pub class1: ClassReference,
    pub class2: ClassReference,
    pub similarity_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassReference {
    pub name: String,
    pub file: String,
}

/// Compare multiple base style files to find duplicates and similar classes
/// Returns a BaseStyleComparison with duplicate classes and similar class pairs
pub fn compare_multiple_base_files(
    file_paths: &[PathBuf],
    similarity_threshold: f32,
) -> Result<BaseStyleComparison, String> {
    // Load and parse all base style files
    let mut all_classes: Vec<CssClass> = Vec::new();
    let mut parse_errors: Vec<String> = Vec::new();

    for path in file_paths {
        match std::fs::read_to_string(path) {
            Ok(content) => {
                let file_path_str = path.to_string_lossy().to_string();
                match CssAnalyzer::new_with_path(&content, &file_path_str) {
                    Ok(analyzer) => {
                        let mut classes = analyzer.extract_classes();
                        all_classes.append(&mut classes);
                    }
                    Err(e) => {
                        // Log parsing error but continue with other files
                        let error_msg = format!("Failed to parse {}: {}", path.display(), e);
                        eprintln!("Warning: {}", error_msg);
                        parse_errors.push(error_msg);
                    }
                }
            }
            Err(e) => {
                // Log read error but continue with other files
                let error_msg = format!("Failed to read {}: {}", path.display(), e);
                eprintln!("Warning: {}", error_msg);
                parse_errors.push(error_msg);
            }
        }
    }

    // If no classes were successfully loaded, return an error
    if all_classes.is_empty() {
        return Err(format!(
            "No CSS classes could be loaded from the provided files. Errors: {}",
            parse_errors.join("; ")
        ));
    }

    // Find duplicate classes (same name in different files)
    let duplicates = find_duplicate_classes(&all_classes);

    // Find similar classes (different names but similar properties)
    let similar_classes = find_similar_classes(&all_classes, similarity_threshold);

    Ok(BaseStyleComparison {
        duplicates,
        similar_classes,
    })
}

/// Find classes with identical names in different files
fn find_duplicate_classes(classes: &[CssClass]) -> Vec<DuplicateClass> {
    let mut class_map: HashMap<String, Vec<String>> = HashMap::new();

    // Group classes by name and track which files they appear in
    for class in classes {
        class_map
            .entry(class.name.clone())
            .or_insert_with(Vec::new)
            .push(class.file.clone());
    }

    // Find classes that appear in multiple files
    let mut duplicates = Vec::new();
    for (class_name, files) in class_map {
        // Remove duplicate file entries (same class defined multiple times in same file)
        let mut unique_files: Vec<String> = files
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        unique_files.sort();

        // Only report if the class appears in more than one file
        if unique_files.len() > 1 {
            duplicates.push(DuplicateClass {
                class_name,
                files: unique_files,
            });
        }
    }

    // Sort by class name for consistent output
    duplicates.sort_by(|a, b| a.class_name.cmp(&b.class_name));

    duplicates
}

/// Find classes with different names but similar properties across files
fn find_similar_classes(classes: &[CssClass], similarity_threshold: f32) -> Vec<SimilarClassPair> {
    let mut similar_pairs = Vec::new();

    // Compare each class with every other class
    for i in 0..classes.len() {
        for j in (i + 1)..classes.len() {
            let class1 = &classes[i];
            let class2 = &classes[j];

            // Skip if same class name (those are handled by duplicate detection)
            if class1.name == class2.name {
                continue;
            }

            // Skip if from the same file (not cross-file comparison)
            if class1.file == class2.file {
                continue;
            }

            // Calculate similarity
            let similarity = CssAnalyzer::calculate_similarity(class1, class2);

            // Only include if similarity exceeds threshold
            if similarity >= similarity_threshold {
                similar_pairs.push(SimilarClassPair {
                    class1: ClassReference {
                        name: class1.name.clone(),
                        file: class1.file.clone(),
                    },
                    class2: ClassReference {
                        name: class2.name.clone(),
                        file: class2.file.clone(),
                    },
                    similarity_percent: similarity,
                });
            }
        }
    }

    // Sort by similarity percentage (highest first)
    similar_pairs.sort_by(|a, b| {
        b.similarity_percent
            .partial_cmp(&a.similarity_percent)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    similar_pairs
}
