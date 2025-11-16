use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use swc_common::{
    errors::{ColorConfig, Handler},
    sync::Lrc,
    SourceMap, Span, DUMMY_SP,
};
use swc_ecma_ast::*;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsConfig};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TypeScriptIssue {
    pub issue_type: TsIssueType,
    pub line: usize,
    pub column: usize,
    pub identifier: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum TsIssueType {
    UnusedImport,
    MissingAwait,
    DuplicateLogic,
}

pub struct TypeScriptAnalyzer {
    module: Module,
    source_map: Lrc<SourceMap>,
}

/// Represents a code block for duplicate detection
#[derive(Debug, Clone)]
struct CodeBlock {
    name: String,
    span: Span,
    line: usize,
    statements: Vec<String>,
}

impl TypeScriptAnalyzer {
    pub fn new(ts_content: &str) -> Result<Self, String> {
        let source_map = Lrc::new(SourceMap::default());
        let source_file =
            source_map.new_source_file(swc_common::FileName::Anon, ts_content.to_string());

        let lexer = Lexer::new(
            Syntax::Typescript(TsConfig {
                tsx: false,
                decorators: true,
                ..Default::default()
            }),
            EsVersion::Es2020,
            StringInput::from(&*source_file),
            None,
        );

        let mut parser = Parser::new_from(lexer);

        let module = parser
            .parse_module()
            .map_err(|e| format!("TypeScript parsing error: {:?}", e))?;

        Ok(TypeScriptAnalyzer { module, source_map })
    }

    /// Get line and column from a span
    fn get_location(&self, span: Span) -> (usize, usize) {
        if span == DUMMY_SP {
            return (0, 0);
        }

        let loc = self.source_map.lookup_char_pos(span.lo);
        (loc.line, loc.col_display + 1)
    }

    pub fn find_unused_imports(&self) -> Vec<TypeScriptIssue> {
        let mut issues = Vec::new();

        // Step 1: Collect all imported identifiers
        let mut imported_identifiers: HashMap<String, (Span, String)> = HashMap::new();

        for item in &self.module.body {
            if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
                let source = import_decl.src.value.to_string();

                for specifier in &import_decl.specifiers {
                    match specifier {
                        ImportSpecifier::Named(named) => {
                            let local_name = named.local.sym.to_string();
                            imported_identifiers
                                .insert(local_name.clone(), (named.span, source.clone()));
                        }
                        ImportSpecifier::Default(default) => {
                            let local_name = default.local.sym.to_string();
                            imported_identifiers
                                .insert(local_name.clone(), (default.span, source.clone()));
                        }
                        ImportSpecifier::Namespace(namespace) => {
                            let local_name = namespace.local.sym.to_string();
                            imported_identifiers
                                .insert(local_name.clone(), (namespace.span, source.clone()));
                        }
                    }
                }
            }
        }

        // Step 2: Find all identifier usages in the module
        let used_identifiers = self.collect_used_identifiers();

        // Step 3: Compare and find unused imports
        for (identifier, (span, source)) in imported_identifiers {
            if !used_identifiers.contains(&identifier) {
                let (line, column) = self.get_location(span);
                issues.push(TypeScriptIssue {
                    issue_type: TsIssueType::UnusedImport,
                    line,
                    column,
                    identifier: identifier.clone(),
                    description: format!(
                        "Import '{}' from '{}' is declared but never used",
                        identifier, source
                    ),
                });
            }
        }

        issues
    }

    /// Collect all identifiers that are actually used in the code
    fn collect_used_identifiers(&self) -> HashSet<String> {
        let mut used = HashSet::new();

        for item in &self.module.body {
            match item {
                ModuleItem::ModuleDecl(decl) => {
                    self.collect_from_module_decl(decl, &mut used);
                }
                ModuleItem::Stmt(stmt) => {
                    self.collect_from_stmt(stmt, &mut used);
                }
            }
        }

        used
    }

    fn collect_from_module_decl(&self, decl: &ModuleDecl, used: &mut HashSet<String>) {
        match decl {
            ModuleDecl::ExportDecl(export) => {
                self.collect_from_decl(&export.decl, used);
            }
            ModuleDecl::ExportDefaultDecl(export) => match &export.decl {
                DefaultDecl::Class(class) => {
                    if let Some(class) = &class.class.super_class {
                        self.collect_from_expr(class, used);
                    }
                    for member in &class.class.body {
                        self.collect_from_class_member(member, used);
                    }
                }
                DefaultDecl::Fn(func) => {
                    if let Some(body) = &func.function.body {
                        self.collect_from_block_stmt(body, used);
                    }
                }
                _ => {}
            },
            ModuleDecl::ExportDefaultExpr(export) => {
                self.collect_from_expr(&export.expr, used);
            }
            _ => {}
        }
    }

    fn collect_from_decl(&self, decl: &Decl, used: &mut HashSet<String>) {
        match decl {
            Decl::Class(class) => {
                if let Some(super_class) = &class.class.super_class {
                    self.collect_from_expr(super_class, used);
                }
                for member in &class.class.body {
                    self.collect_from_class_member(member, used);
                }
            }
            Decl::Fn(func) => {
                if let Some(body) = &func.function.body {
                    self.collect_from_block_stmt(body, used);
                }
            }
            Decl::Var(var) => {
                for decl in &var.decls {
                    if let Some(init) = &decl.init {
                        self.collect_from_expr(init, used);
                    }
                }
            }
            Decl::TsEnum(ts_enum) => {
                for member in &ts_enum.members {
                    if let Some(init) = &member.init {
                        self.collect_from_expr(init, used);
                    }
                }
            }
            _ => {}
        }
    }

    fn collect_from_stmt(&self, stmt: &Stmt, used: &mut HashSet<String>) {
        match stmt {
            Stmt::Block(block) => {
                self.collect_from_block_stmt(block, used);
            }
            Stmt::Expr(expr) => {
                self.collect_from_expr(&expr.expr, used);
            }
            Stmt::Decl(decl) => {
                self.collect_from_decl(decl, used);
            }
            Stmt::Return(ret) => {
                if let Some(arg) = &ret.arg {
                    self.collect_from_expr(arg, used);
                }
            }
            Stmt::If(if_stmt) => {
                self.collect_from_expr(&if_stmt.test, used);
                self.collect_from_stmt(&if_stmt.cons, used);
                if let Some(alt) = &if_stmt.alt {
                    self.collect_from_stmt(alt, used);
                }
            }
            Stmt::While(while_stmt) => {
                self.collect_from_expr(&while_stmt.test, used);
                self.collect_from_stmt(&while_stmt.body, used);
            }
            Stmt::For(for_stmt) => {
                if let Some(init) = &for_stmt.init {
                    match init {
                        VarDeclOrExpr::VarDecl(var) => {
                            for decl in &var.decls {
                                if let Some(init) = &decl.init {
                                    self.collect_from_expr(init, used);
                                }
                            }
                        }
                        VarDeclOrExpr::Expr(expr) => {
                            self.collect_from_expr(expr, used);
                        }
                    }
                }
                if let Some(test) = &for_stmt.test {
                    self.collect_from_expr(test, used);
                }
                if let Some(update) = &for_stmt.update {
                    self.collect_from_expr(update, used);
                }
                self.collect_from_stmt(&for_stmt.body, used);
            }
            Stmt::Switch(switch) => {
                self.collect_from_expr(&switch.discriminant, used);
                for case in &switch.cases {
                    if let Some(test) = &case.test {
                        self.collect_from_expr(test, used);
                    }
                    for stmt in &case.cons {
                        self.collect_from_stmt(stmt, used);
                    }
                }
            }
            Stmt::Try(try_stmt) => {
                self.collect_from_block_stmt(&try_stmt.block, used);
                if let Some(handler) = &try_stmt.handler {
                    self.collect_from_block_stmt(&handler.body, used);
                }
                if let Some(finalizer) = &try_stmt.finalizer {
                    self.collect_from_block_stmt(finalizer, used);
                }
            }
            _ => {}
        }
    }

    fn collect_from_block_stmt(&self, block: &BlockStmt, used: &mut HashSet<String>) {
        for stmt in &block.stmts {
            self.collect_from_stmt(stmt, used);
        }
    }

    fn collect_from_expr(&self, expr: &Expr, used: &mut HashSet<String>) {
        match expr {
            Expr::Ident(ident) => {
                used.insert(ident.sym.to_string());
            }
            Expr::Call(call) => {
                self.collect_from_expr(&call.callee.as_expr().unwrap(), used);
                for arg in &call.args {
                    self.collect_from_expr(&arg.expr, used);
                }
            }
            Expr::New(new) => {
                self.collect_from_expr(&new.callee, used);
                if let Some(args) = &new.args {
                    for arg in args {
                        self.collect_from_expr(&arg.expr, used);
                    }
                }
            }
            Expr::Member(member) => {
                self.collect_from_expr(&member.obj, used);
            }
            Expr::Bin(bin) => {
                self.collect_from_expr(&bin.left, used);
                self.collect_from_expr(&bin.right, used);
            }
            Expr::Unary(unary) => {
                self.collect_from_expr(&unary.arg, used);
            }
            Expr::Assign(assign) => {
                self.collect_from_expr(&assign.right, used);
            }
            Expr::Array(array) => {
                for elem in &array.elems {
                    if let Some(elem) = elem {
                        self.collect_from_expr(&elem.expr, used);
                    }
                }
            }
            Expr::Object(obj) => {
                for prop in &obj.props {
                    match prop {
                        PropOrSpread::Prop(prop) => match &**prop {
                            Prop::KeyValue(kv) => {
                                self.collect_from_expr(&kv.value, used);
                            }
                            Prop::Method(method) => {
                                if let Some(body) = &method.function.body {
                                    self.collect_from_block_stmt(body, used);
                                }
                            }
                            _ => {}
                        },
                        PropOrSpread::Spread(spread) => {
                            self.collect_from_expr(&spread.expr, used);
                        }
                    }
                }
            }
            Expr::Arrow(arrow) => match &*arrow.body {
                BlockStmtOrExpr::BlockStmt(block) => {
                    self.collect_from_block_stmt(block, used);
                }
                BlockStmtOrExpr::Expr(expr) => {
                    self.collect_from_expr(expr, used);
                }
            },
            Expr::Cond(cond) => {
                self.collect_from_expr(&cond.test, used);
                self.collect_from_expr(&cond.cons, used);
                self.collect_from_expr(&cond.alt, used);
            }
            Expr::Await(await_expr) => {
                self.collect_from_expr(&await_expr.arg, used);
            }
            Expr::Paren(paren) => {
                self.collect_from_expr(&paren.expr, used);
            }
            Expr::Tpl(tpl) => {
                for expr in &tpl.exprs {
                    self.collect_from_expr(expr, used);
                }
            }
            _ => {}
        }
    }

    fn collect_from_class_member(&self, member: &ClassMember, used: &mut HashSet<String>) {
        match member {
            ClassMember::Constructor(constructor) => {
                if let Some(body) = &constructor.body {
                    self.collect_from_block_stmt(body, used);
                }
            }
            ClassMember::Method(method) => {
                if let Some(body) = &method.function.body {
                    self.collect_from_block_stmt(body, used);
                }
            }
            ClassMember::ClassProp(prop) => {
                if let Some(value) = &prop.value {
                    self.collect_from_expr(value, used);
                }
            }
            _ => {}
        }
    }

    pub fn find_missing_awaits(&self) -> Vec<TypeScriptIssue> {
        let mut issues = Vec::new();

        // Collect all async function names and Promise-returning patterns
        let async_functions = self.collect_async_functions();

        // Traverse the AST to find calls to async functions without await
        for item in &self.module.body {
            match item {
                ModuleItem::ModuleDecl(decl) => {
                    self.check_missing_awaits_in_module_decl(decl, &async_functions, &mut issues);
                }
                ModuleItem::Stmt(stmt) => {
                    self.check_missing_awaits_in_stmt(stmt, &async_functions, false, &mut issues);
                }
            }
        }

        issues
    }

    /// Collect names of async functions and methods
    fn collect_async_functions(&self) -> HashSet<String> {
        let mut async_funcs = HashSet::new();

        for item in &self.module.body {
            match item {
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                    if let Decl::Fn(func) = &export.decl {
                        if func.function.is_async {
                            async_funcs.insert(func.ident.sym.to_string());
                        }
                    }
                }
                ModuleItem::Stmt(Stmt::Decl(Decl::Fn(func))) => {
                    if func.function.is_async {
                        async_funcs.insert(func.ident.sym.to_string());
                    }
                }
                ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) => {
                    for decl in &var.decls {
                        if let Some(init) = &decl.init {
                            if let Expr::Arrow(arrow) = &**init {
                                if arrow.is_async {
                                    if let Pat::Ident(ident) = &decl.name {
                                        async_funcs.insert(ident.id.sym.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        async_funcs
    }

    fn check_missing_awaits_in_module_decl(
        &self,
        decl: &ModuleDecl,
        async_functions: &HashSet<String>,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        match decl {
            ModuleDecl::ExportDecl(export) => {
                self.check_missing_awaits_in_decl(&export.decl, async_functions, issues);
            }
            ModuleDecl::ExportDefaultDecl(export) => match &export.decl {
                DefaultDecl::Class(class) => {
                    for member in &class.class.body {
                        self.check_missing_awaits_in_class_member(member, async_functions, issues);
                    }
                }
                DefaultDecl::Fn(func) => {
                    if let Some(body) = &func.function.body {
                        self.check_missing_awaits_in_block(
                            body,
                            async_functions,
                            func.function.is_async,
                            issues,
                        );
                    }
                }
                _ => {}
            },
            _ => {}
        }
    }

    fn check_missing_awaits_in_decl(
        &self,
        decl: &Decl,
        async_functions: &HashSet<String>,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        match decl {
            Decl::Class(class) => {
                for member in &class.class.body {
                    self.check_missing_awaits_in_class_member(member, async_functions, issues);
                }
            }
            Decl::Fn(func) => {
                if let Some(body) = &func.function.body {
                    self.check_missing_awaits_in_block(
                        body,
                        async_functions,
                        func.function.is_async,
                        issues,
                    );
                }
            }
            Decl::Var(var) => {
                for decl in &var.decls {
                    if let Some(init) = &decl.init {
                        self.check_missing_awaits_in_expr(init, async_functions, false, issues);
                    }
                }
            }
            _ => {}
        }
    }

    fn check_missing_awaits_in_class_member(
        &self,
        member: &ClassMember,
        async_functions: &HashSet<String>,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        match member {
            ClassMember::Constructor(constructor) => {
                if let Some(body) = &constructor.body {
                    self.check_missing_awaits_in_block(body, async_functions, false, issues);
                }
            }
            ClassMember::Method(method) => {
                if let Some(body) = &method.function.body {
                    self.check_missing_awaits_in_block(
                        body,
                        async_functions,
                        method.function.is_async,
                        issues,
                    );
                }
            }
            ClassMember::ClassProp(prop) => {
                if let Some(value) = &prop.value {
                    self.check_missing_awaits_in_expr(value, async_functions, false, issues);
                }
            }
            _ => {}
        }
    }

    fn check_missing_awaits_in_stmt(
        &self,
        stmt: &Stmt,
        async_functions: &HashSet<String>,
        in_async_context: bool,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        match stmt {
            Stmt::Block(block) => {
                self.check_missing_awaits_in_block(
                    block,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Stmt::Expr(expr) => {
                self.check_missing_awaits_in_expr(
                    &expr.expr,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Stmt::Decl(decl) => {
                self.check_missing_awaits_in_decl(decl, async_functions, issues);
            }
            Stmt::Return(ret) => {
                if let Some(arg) = &ret.arg {
                    self.check_missing_awaits_in_expr(
                        arg,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
            }
            Stmt::If(if_stmt) => {
                self.check_missing_awaits_in_expr(
                    &if_stmt.test,
                    async_functions,
                    in_async_context,
                    issues,
                );
                self.check_missing_awaits_in_stmt(
                    &if_stmt.cons,
                    async_functions,
                    in_async_context,
                    issues,
                );
                if let Some(alt) = &if_stmt.alt {
                    self.check_missing_awaits_in_stmt(
                        alt,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
            }
            Stmt::While(while_stmt) => {
                self.check_missing_awaits_in_expr(
                    &while_stmt.test,
                    async_functions,
                    in_async_context,
                    issues,
                );
                self.check_missing_awaits_in_stmt(
                    &while_stmt.body,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Stmt::For(for_stmt) => {
                if let Some(init) = &for_stmt.init {
                    match init {
                        VarDeclOrExpr::VarDecl(var) => {
                            for decl in &var.decls {
                                if let Some(init) = &decl.init {
                                    self.check_missing_awaits_in_expr(
                                        init,
                                        async_functions,
                                        in_async_context,
                                        issues,
                                    );
                                }
                            }
                        }
                        VarDeclOrExpr::Expr(expr) => {
                            self.check_missing_awaits_in_expr(
                                expr,
                                async_functions,
                                in_async_context,
                                issues,
                            );
                        }
                    }
                }
                if let Some(test) = &for_stmt.test {
                    self.check_missing_awaits_in_expr(
                        test,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
                if let Some(update) = &for_stmt.update {
                    self.check_missing_awaits_in_expr(
                        update,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
                self.check_missing_awaits_in_stmt(
                    &for_stmt.body,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Stmt::Switch(switch) => {
                self.check_missing_awaits_in_expr(
                    &switch.discriminant,
                    async_functions,
                    in_async_context,
                    issues,
                );
                for case in &switch.cases {
                    if let Some(test) = &case.test {
                        self.check_missing_awaits_in_expr(
                            test,
                            async_functions,
                            in_async_context,
                            issues,
                        );
                    }
                    for stmt in &case.cons {
                        self.check_missing_awaits_in_stmt(
                            stmt,
                            async_functions,
                            in_async_context,
                            issues,
                        );
                    }
                }
            }
            Stmt::Try(try_stmt) => {
                self.check_missing_awaits_in_block(
                    &try_stmt.block,
                    async_functions,
                    in_async_context,
                    issues,
                );
                if let Some(handler) = &try_stmt.handler {
                    self.check_missing_awaits_in_block(
                        &handler.body,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
                if let Some(finalizer) = &try_stmt.finalizer {
                    self.check_missing_awaits_in_block(
                        finalizer,
                        async_functions,
                        in_async_context,
                        issues,
                    );
                }
            }
            _ => {}
        }
    }

    fn check_missing_awaits_in_block(
        &self,
        block: &BlockStmt,
        async_functions: &HashSet<String>,
        in_async_context: bool,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        for stmt in &block.stmts {
            self.check_missing_awaits_in_stmt(stmt, async_functions, in_async_context, issues);
        }
    }

    fn check_missing_awaits_in_expr(
        &self,
        expr: &Expr,
        async_functions: &HashSet<String>,
        in_async_context: bool,
        issues: &mut Vec<TypeScriptIssue>,
    ) {
        match expr {
            Expr::Call(call) => {
                // Check if this is a call to an async function without await
                if let Some(callee_expr) = call.callee.as_expr() {
                    let is_async_call = match &**callee_expr {
                        Expr::Ident(ident) => async_functions.contains(&ident.sym.to_string()),
                        Expr::Member(member) => {
                            // Check for method calls that might be async
                            if let MemberProp::Ident(prop) = &member.prop {
                                // Common async method patterns
                                let method_name = prop.sym.to_string();
                                method_name.ends_with("Async")
                                    || method_name.starts_with("fetch")
                                    || method_name == "then"
                                    || method_name == "catch"
                            } else {
                                false
                            }
                        }
                        _ => false,
                    };

                    if is_async_call && in_async_context {
                        let (line, column) = self.get_location(call.span);
                        let identifier = match &**callee_expr {
                            Expr::Ident(ident) => ident.sym.to_string(),
                            Expr::Member(member) => {
                                if let MemberProp::Ident(prop) = &member.prop {
                                    prop.sym.to_string()
                                } else {
                                    "unknown".to_string()
                                }
                            }
                            _ => "unknown".to_string(),
                        };

                        issues.push(TypeScriptIssue {
                            issue_type: TsIssueType::MissingAwait,
                            line,
                            column,
                            identifier: identifier.clone(),
                            description: format!(
                                "Async function '{}' is called without 'await'. This may lead to unhandled promises.",
                                identifier
                            ),
                        });
                    }

                    // Recursively check arguments
                    for arg in &call.args {
                        self.check_missing_awaits_in_expr(
                            &arg.expr,
                            async_functions,
                            in_async_context,
                            issues,
                        );
                    }
                }
            }
            Expr::Await(_) => {
                // Await expressions are fine, no issue
            }
            Expr::Arrow(arrow) => match &*arrow.body {
                BlockStmtOrExpr::BlockStmt(block) => {
                    self.check_missing_awaits_in_block(
                        block,
                        async_functions,
                        arrow.is_async,
                        issues,
                    );
                }
                BlockStmtOrExpr::Expr(expr) => {
                    self.check_missing_awaits_in_expr(
                        expr,
                        async_functions,
                        arrow.is_async,
                        issues,
                    );
                }
            },
            Expr::Bin(bin) => {
                self.check_missing_awaits_in_expr(
                    &bin.left,
                    async_functions,
                    in_async_context,
                    issues,
                );
                self.check_missing_awaits_in_expr(
                    &bin.right,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::Unary(unary) => {
                self.check_missing_awaits_in_expr(
                    &unary.arg,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::Assign(assign) => {
                self.check_missing_awaits_in_expr(
                    &assign.right,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::Array(array) => {
                for elem in &array.elems {
                    if let Some(elem) = elem {
                        self.check_missing_awaits_in_expr(
                            &elem.expr,
                            async_functions,
                            in_async_context,
                            issues,
                        );
                    }
                }
            }
            Expr::Object(obj) => {
                for prop in &obj.props {
                    match prop {
                        PropOrSpread::Prop(prop) => match &**prop {
                            Prop::KeyValue(kv) => {
                                self.check_missing_awaits_in_expr(
                                    &kv.value,
                                    async_functions,
                                    in_async_context,
                                    issues,
                                );
                            }
                            Prop::Method(method) => {
                                if let Some(body) = &method.function.body {
                                    self.check_missing_awaits_in_block(
                                        body,
                                        async_functions,
                                        method.function.is_async,
                                        issues,
                                    );
                                }
                            }
                            _ => {}
                        },
                        PropOrSpread::Spread(spread) => {
                            self.check_missing_awaits_in_expr(
                                &spread.expr,
                                async_functions,
                                in_async_context,
                                issues,
                            );
                        }
                    }
                }
            }
            Expr::Cond(cond) => {
                self.check_missing_awaits_in_expr(
                    &cond.test,
                    async_functions,
                    in_async_context,
                    issues,
                );
                self.check_missing_awaits_in_expr(
                    &cond.cons,
                    async_functions,
                    in_async_context,
                    issues,
                );
                self.check_missing_awaits_in_expr(
                    &cond.alt,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::Paren(paren) => {
                self.check_missing_awaits_in_expr(
                    &paren.expr,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::Member(member) => {
                self.check_missing_awaits_in_expr(
                    &member.obj,
                    async_functions,
                    in_async_context,
                    issues,
                );
            }
            Expr::New(new) => {
                if let Some(args) = &new.args {
                    for arg in args {
                        self.check_missing_awaits_in_expr(
                            &arg.expr,
                            async_functions,
                            in_async_context,
                            issues,
                        );
                    }
                }
            }
            _ => {}
        }
    }

    pub fn detect_duplicate_logic(&self) -> Vec<TypeScriptIssue> {
        let mut issues = Vec::new();

        // Collect all code blocks (functions, methods, arrow functions)
        let code_blocks = self.collect_code_blocks();

        // Compare code blocks to find duplicates
        for i in 0..code_blocks.len() {
            for j in (i + 1)..code_blocks.len() {
                let block1 = &code_blocks[i];
                let block2 = &code_blocks[j];

                // Calculate similarity between blocks
                let similarity = self.calculate_similarity(&block1.statements, &block2.statements);

                // If similarity is high (> 80%), report as duplicate
                if similarity > 0.8 {
                    let (line, column) = self.get_location(block2.span);
                    issues.push(TypeScriptIssue {
                        issue_type: TsIssueType::DuplicateLogic,
                        line,
                        column,
                        identifier: block2.name.clone(),
                        description: format!(
                            "Code block '{}' at line {} is very similar ({:.0}% match) to '{}' at line {}. Consider extracting common logic into a shared function.",
                            block2.name, line, similarity * 100.0, block1.name, block1.line
                        ),
                    });
                }
            }
        }

        issues
    }

    /// Collect all code blocks from the module
    fn collect_code_blocks(&self) -> Vec<CodeBlock> {
        let mut blocks = Vec::new();

        for item in &self.module.body {
            match item {
                ModuleItem::ModuleDecl(decl) => {
                    self.collect_blocks_from_module_decl(decl, &mut blocks);
                }
                ModuleItem::Stmt(stmt) => {
                    self.collect_blocks_from_stmt(stmt, &mut blocks);
                }
            }
        }

        blocks
    }

    fn collect_blocks_from_module_decl(&self, decl: &ModuleDecl, blocks: &mut Vec<CodeBlock>) {
        match decl {
            ModuleDecl::ExportDecl(export) => {
                self.collect_blocks_from_decl(&export.decl, blocks);
            }
            ModuleDecl::ExportDefaultDecl(export) => match &export.decl {
                DefaultDecl::Class(class) => {
                    for member in &class.class.body {
                        self.collect_blocks_from_class_member(member, blocks);
                    }
                }
                DefaultDecl::Fn(func) => {
                    if let Some(body) = &func.function.body {
                        let name = func
                            .ident
                            .as_ref()
                            .map(|id| id.sym.to_string())
                            .unwrap_or_else(|| "anonymous".to_string());
                        let (line, _) = self.get_location(func.function.span);
                        blocks.push(CodeBlock {
                            name,
                            span: func.function.span,
                            line,
                            statements: self.extract_statement_patterns(&body.stmts),
                        });
                    }
                }
                _ => {}
            },
            _ => {}
        }
    }

    fn collect_blocks_from_decl(&self, decl: &Decl, blocks: &mut Vec<CodeBlock>) {
        match decl {
            Decl::Class(class) => {
                for member in &class.class.body {
                    self.collect_blocks_from_class_member(member, blocks);
                }
            }
            Decl::Fn(func) => {
                if let Some(body) = &func.function.body {
                    let (line, _) = self.get_location(func.function.span);
                    blocks.push(CodeBlock {
                        name: func.ident.sym.to_string(),
                        span: func.function.span,
                        line,
                        statements: self.extract_statement_patterns(&body.stmts),
                    });
                }
            }
            Decl::Var(var) => {
                for var_decl in &var.decls {
                    if let Some(init) = &var_decl.init {
                        if let Expr::Arrow(arrow) = &**init {
                            if let BlockStmtOrExpr::BlockStmt(block) = &*arrow.body {
                                let name = if let Pat::Ident(ident) = &var_decl.name {
                                    ident.id.sym.to_string()
                                } else {
                                    "anonymous".to_string()
                                };
                                let (line, _) = self.get_location(arrow.span);
                                blocks.push(CodeBlock {
                                    name,
                                    span: arrow.span,
                                    line,
                                    statements: self.extract_statement_patterns(&block.stmts),
                                });
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn collect_blocks_from_stmt(&self, stmt: &Stmt, blocks: &mut Vec<CodeBlock>) {
        match stmt {
            Stmt::Decl(decl) => {
                self.collect_blocks_from_decl(decl, blocks);
            }
            _ => {}
        }
    }

    fn collect_blocks_from_class_member(&self, member: &ClassMember, blocks: &mut Vec<CodeBlock>) {
        match member {
            ClassMember::Constructor(constructor) => {
                if let Some(body) = &constructor.body {
                    let (line, _) = self.get_location(constructor.span);
                    blocks.push(CodeBlock {
                        name: "constructor".to_string(),
                        span: constructor.span,
                        line,
                        statements: self.extract_statement_patterns(&body.stmts),
                    });
                }
            }
            ClassMember::Method(method) => {
                if let Some(body) = &method.function.body {
                    let name = match &method.key {
                        PropName::Ident(ident) => ident.sym.to_string(),
                        PropName::Str(s) => s.value.to_string(),
                        _ => "unknown".to_string(),
                    };
                    let (line, _) = self.get_location(method.span);
                    blocks.push(CodeBlock {
                        name,
                        span: method.span,
                        line,
                        statements: self.extract_statement_patterns(&body.stmts),
                    });
                }
            }
            _ => {}
        }
    }

    /// Extract normalized patterns from statements for comparison
    fn extract_statement_patterns(&self, stmts: &[Stmt]) -> Vec<String> {
        let mut patterns = Vec::new();

        for stmt in stmts {
            patterns.push(self.normalize_statement(stmt));
        }

        patterns
    }

    /// Normalize a statement to a pattern string for comparison
    fn normalize_statement(&self, stmt: &Stmt) -> String {
        match stmt {
            Stmt::Expr(expr) => {
                format!("EXPR:{}", self.normalize_expr(&expr.expr))
            }
            Stmt::Decl(decl) => match decl {
                Decl::Var(_) => "DECL:VAR".to_string(),
                Decl::Fn(_) => "DECL:FN".to_string(),
                Decl::Class(_) => "DECL:CLASS".to_string(),
                _ => "DECL:OTHER".to_string(),
            },
            Stmt::Return(ret) => {
                if let Some(arg) = &ret.arg {
                    format!("RETURN:{}", self.normalize_expr(arg))
                } else {
                    "RETURN:VOID".to_string()
                }
            }
            Stmt::If(_) => "IF".to_string(),
            Stmt::While(_) => "WHILE".to_string(),
            Stmt::For(_) => "FOR".to_string(),
            Stmt::Switch(_) => "SWITCH".to_string(),
            Stmt::Try(_) => "TRY".to_string(),
            Stmt::Throw(_) => "THROW".to_string(),
            Stmt::Block(_) => "BLOCK".to_string(),
            _ => "STMT:OTHER".to_string(),
        }
    }

    /// Normalize an expression to a pattern string
    fn normalize_expr(&self, expr: &Expr) -> String {
        match expr {
            Expr::Call(call) => {
                let callee = if let Some(callee_expr) = call.callee.as_expr() {
                    match &**callee_expr {
                        Expr::Ident(ident) => ident.sym.to_string(),
                        Expr::Member(_) => "MEMBER_CALL".to_string(),
                        _ => "CALL".to_string(),
                    }
                } else {
                    "CALL".to_string()
                };
                format!("CALL:{}", callee)
            }
            Expr::Member(member) => {
                if let MemberProp::Ident(prop) = &member.prop {
                    format!("MEMBER:{}", prop.sym)
                } else {
                    "MEMBER:COMPUTED".to_string()
                }
            }
            Expr::Bin(bin) => {
                format!("BIN:{:?}", bin.op)
            }
            Expr::Assign(_) => "ASSIGN".to_string(),
            Expr::Await(_) => "AWAIT".to_string(),
            Expr::Array(_) => "ARRAY".to_string(),
            Expr::Object(_) => "OBJECT".to_string(),
            Expr::Arrow(_) => "ARROW".to_string(),
            Expr::Lit(_) => "LIT".to_string(),
            Expr::Ident(ident) => format!("IDENT:{}", ident.sym),
            Expr::New(_) => "NEW".to_string(),
            Expr::Cond(_) => "COND".to_string(),
            _ => "EXPR:OTHER".to_string(),
        }
    }

    /// Calculate similarity between two statement pattern lists
    fn calculate_similarity(&self, stmts1: &[String], stmts2: &[String]) -> f64 {
        // Require minimum length for comparison
        if stmts1.len() < 3 || stmts2.len() < 3 {
            return 0.0;
        }

        // Use Longest Common Subsequence (LCS) algorithm
        let lcs_length = self.lcs_length(stmts1, stmts2);
        let max_length = stmts1.len().max(stmts2.len());

        if max_length == 0 {
            return 0.0;
        }

        lcs_length as f64 / max_length as f64
    }

    /// Calculate the length of the Longest Common Subsequence
    fn lcs_length(&self, a: &[String], b: &[String]) -> usize {
        let m = a.len();
        let n = b.len();

        if m == 0 || n == 0 {
            return 0;
        }

        let mut dp = vec![vec![0; n + 1]; m + 1];

        for i in 1..=m {
            for j in 1..=n {
                if a[i - 1] == b[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
                }
            }
        }

        dp[m][n]
    }
}
