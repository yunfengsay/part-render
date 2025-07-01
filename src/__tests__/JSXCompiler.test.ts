import { JSXCompiler } from '../core/JSXCompiler';
import { CodeContext, JSXSnippet } from '../types';

jest.mock('esbuild');

describe('JSXCompiler', () => {
  let compiler: JSXCompiler;
  let mockContext: CodeContext;

  beforeEach(() => {
    mockContext = {
      projectFiles: [
        {
          path: 'src/Button.tsx',
          content: 'export const Button = ({ children }: { children: React.ReactNode }) => <button>{children}</button>;',
          type: 'tsx'
        }
      ],
      dependencies: {
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      },
      tsConfig: {
        compilerOptions: { jsx: 'react-jsx' }
      }
    };

    compiler = new JSXCompiler(mockContext);
    jest.clearAllMocks();
  });

  describe('compileJSXSnippet', () => {
    it('should compile JSX snippet successfully', async () => {
      const snippet: JSXSnippet = {
        code: 'const App = () => <Button>Click me</Button>; export default App;',
        fileName: 'App.tsx'
      };

      const mockEsbuild = require('esbuild');
      mockEsbuild.build = jest.fn().mockResolvedValue({
        outputFiles: [{ text: 'compiled code here' }],
        warnings: []
      });

      const result = await compiler.compileJSXSnippet(snippet);

      expect(result.success).toBe(true);
      expect(result.code).toBe('compiled code here');
      expect(mockEsbuild.build).toHaveBeenCalled();
    });

    it('should handle compilation errors', async () => {
      const snippet: JSXSnippet = {
        code: 'const App = () => <InvalidComponent>; // Invalid JSX',
        fileName: 'App.tsx'
      };

      const mockEsbuild = require('esbuild');
      mockEsbuild.build = jest.fn().mockRejectedValue(new Error('Compilation failed'));

      const result = await compiler.compileJSXSnippet(snippet);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Compilation failed');
    });
  });

  describe('validateJSX', () => {
    it('should validate correct JSX', async () => {
      const mockEsbuild = require('esbuild');
      mockEsbuild.transform = jest.fn().mockResolvedValue({ code: 'valid' });

      const result = await compiler.validateJSX('<div>Hello World</div>');

      expect(result.valid).toBe(true);
      expect(mockEsbuild.transform).toHaveBeenCalledWith(
        '<div>Hello World</div>',
        expect.objectContaining({ loader: 'tsx' })
      );
    });

    it('should detect invalid JSX', async () => {
      const mockEsbuild = require('esbuild');
      mockEsbuild.transform = jest.fn().mockRejectedValue(new Error('Invalid JSX'));

      const result = await compiler.validateJSX('<div>Unclosed div');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid JSX');
    });
  });
});