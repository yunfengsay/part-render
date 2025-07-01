import * as esbuild from 'esbuild';
import { CodeContext, JSXSnippet, CompilationResult } from '../types';

export class JSXCompiler {
  private codeContext: CodeContext;

  constructor(codeContext: CodeContext) {
    this.codeContext = codeContext;
  }

  async compileJSXSnippet(snippet: JSXSnippet): Promise<CompilationResult> {
    try {
      const fullCode = this.mergeSnippetWithContext(snippet);
      const result = await this.compileWithEsbuild(fullCode, snippet.fileName || 'snippet.tsx');
      
      return {
        success: true,
        code: result.outputFiles?.[0]?.text,
        warnings: result.warnings?.map(w => w.text)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private mergeSnippetWithContext(snippet: JSXSnippet): string {
    const imports = this.generateImports(snippet);
    const contextCode = this.generateContextCode();
    
    return `
${imports}
${contextCode}

// User JSX Snippet
${snippet.code}
`;
  }

  private generateImports(snippet: JSXSnippet): string {
    const defaultImports = [
      "import React from 'react';",
      "import ReactDOM from 'react-dom';"
    ];

    const customImports = snippet.dependencies?.map(dep => 
      this.generateImportForDependency(dep)
    ).filter(Boolean) || [];

    const projectImports = this.generateProjectImports();

    return [...defaultImports, ...customImports, ...projectImports].join('\n');
  }

  private generateImportForDependency(dependency: string): string {
    if (this.codeContext.dependencies[dependency]) {
      return `import * as ${this.sanitizeImportName(dependency)} from '${dependency}';`;
    }
    return '';
  }

  private generateProjectImports(): string[] {
    const imports: string[] = [];
    const exports = this.extractProjectExports();

    for (const [filePath, exportNames] of Object.entries(exports)) {
      if (exportNames.length > 0) {
        const importPath = this.convertToImportPath(filePath);
        const namedImports = exportNames.join(', ');
        imports.push(`import { ${namedImports} } from '${importPath}';`);
      }
    }

    return imports;
  }

  private extractProjectExports(): Record<string, string[]> {
    const exports: Record<string, string[]> = {};

    for (const file of this.codeContext.projectFiles) {
      if (['ts', 'tsx', 'js', 'jsx'].includes(file.type)) {
        const fileExports = this.extractExportsFromContent(file.content);
        if (fileExports.length > 0) {
          exports[file.path] = fileExports;
        }
      }
    }

    return exports;
  }

  private extractExportsFromContent(content: string): string[] {
    const exports: string[] = [];
    const patterns = [
      /export\s+(?:const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /export\s+default\s+(?:function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const namedExports = match[1]
        .split(',')
        .map(exp => exp.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      exports.push(...namedExports);
    }

    return [...new Set(exports)];
  }

  private generateContextCode(): string {
    const contextFiles = this.codeContext.projectFiles
      .filter(file => ['ts', 'tsx', 'js', 'jsx'].includes(file.type))
      .map(file => `// File: ${file.path}\n${file.content}`)
      .join('\n\n');

    return `
// Project Context Code
${contextFiles}
`;
  }

  private convertToImportPath(filePath: string): string {
    return './' + filePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  private sanitizeImportName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, '_');
  }

  private async compileWithEsbuild(code: string, fileName: string): Promise<esbuild.BuildResult> {
    return await esbuild.build({
      stdin: {
        contents: code,
        loader: fileName.endsWith('.tsx') ? 'tsx' : 'jsx',
        resolveDir: process.cwd()
      },
      bundle: false,
      write: false,
      target: 'es2020',
      format: 'cjs',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      define: {
        'global': 'globalThis',
        'process.env.NODE_ENV': '"development"'
      }
    });
  }

  async validateJSX(code: string): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      await esbuild.transform(code, {
        loader: 'tsx',
        jsx: 'transform'
      });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}