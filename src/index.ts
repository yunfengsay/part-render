import { CodeScanner } from './core/CodeScanner';
import { JSXCompiler } from './core/JSXCompiler';
import { ComponentDetector, ComponentInfo } from './core/ComponentDetector';
import { LivePreviewServer, PreviewServerConfig } from './preview/LivePreviewServer';
import { OpenAIProvider } from './ai/OpenAIProvider';
import { OllamaProvider } from './ai/OllamaProvider';
import { Executor, SimpleExecutor } from './runtime/Executor';
import { logger } from './utils/Logger';
import {
  RenderConfig,
  JSXSnippet,
  RenderResult,
  PartRenderOptions,
  AIModelResponse,
  CodeContext
} from './types';

export class PartRender {
  private config: RenderConfig;
  private codeContext: CodeContext | null = null;
  private aiProvider: OpenAIProvider | OllamaProvider | null = null;
  private componentDetector: ComponentDetector | null = null;
  private components: ComponentInfo[] = [];
  private previewServer: LivePreviewServer | null = null;

  constructor(config: RenderConfig) {
    this.config = config;
    
    // Configure logger if settings provided
    if (config.logger) {
      logger.configure(config.logger);
    }
    
    this.initializeAIProvider();
  }

  private initializeAIProvider(): void {
    if (this.config.aiProvider === 'openai' && this.config.openaiApiKey) {
      this.aiProvider = new OpenAIProvider(this.config.openaiApiKey);
    } else if (this.config.aiProvider === 'ollama') {
      this.aiProvider = new OllamaProvider(
        this.config.ollamaBaseUrl,
        this.config.ollamaModel
      );
    }
  }

  async initialize(): Promise<void> {
    const scanner = new CodeScanner(this.config.projectRoot);
    this.codeContext = await scanner.scanProject();
    
    // Initialize component detector
    this.componentDetector = new ComponentDetector(this.config.projectRoot);
    this.components = this.componentDetector.detectComponents(this.codeContext.projectFiles);
    
    logger.core.info(`🔍 Detected ${this.components.length} components`);
  }

  async renderJSX(
    snippet: JSXSnippet,
    options: PartRenderOptions = {}
  ): Promise<RenderResult> {
    if (!this.codeContext) {
      await this.initialize();
    }

    if (!this.codeContext) {
      throw new Error('Failed to initialize code context');
    }

    const compiler = new JSXCompiler(this.codeContext);
    const compilationResult = await compiler.compileJSXSnippet(snippet);

    if (!compilationResult.success || !compilationResult.code) {
      return {
        success: false,
        error: compilationResult.error || 'Compilation failed'
      };
    }

    const executor = this.createExecutor(options);
    return await executor.executeCode(compilationResult.code);
  }

  async generateCodeWithAI(prompt: string, context?: string): Promise<AIModelResponse> {
    if (!this.aiProvider) {
      return {
        success: false,
        error: 'AI provider not configured'
      };
    }

    const fullContext = this.buildAIContext(context);
    return await this.aiProvider.generateCode(prompt, fullContext);
  }

  async analyzeCodeWithAI(code: string, question: string): Promise<AIModelResponse> {
    if (!this.aiProvider) {
      return {
        success: false,
        error: 'AI provider not configured'
      };
    }

    return await this.aiProvider.analyzeCode(code, question);
  }

  async optimizeCodeWithAI(code: string, requirements?: string): Promise<AIModelResponse> {
    if (!this.aiProvider) {
      return {
        success: false,
        error: 'AI provider not configured'
      };
    }

    return await this.aiProvider.optimizeCode(code, requirements);
  }

  async validateJSX(code: string): Promise<{ valid: boolean; errors?: string[] }> {
    if (!this.codeContext) {
      await this.initialize();
    }

    if (!this.codeContext) {
      throw new Error('Failed to initialize code context');
    }

    const compiler = new JSXCompiler(this.codeContext);
    return await compiler.validateJSX(code);
  }

  getProjectInfo(): {
    dependencies: Record<string, string>;
    fileCount: number;
    exports: Record<string, string[]>;
  } | null {
    if (!this.codeContext) {
      return null;
    }

    const scanner = new CodeScanner(this.config.projectRoot);
    const exports = scanner.findExports(this.codeContext.projectFiles);

    return {
      dependencies: this.codeContext.dependencies,
      fileCount: this.codeContext.projectFiles.length,
      exports
    };
  }

  async refreshContext(): Promise<void> {
    await this.initialize();
    
    // Update preview server if running
    if (this.previewServer && this.codeContext) {
      this.previewServer.updateComponents(this.components);
      this.previewServer.updateCodeContext(this.codeContext);
    }
  }

  async startPreviewServer(config?: Partial<PreviewServerConfig>): Promise<void> {
    if (!this.codeContext) {
      await this.initialize();
    }

    const serverConfig: PreviewServerConfig = {
      port: 3000,
      host: 'localhost',
      projectRoot: this.config.projectRoot,
      hmr: true,
      ...config
    };

    this.previewServer = new LivePreviewServer(serverConfig);
    await this.previewServer.start(this.components, this.codeContext!);
  }

  async stopPreviewServer(): Promise<void> {
    if (this.previewServer) {
      await this.previewServer.stop();
      this.previewServer = null;
    }
  }

  getDetectedComponents(): ComponentInfo[] {
    return this.components;
  }

  async analyzeComponent(filePath: string, componentName: string): Promise<ComponentInfo | null> {
    const component = this.components.find(c => 
      c.filePath === filePath && c.name === componentName
    );
    
    if (!component) {
      return null;
    }

    // Enhanced analysis with AI
    if (this.aiProvider) {
      const fileContent = this.codeContext?.projectFiles.find(f => f.path === filePath)?.content;
      if (fileContent) {
        const analysis = await this.aiProvider.analyzeCode(
          fileContent,
          `Analyze the React component "${componentName}" and provide insights about its props, usage patterns, and potential improvements.`
        );
        
        return {
          ...component,
          aiAnalysis: analysis.success ? analysis.data : undefined
        } as ComponentInfo & { aiAnalysis?: string };
      }
    }

    return component;
  }

  private createExecutor(options: PartRenderOptions): Executor | SimpleExecutor {
    try {
      return new Executor(options);
    } catch (error) {
      logger.executor.warn('VM2 not available, falling back to simple executor', error);
      return new SimpleExecutor(options);
    }
  }

  private buildAIContext(additionalContext?: string): string {
    if (!this.codeContext) {
      return additionalContext || '';
    }

    const projectInfo = this.getProjectInfo();
    const contextParts = [
      `Project has ${projectInfo?.fileCount} files`,
      `Dependencies: ${Object.keys(projectInfo?.dependencies || {}).join(', ')}`,
      `Available exports: ${Object.entries(projectInfo?.exports || {})
        .map(([file, exports]) => `${file}: ${exports.join(', ')}`)
        .slice(0, 10)
        .join('; ')}`
    ];

    if (additionalContext) {
      contextParts.push(additionalContext);
    }

    return contextParts.join('\n');
  }
}

export * from './types';
export { CodeScanner } from './core/CodeScanner';
export { JSXCompiler } from './core/JSXCompiler';
export { ComponentDetector, ComponentInfo } from './core/ComponentDetector';
export { LivePreviewServer, PreviewServerConfig } from './preview/LivePreviewServer';
export { OpenAIProvider } from './ai/OpenAIProvider';
export { OllamaProvider } from './ai/OllamaProvider';
export { Executor, SimpleExecutor } from './runtime/Executor';
export { logger, Logger, LogLevel, LogCategory } from './utils/Logger';

export default PartRender;