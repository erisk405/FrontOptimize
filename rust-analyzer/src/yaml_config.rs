use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ComponentMapping {
    pub components: HashMap<String, ComponentDefinition>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ComponentDefinition {
    pub selector: String,
    pub keywords: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl ComponentMapping {
    /// Load component mapping from a YAML file
    pub fn from_file(path: &Path) -> Result<Self, String> {
        // Check if file exists
        if !path.exists() {
            return Err(format!("YAML configuration file not found: {}", path.display()));
        }

        // Read file content
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read YAML file: {}", e))?;

        // Parse YAML
        let mapping: ComponentMapping = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse YAML: {}", e))?;

        // Validate that we have at least one component
        if mapping.components.is_empty() {
            return Err("YAML configuration contains no components".to_string());
        }

        Ok(mapping)
    }

    /// Find a matching component for a given element tag name
    /// Returns the component name and definition if a match is found
    pub fn find_matching_component(&self, element_tag: &str) -> Option<(&String, &ComponentDefinition)> {
        let element_lower = element_tag.to_lowercase();
        
        // First, try exact keyword match
        for (component_name, definition) in &self.components {
            for keyword in &definition.keywords {
                if keyword.to_lowercase() == element_lower {
                    return Some((component_name, definition));
                }
            }
        }

        // If no exact match, try partial match (keyword contains element or vice versa)
        for (component_name, definition) in &self.components {
            for keyword in &definition.keywords {
                let keyword_lower = keyword.to_lowercase();
                if keyword_lower.contains(&element_lower) || element_lower.contains(&keyword_lower) {
                    return Some((component_name, definition));
                }
            }
        }

        None
    }

    /// Find all matching components for a given element tag name
    /// Returns a vector of (component_name, definition, priority) tuples
    /// Priority is based on match quality: exact match = 3, contains = 2, contained = 1
    pub fn find_all_matching_components(&self, element_tag: &str) -> Vec<(&String, &ComponentDefinition, u8)> {
        let element_lower = element_tag.to_lowercase();
        let mut matches = Vec::new();

        for (component_name, definition) in &self.components {
            for keyword in &definition.keywords {
                let keyword_lower = keyword.to_lowercase();
                
                // Exact match - highest priority
                if keyword_lower == element_lower {
                    matches.push((component_name, definition, 3u8));
                    break;
                }
                // Keyword contains element - medium priority
                else if keyword_lower.contains(&element_lower) {
                    matches.push((component_name, definition, 2u8));
                    break;
                }
                // Element contains keyword - lowest priority
                else if element_lower.contains(&keyword_lower) {
                    matches.push((component_name, definition, 1u8));
                    break;
                }
            }
        }

        // Sort by priority (highest first)
        matches.sort_by(|a, b| b.2.cmp(&a.2));
        matches
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_parse_valid_yaml() {
        let yaml_content = r#"
components:
  go5-button:
    selector: go5-button
    keywords: ["button", "btn"]
    description: "Primary button component"
  go5-input:
    selector: go5-input
    keywords: ["input", "textbox"]
"#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(yaml_content.as_bytes()).unwrap();
        
        let mapping = ComponentMapping::from_file(temp_file.path()).unwrap();
        
        assert_eq!(mapping.components.len(), 2);
        assert!(mapping.components.contains_key("go5-button"));
        assert!(mapping.components.contains_key("go5-input"));
    }

    #[test]
    fn test_find_exact_match() {
        let mut components = HashMap::new();
        components.insert(
            "go5-button".to_string(),
            ComponentDefinition {
                selector: "go5-button".to_string(),
                keywords: vec!["button".to_string(), "btn".to_string()],
                description: None,
            },
        );

        let mapping = ComponentMapping { components };
        
        let result = mapping.find_matching_component("button");
        assert!(result.is_some());
        assert_eq!(result.unwrap().0, "go5-button");
    }

    #[test]
    fn test_find_no_match() {
        let mut components = HashMap::new();
        components.insert(
            "go5-button".to_string(),
            ComponentDefinition {
                selector: "go5-button".to_string(),
                keywords: vec!["button".to_string()],
                description: None,
            },
        );

        let mapping = ComponentMapping { components };
        
        let result = mapping.find_matching_component("div");
        assert!(result.is_none());
    }

    #[test]
    fn test_priority_ranking() {
        let mut components = HashMap::new();
        components.insert(
            "go5-button".to_string(),
            ComponentDefinition {
                selector: "go5-button".to_string(),
                keywords: vec!["button".to_string()],
                description: None,
            },
        );
        components.insert(
            "go5-submit-button".to_string(),
            ComponentDefinition {
                selector: "go5-submit-button".to_string(),
                keywords: vec!["submit-button".to_string()],
                description: None,
            },
        );

        let mapping = ComponentMapping { components };
        
        let matches = mapping.find_all_matching_components("button");
        assert!(!matches.is_empty());
        // Exact match should be first
        assert_eq!(matches[0].0, "go5-button");
        assert_eq!(matches[0].2, 3); // Priority 3 for exact match
    }
}
