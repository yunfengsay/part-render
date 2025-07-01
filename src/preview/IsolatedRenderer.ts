import * as ReactDOMServer from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { logger } from '../utils/Logger';

export interface RenderOptions {
  compiledCode: string;
  componentName?: string;
  props?: Record<string, any>;
  wrapper?: string;
  styles?: string;
}

export interface RenderResult {
  html: string;
  error?: string;
  componentName?: string;
}

export class IsolatedRenderer {
  private dom: JSDOM;
  private window: any;

  constructor() {
    // 创建一个隔离的DOM环境
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    this.window = this.dom.window;
    
    // 设置全局变量
    this.setupGlobals();
  }

  private setupGlobals(): void {
    // 模拟浏览器环境
    (global as any).window = this.window;
    (global as any).document = this.window.document;
    (global as any).navigator = this.window.navigator;
    (global as any).HTMLElement = this.window.HTMLElement;
    (global as any).Element = this.window.Element;
    (global as any).Node = this.window.Node;
    (global as any).Event = this.window.Event;
    (global as any).MouseEvent = this.window.MouseEvent;
    (global as any).KeyboardEvent = this.window.KeyboardEvent;
    
    // React需要的全局对象
    (global as any).requestAnimationFrame = (callback: Function) => {
      return setTimeout(callback, 0);
    };
    (global as any).cancelAnimationFrame = clearTimeout;
  }

  async render(options: RenderOptions): Promise<RenderResult> {
    try {
      // 创建一个新的执行上下文
      const moduleExports: any = {};
      const moduleRequire = this.createRequire();
      
      // 构建完整的代码
      const wrappedCode = this.wrapCode(options.compiledCode);
      
      // 创建并执行函数
      const func = new Function(
        'exports',
        'require',
        'module',
        '__dirname',
        '__filename',
        'React',
        'ReactDOM',
        wrappedCode
      );

      // 导入React
      const React = moduleRequire('react');
      const ReactDOM = moduleRequire('react-dom');

      // 执行代码
      func(
        moduleExports,
        moduleRequire,
        { exports: moduleExports },
        __dirname,
        __filename,
        React,
        ReactDOM
      );

      // 获取组件
      const Component = moduleExports.default || moduleExports[options.componentName || 'Component'];
      
      if (!Component) {
        throw new Error('No component found to render');
      }

      // 渲染组件
      const element = React.createElement(Component, options.props || {});
      
      // 使用错误边界包装
      const wrappedElement = React.createElement(
        ErrorBoundary,
        { fallback: this.renderError.bind(this) },
        element
      );

      // 服务端渲染
      const html = ReactDOMServer.renderToString(wrappedElement);

      // 包装HTML
      const finalHtml = this.wrapHtml(html, options);

      return {
        html: finalHtml,
        componentName: Component.name || 'Anonymous'
      };
    } catch (error) {
      logger.preview.error('Render failed', error);
      return {
        html: this.renderError(error),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createRequire(): any {
    return (moduleName: string) => {
      try {
        // 优先使用已加载的模块
        if (moduleName === 'react' || moduleName === 'react-dom') {
          return require(moduleName);
        }
        
        // 其他模块
        return require(moduleName);
      } catch (error) {
        logger.preview.warn(`Failed to require module: ${moduleName}`, error);
        // 返回一个mock对象
        return new Proxy({}, {
          get: () => () => null
        });
      }
    };
  }

  private wrapCode(code: string): string {
    // 移除可能的import语句（已经被esbuild处理）
    const codeWithoutImports = code.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    
    return `
      try {
        ${codeWithoutImports}
      } catch (error) {
        console.error('Code execution error:', error);
        throw error;
      }
    `;
  }

  private wrapHtml(componentHtml: string, options: RenderOptions): string {
    const styles = options.styles || this.getDefaultStyles();
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Component Preview</title>
          <style>${styles}</style>
        </head>
        <body>
          <div id="root">${componentHtml}</div>
        </body>
      </html>
    `;
  }

  private getDefaultStyles(): string {
    return `
      * {
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        color: #333;
        background-color: #f5f5f5;
      }
      
      #root {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        padding: 20px;
        min-height: 100px;
      }
      
      .error-boundary {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 12px 20px;
      }
      
      .error-boundary h3 {
        margin: 0 0 10px 0;
      }
      
      .error-boundary pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `;
  }

  private renderError(error: any): string {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    
    return `
      <div class="error-boundary">
        <h3>Render Error</h3>
        <pre>${message}</pre>
        ${stack ? `<details><summary>Stack Trace</summary><pre>${stack}</pre></details>` : ''}
      </div>
    `;
  }

  dispose(): void {
    this.dom.window.close();
  }
}

// React错误边界组件
class ErrorBoundary extends (require('react').Component) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    logger.preview.error('Component error caught by boundary', { error, errorInfo });
  }

  render() {
    if ((this.state as any).hasError) {
      return this.props.fallback((this.state as any).error);
    }

    return this.props.children;
  }
}