import { VM } from 'vm2';
import { RenderResult, PartRenderOptions } from '../types';

export class Executor {
  private vm: VM;
  private options: PartRenderOptions;

  constructor(options: PartRenderOptions = {}) {
    this.options = {
      enableLogs: true,
      strictMode: false,
      customGlobals: {},
      ...options
    };

    this.vm = new VM({
      timeout: 30000,
      sandbox: this.createSandbox()
    });
  }

  async executeCode(compiledCode: string): Promise<RenderResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      const result = await this.runInSandbox(compiledCode, logs);
      
      return {
        success: true,
        output: result,
        logs: this.options.enableLogs ? logs : [],
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: this.options.enableLogs ? logs : [],
        executionTime: Date.now() - startTime
      };
    }
  }

  private createSandbox(): Record<string, any> {
    const logs: string[] = [];
    
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          logs.push(args.map(arg => String(arg)).join(' '));
        },
        error: (...args: any[]) => {
          logs.push('ERROR: ' + args.map(arg => String(arg)).join(' '));
        },
        warn: (...args: any[]) => {
          logs.push('WARN: ' + args.map(arg => String(arg)).join(' '));
        }
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Promise,
      ...this.options.customGlobals
    };

    return sandbox;
  }

  private async runInSandbox(code: string, logs: string[]): Promise<any> {
    const wrappedCode = `
      (function() {
        ${this.options.strictMode ? "'use strict';" : ''}
        ${code}
        
        // Try to return the last expression or exported component
        if (typeof module !== 'undefined' && module.exports) {
          return module.exports;
        }
        
        // Look for common export patterns
        const possibleExports = [
          typeof App !== 'undefined' ? App : null,
          typeof Component !== 'undefined' ? Component : null,
          typeof default !== 'undefined' ? default : null
        ].filter(Boolean);
        
        return possibleExports[0] || null;
      })();
    `;

    return this.vm.run(wrappedCode);
  }

  dispose(): void {
    // VM2 doesn't have an explicit dispose method, but we can clear references
    this.vm = null as any;
  }
}

// Fallback executor for when VM2 is not available
export class SimpleExecutor {
  private options: PartRenderOptions;

  constructor(options: PartRenderOptions = {}) {
    this.options = {
      enableLogs: true,
      strictMode: false,
      customGlobals: {},
      ...options
    };
  }

  async executeCode(compiledCode: string): Promise<RenderResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      const consoleMock = {
        log: (...args: any[]) => {
          logs.push(args.map(arg => String(arg)).join(' '));
        },
        error: (...args: any[]) => {
          logs.push('ERROR: ' + args.map(arg => String(arg)).join(' '));
        },
        warn: (...args: any[]) => {
          logs.push('WARN: ' + args.map(arg => String(arg)).join(' '));
        }
      };

      const originalConsole = global.console;
      global.console = consoleMock as any;

      let result;
      try {
        const func = new Function('require', 'module', 'exports', 'console', compiledCode);
        const mockModule = { exports: {} };
        const mockRequire = (name: string) => {
          throw new Error(`Module '${name}' not available in sandbox`);
        };

        func(mockRequire, mockModule, mockModule.exports, consoleMock);
        result = mockModule.exports;
      } finally {
        global.console = originalConsole;
      }

      return {
        success: true,
        output: result,
        logs: this.options.enableLogs ? logs : [],
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: this.options.enableLogs ? logs : [],
        executionTime: Date.now() - startTime
      };
    }
  }
}