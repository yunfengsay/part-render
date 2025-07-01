import { SmartCompiler } from './SmartCompiler';
import { DependencyResolver } from './DependencyResolver';
import { IsolatedRenderer } from '../preview/IsolatedRenderer';
import { CodeCompleter } from '../ai/CodeCompleter';
import { CodeScanner } from './CodeScanner';
import { logger } from '../utils/Logger';
import { CodeContext, RenderResult } from '../types';

export interface PartialRenderOptions {
  projectRoot: string;
  enableAI?: boolean;
  aiModel?: string;
  ollamaBaseUrl?: string;
  mockProps?: Record<string, any>;
  styles?: string;
}

export interface PartialRenderResult extends RenderResult {
  html?: string;
  suggestions?: string[];
  usedImports?: string[];
}

export class PartialRenderer {
  private options: PartialRenderOptions;
  private compiler: SmartCompiler;
  private renderer: IsolatedRenderer;
  private codeCompleter?: CodeCompleter;
  private dependencyResolver: DependencyResolver;
  private codeContext?: CodeContext;

  constructor(options: PartialRenderOptions) {
    this.options = options;
    this.dependencyResolver = new DependencyResolver(options.projectRoot);
    this.renderer = new IsolatedRenderer();
    
    if (options.enableAI) {
      this.codeCompleter = new CodeCompleter(options.ollamaBaseUrl, options.aiModel);
    }
  }

  async initialize(): Promise<void> {
    logger.core.info('Initializing PartialRenderer');
    
    // 扫描项目
    const scanner = new CodeScanner(this.options.projectRoot);
    this.codeContext = await scanner.scanProject();
    
    // 初始化编译器
    this.compiler = new SmartCompiler(this.options.projectRoot, this.codeContext);
    
    logger.core.info('PartialRenderer initialized successfully');
  }

  async renderPartial(code: string, filePath?: string): Promise<PartialRenderResult> {
    if (!this.codeContext) {
      await this.initialize();
    }

    try {
      // 1. 分析代码依赖
      const dependencies = await this.dependencyResolver.analyzeDependencies(code, filePath);
      
      logger.core.debug(`Found ${dependencies.missingIdentifiers.size} missing identifiers`);

      // 2. 如果启用AI且有缺失的部分，使用AI补全
      let finalCode = code;
      let suggestions: string[] = [];
      
      if (this.options.enableAI && this.codeCompleter && dependencies.missingIdentifiers.size > 0) {
        logger.ai.info('Using AI to complete partial code');
        
        const completion = await this.codeCompleter.completePartialCode({
          code,
          dependencies,
          projectContext: this.getProjectContext()
        });
        
        if (completion.confidence > 0.7) {
          finalCode = completion.completedCode;
          suggestions = completion.suggestions;
          logger.ai.info(`AI completion confidence: ${completion.confidence}`);
        }
      }

      // 3. 编译代码
      const compilationResult = await this.compiler.compile({
        code: finalCode,
        filePath,
        mockProps: this.options.mockProps,
        wrapComponent: true
      });

      if (!compilationResult.success) {
        return {
          success: false,
          error: compilationResult.error,
          suggestions
        };
      }

      // 4. 渲染组件
      const renderResult = await this.renderer.render({
        compiledCode: compilationResult.code!,
        props: this.options.mockProps,
        styles: this.options.styles
      });

      if (renderResult.error) {
        return {
          success: false,
          error: renderResult.error,
          html: renderResult.html,
          suggestions
        };
      }

      // 5. 返回成功结果
      return {
        success: true,
        html: renderResult.html,
        output: { componentName: renderResult.componentName },
        suggestions,
        usedImports: Array.from(dependencies.imports.map(i => i.module))
      };

    } catch (error) {
      logger.core.error('Partial render failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async renderMultiple(
    codeSnippets: Array<{ code: string; name: string; filePath?: string }>
  ): Promise<Map<string, PartialRenderResult>> {
    const results = new Map<string, PartialRenderResult>();

    for (const snippet of codeSnippets) {
      logger.core.info(`Rendering ${snippet.name}`);
      const result = await this.renderPartial(snippet.code, snippet.filePath);
      results.set(snippet.name, result);
    }

    return results;
  }

  private getProjectContext(): string {
    if (!this.codeContext) return '';

    const info = {
      fileCount: this.codeContext.projectFiles.length,
      dependencies: Object.keys(this.codeContext.dependencies).slice(0, 10),
      hasTypeScript: !!this.codeContext.tsConfig,
      frameworks: this.detectFrameworks()
    };

    return JSON.stringify(info, null, 2);
  }

  private detectFrameworks(): string[] {
    const frameworks: string[] = [];
    const deps = this.codeContext?.dependencies || {};

    if (deps['react']) frameworks.push('react');
    if (deps['vue']) frameworks.push('vue');
    if (deps['@angular/core']) frameworks.push('angular');
    if (deps['svelte']) frameworks.push('svelte');
    if (deps['next']) frameworks.push('nextjs');
    if (deps['gatsby']) frameworks.push('gatsby');

    return frameworks;
  }

  dispose(): void {
    this.renderer.dispose();
    if (this.codeCompleter) {
      this.codeCompleter.clearCache();
    }
  }
}