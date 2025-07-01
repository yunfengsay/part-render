import * as esbuild from 'esbuild';
import * as path from 'path';
import { DependencyResolver, ImportInfo } from './DependencyResolver';
import { logger } from '../utils/Logger';
import { CodeContext, CompilationResult } from '../types';

export interface SmartCompileOptions {
  code: string;
  filePath?: string;
  mockProps?: Record<string, any>;
  additionalImports?: ImportInfo[];
  wrapComponent?: boolean;
}

export class SmartCompiler {
  private dependencyResolver: DependencyResolver;
  private codeContext: CodeContext;
  private projectRoot: string;

  constructor(projectRoot: string, codeContext: CodeContext) {
    this.projectRoot = projectRoot;
    this.codeContext = codeContext;
    this.dependencyResolver = new DependencyResolver(projectRoot);
  }

  async compile(options: SmartCompileOptions): Promise<CompilationResult> {
    try {
      // 1. 分析代码的依赖
      const depContext = await this.dependencyResolver.analyzeDependencies(
        options.code,
        options.filePath
      );

      // 2. 如果有缺失的标识符，尝试自动推断imports
      let suggestedImports: ImportInfo[] = [];
      if (depContext.missingIdentifiers.size > 0) {
        const suggestions = await this.dependencyResolver.suggestImportsForIdentifiers(
          depContext.missingIdentifiers,
          this.codeContext.projectFiles
        );

        // 选择最可能的imports
        for (const [identifier, imports] of suggestions) {
          if (imports.length > 0) {
            suggestedImports.push(imports[0]);
            logger.compiler.debug(`Auto-importing ${identifier} from ${imports[0].module}`);
          }
        }
      }

      // 3. 生成完整的代码
      const fullCode = this.generateFullCode({
        ...options,
        existingImports: depContext.imports,
        suggestedImports,
        additionalImports: options.additionalImports || []
      });

      // 4. 使用esbuild编译
      const result = await esbuild.build({
        stdin: {
          contents: fullCode,
          loader: 'tsx',
          resolveDir: options.filePath ? path.dirname(options.filePath) : this.projectRoot
        },
        bundle: true,
        format: 'esm',
        platform: 'browser',
        jsx: 'automatic',
        jsxImportSource: 'react',
        write: false,
        plugins: [
          this.createResolvePlugin(depContext.resolvedModules)
        ],
        external: ['react-dom/client'], // 保持某些模块为外部依赖
        define: {
          'process.env.NODE_ENV': '"development"'
        }
      });

      if (result.errors.length > 0) {
        return {
          success: false,
          error: result.errors.map(e => e.text).join('\n')
        };
      }

      return {
        success: true,
        code: result.outputFiles![0].text,
        warnings: result.warnings.map(w => w.text)
      };
    } catch (error) {
      logger.compiler.error('Compilation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private generateFullCode(options: {
    code: string;
    existingImports: ImportInfo[];
    suggestedImports: ImportInfo[];
    additionalImports: ImportInfo[];
    mockProps?: Record<string, any>;
    wrapComponent?: boolean;
  }): string {
    const allImports = new Map<string, ImportInfo>();

    // 合并所有imports，避免重复
    [...options.existingImports, ...options.suggestedImports, ...options.additionalImports].forEach(imp => {
      const key = `${imp.module}:${imp.specifiers.map(s => s.name).join(',')}`;
      allImports.set(key, imp);
    });

    // 确保React被导入
    const hasReact = Array.from(allImports.values()).some(
      imp => imp.module === 'react' && imp.specifiers.some(s => s.isDefault && s.name === 'React')
    );
    
    if (!hasReact) {
      allImports.set('react:React', {
        module: 'react',
        specifiers: [{ name: 'React', isDefault: true }],
        isRelative: false
      });
    }

    // 生成import语句
    const importStatements = Array.from(allImports.values()).map(imp => {
      return this.generateImportStatement(imp);
    }).join('\n');

    // 检测组件并包装
    let componentCode = options.code;
    if (options.wrapComponent !== false) {
      componentCode = this.wrapComponentCode(options.code, options.mockProps);
    }

    return `
${importStatements}

${componentCode}
`;
  }

  private generateImportStatement(imp: ImportInfo): string {
    const specifierParts: string[] = [];

    for (const spec of imp.specifiers) {
      if (spec.isDefault) {
        specifierParts.unshift(spec.name);
      } else if (spec.isNamespace) {
        specifierParts.push(`* as ${spec.name}`);
      } else if (spec.alias) {
        specifierParts.push(`${spec.name} as ${spec.alias}`);
      } else {
        specifierParts.push(spec.name);
      }
    }

    const defaultImport = imp.specifiers.find(s => s.isDefault);
    const namedImports = imp.specifiers.filter(s => !s.isDefault && !s.isNamespace);
    const namespaceImport = imp.specifiers.find(s => s.isNamespace);

    let importClause = '';
    if (defaultImport) {
      importClause = defaultImport.name;
      if (namedImports.length > 0) {
        importClause += `, { ${namedImports.map(s => 
          s.alias ? `${s.name} as ${s.alias}` : s.name
        ).join(', ')} }`;
      }
    } else if (namespaceImport) {
      importClause = `* as ${namespaceImport.name}`;
    } else if (namedImports.length > 0) {
      importClause = `{ ${namedImports.map(s => 
        s.alias ? `${s.name} as ${s.alias}` : s.name
      ).join(', ')} }`;
    }

    return `import ${importClause} from '${imp.module}';`;
  }

  private wrapComponentCode(code: string, mockProps?: Record<string, any>): string {
    // 尝试检测组件名称
    const componentMatch = code.match(/(?:export\s+)?(?:default\s+)?(?:function|const|class)\s+(\w+)/);
    const componentName = componentMatch?.[1] || 'Component';

    // 如果代码已经包含导出，直接返回
    if (code.includes('export default') || code.includes('export {')) {
      return code;
    }

    // 生成mock props
    const propsJson = mockProps ? JSON.stringify(mockProps, null, 2) : '{}';

    return `
${code}

// Auto-generated preview wrapper
export default function PreviewWrapper() {
  const mockProps = ${propsJson};
  
  try {
    return <${componentName} {...mockProps} />;
  } catch (error) {
    return (
      <div style={{ 
        color: 'red', 
        padding: '20px', 
        border: '1px solid red',
        borderRadius: '4px',
        backgroundColor: '#ffebee'
      }}>
        <h3>Component Error</h3>
        <pre>{error.message}</pre>
      </div>
    );
  }
}
`;
  }

  private createResolvePlugin(resolvedModules: Map<string, string>): esbuild.Plugin {
    return {
      name: 'smart-resolve',
      setup(build) {
        // 处理已解析的模块
        build.onResolve({ filter: /.*/ }, (args) => {
          if (resolvedModules.has(args.path)) {
            return {
              path: resolvedModules.get(args.path)!,
              namespace: 'file'
            };
          }

          // 处理node_modules
          if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
            try {
              const resolved = require.resolve(args.path, {
                paths: [args.resolveDir]
              });
              return { path: resolved };
            } catch {
              // 标记为外部依赖
              return { external: true };
            }
          }

          return null;
        });
      }
    };
  }
}