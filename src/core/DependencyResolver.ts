import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';

export interface ImportInfo {
  module: string;
  specifiers: {
    name: string;
    alias?: string;
    isDefault?: boolean;
    isNamespace?: boolean;
  }[];
  isRelative: boolean;
  resolvedPath?: string;
}

export interface DependencyContext {
  imports: ImportInfo[];
  usedIdentifiers: Set<string>;
  missingIdentifiers: Set<string>;
  resolvedModules: Map<string, string>;
}

export class DependencyResolver {
  private projectRoot: string;
  private tsProgram?: ts.Program;
  private moduleResolutionCache = new Map<string, string>();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.initializeTsProgram();
  }

  private initializeTsProgram(): void {
    const configPath = ts.findConfigFile(
      this.projectRoot,
      ts.sys.fileExists,
      'tsconfig.json'
    );

    if (configPath) {
      const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
      const { options, fileNames } = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(configPath)
      );

      this.tsProgram = ts.createProgram(fileNames, options);
    }
  }

  async analyzeDependencies(
    code: string,
    filePath?: string
  ): Promise<DependencyContext> {
    const sourceFile = ts.createSourceFile(
      filePath || 'snippet.tsx',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const imports: ImportInfo[] = [];
    const usedIdentifiers = new Set<string>();
    const declaredIdentifiers = new Set<string>();

    // 分析imports
    this.extractImports(sourceFile, imports);

    // 分析使用的标识符
    this.extractIdentifiers(sourceFile, usedIdentifiers, declaredIdentifiers);

    // 找出缺失的标识符
    const missingIdentifiers = new Set<string>();
    for (const id of usedIdentifiers) {
      if (!declaredIdentifiers.has(id) && !this.isBuiltinIdentifier(id)) {
        missingIdentifiers.add(id);
      }
    }

    // 解析模块路径
    const resolvedModules = new Map<string, string>();
    for (const imp of imports) {
      const resolved = await this.resolveModulePath(imp.module, filePath);
      if (resolved) {
        resolvedModules.set(imp.module, resolved);
        imp.resolvedPath = resolved;
      }
    }

    return {
      imports,
      usedIdentifiers,
      missingIdentifiers,
      resolvedModules
    };
  }

  private extractImports(sourceFile: ts.SourceFile, imports: ImportInfo[]): void {
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importInfo: ImportInfo = {
            module: moduleSpecifier.text,
            specifiers: [],
            isRelative: moduleSpecifier.text.startsWith('.') || moduleSpecifier.text.startsWith('/')
          };

          if (node.importClause) {
            // 默认导入
            if (node.importClause.name) {
              importInfo.specifiers.push({
                name: node.importClause.name.text,
                isDefault: true
              });
            }

            // 命名导入
            if (node.importClause.namedBindings) {
              if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                importInfo.specifiers.push({
                  name: node.importClause.namedBindings.name.text,
                  isNamespace: true
                });
              } else if (ts.isNamedImports(node.importClause.namedBindings)) {
                for (const element of node.importClause.namedBindings.elements) {
                  importInfo.specifiers.push({
                    name: element.propertyName?.text || element.name.text,
                    alias: element.propertyName ? element.name.text : undefined
                  });
                }
              }
            }
          }

          imports.push(importInfo);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractIdentifiers(
    sourceFile: ts.SourceFile,
    used: Set<string>,
    declared: Set<string>
  ): void {
    const visit = (node: ts.Node) => {
      // 记录声明的标识符
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        declared.add(node.name.text);
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        declared.add(node.name.text);
      } else if (ts.isClassDeclaration(node) && node.name) {
        declared.add(node.name.text);
      }

      // 记录使用的标识符
      if (ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent)) {
        used.add(node.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private isBuiltinIdentifier(id: string): boolean {
    const builtins = new Set([
      'console', 'window', 'document', 'process', 'global',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'Date',
      'Promise', 'Map', 'Set', 'Math', 'JSON', 'Error',
      'undefined', 'null', 'true', 'false'
    ]);
    return builtins.has(id);
  }

  async resolveModulePath(
    moduleName: string,
    fromFile?: string
  ): Promise<string | null> {
    const cacheKey = `${moduleName}:${fromFile || 'root'}`;
    if (this.moduleResolutionCache.has(cacheKey)) {
      return this.moduleResolutionCache.get(cacheKey) || null;
    }

    try {
      // 尝试使用TypeScript的模块解析
      if (this.tsProgram) {
        const result = ts.resolveModuleName(
          moduleName,
          fromFile || path.join(this.projectRoot, 'index.ts'),
          this.tsProgram.getCompilerOptions(),
          ts.sys
        );

        if (result.resolvedModule) {
          const resolvedPath = result.resolvedModule.resolvedFileName;
          this.moduleResolutionCache.set(cacheKey, resolvedPath);
          return resolvedPath;
        }
      }

      // 回退到Node.js解析
      const resolved = require.resolve(moduleName, {
        paths: [fromFile ? path.dirname(fromFile) : this.projectRoot]
      });
      this.moduleResolutionCache.set(cacheKey, resolved);
      return resolved;
    } catch (error) {
      logger.scanner.debug(`Failed to resolve module: ${moduleName}`, error);
      return null;
    }
  }

  async suggestImportsForIdentifiers(
    missingIdentifiers: Set<string>,
    projectFiles: Array<{ path: string; content: string }>
  ): Promise<Map<string, ImportInfo[]>> {
    const suggestions = new Map<string, ImportInfo[]>();

    for (const identifier of missingIdentifiers) {
      const possibleImports: ImportInfo[] = [];

      // 搜索项目文件中的导出
      for (const file of projectFiles) {
        const exports = this.extractExportsFromFile(file.content);
        
        if (exports.has(identifier)) {
          possibleImports.push({
            module: `./${path.relative(this.projectRoot, file.path)}`,
            specifiers: [{
              name: identifier,
              isDefault: exports.get(identifier) === 'default'
            }],
            isRelative: true,
            resolvedPath: file.path
          });
        }
      }

      // 检查常用的npm包
      const commonPackages = this.getCommonPackagesForIdentifier(identifier);
      for (const pkg of commonPackages) {
        possibleImports.push({
          module: pkg.module,
          specifiers: [{
            name: identifier,
            isDefault: pkg.isDefault
          }],
          isRelative: false
        });
      }

      if (possibleImports.length > 0) {
        suggestions.set(identifier, possibleImports);
      }
    }

    return suggestions;
  }

  private extractExportsFromFile(content: string): Map<string, string> {
    const exports = new Map<string, string>();
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.set(element.name.text, 'named');
        }
      } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.set(node.name.text, 'named');
        } else if (ts.isClassDeclaration(node) && node.name) {
          exports.set(node.name.text, 'named');
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach(decl => {
            if (ts.isIdentifier(decl.name)) {
              exports.set(decl.name.text, 'named');
            }
          });
        }
      } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.set(node.name.text, 'default');
        } else if (ts.isClassDeclaration(node) && node.name) {
          exports.set(node.name.text, 'default');
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports;
  }

  private getCommonPackagesForIdentifier(identifier: string): Array<{ module: string; isDefault: boolean }> {
    const commonMappings: Record<string, Array<{ module: string; isDefault: boolean }>> = {
      'React': [{ module: 'react', isDefault: true }],
      'useState': [{ module: 'react', isDefault: false }],
      'useEffect': [{ module: 'react', isDefault: false }],
      'useContext': [{ module: 'react', isDefault: false }],
      'useMemo': [{ module: 'react', isDefault: false }],
      'useCallback': [{ module: 'react', isDefault: false }],
      'useRef': [{ module: 'react', isDefault: false }],
      'styled': [{ module: 'styled-components', isDefault: true }],
      'css': [{ module: '@emotion/react', isDefault: false }],
      'clsx': [{ module: 'clsx', isDefault: true }],
      'classNames': [{ module: 'classnames', isDefault: true }],
      'axios': [{ module: 'axios', isDefault: true }],
      '_': [{ module: 'lodash', isDefault: true }],
      'moment': [{ module: 'moment', isDefault: true }],
      'dayjs': [{ module: 'dayjs', isDefault: true }]
    };

    return commonMappings[identifier] || [];
  }
}