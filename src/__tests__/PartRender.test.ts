import PartRender from '../index';
import { RenderConfig } from '../types';

jest.mock('../core/CodeScanner');
jest.mock('../core/JSXCompiler');
jest.mock('../ai/OpenAIProvider');
jest.mock('../ai/OllamaProvider');

describe('PartRender', () => {
  let partRender: PartRender;
  let config: RenderConfig;

  beforeEach(() => {
    config = {
      projectRoot: '/test/project',
      aiProvider: 'openai',
      openaiApiKey: 'test-key'
    };

    partRender = new PartRender(config);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with OpenAI provider', () => {
      expect(partRender).toBeInstanceOf(PartRender);
    });

    it('should initialize with Ollama provider', () => {
      const ollamaConfig: RenderConfig = {
        projectRoot: '/test/project',
        aiProvider: 'ollama',
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'codellama'
      };

      const ollamaPartRender = new PartRender(ollamaConfig);
      expect(ollamaPartRender).toBeInstanceOf(PartRender);
    });
  });

  describe('renderJSX', () => {
    it('should render JSX successfully', async () => {
      const mockScanner = require('../core/CodeScanner').CodeScanner;
      const mockCompiler = require('../core/JSXCompiler').JSXCompiler;

      mockScanner.prototype.scanProject = jest.fn().mockResolvedValue({
        projectFiles: [],
        dependencies: {},
        tsConfig: null
      });

      mockCompiler.prototype.compileJSXSnippet = jest.fn().mockResolvedValue({
        success: true,
        code: 'compiled code'
      });

      const snippet = {
        code: 'const App = () => <div>Hello</div>; export default App;'
      };

      const result = await partRender.renderJSX(snippet);

      expect(result.success).toBe(true);
    });

    it('should handle compilation errors', async () => {
      const mockScanner = require('../core/CodeScanner').CodeScanner;
      const mockCompiler = require('../core/JSXCompiler').JSXCompiler;

      mockScanner.prototype.scanProject = jest.fn().mockResolvedValue({
        projectFiles: [],
        dependencies: {},
        tsConfig: null
      });

      mockCompiler.prototype.compileJSXSnippet = jest.fn().mockResolvedValue({
        success: false,
        error: 'Compilation failed'
      });

      const snippet = {
        code: 'invalid jsx'
      };

      const result = await partRender.renderJSX(snippet);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Compilation failed');
    });
  });

  describe('AI integration', () => {
    it('should generate code with AI', async () => {
      const mockProvider = require('../ai/OpenAIProvider').OpenAIProvider;
      mockProvider.prototype.generateCode = jest.fn().mockResolvedValue({
        success: true,
        data: 'generated code'
      });

      const result = await partRender.generateCodeWithAI('Create a button component');

      expect(result.success).toBe(true);
      expect(result.data).toBe('generated code');
    });

    it('should handle AI provider not configured', async () => {
      const noAIConfig: RenderConfig = {
        projectRoot: '/test/project',
        aiProvider: 'openai'
        // No API key provided
      };

      const noAIPartRender = new PartRender(noAIConfig);
      const result = await noAIPartRender.generateCodeWithAI('Create a button');

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI provider not configured');
    });
  });

  describe('validateJSX', () => {
    it('should validate JSX code', async () => {
      const mockScanner = require('../core/CodeScanner').CodeScanner;
      const mockCompiler = require('../core/JSXCompiler').JSXCompiler;

      mockScanner.prototype.scanProject = jest.fn().mockResolvedValue({
        projectFiles: [],
        dependencies: {},
        tsConfig: null
      });

      mockCompiler.prototype.validateJSX = jest.fn().mockResolvedValue({
        valid: true
      });

      const result = await partRender.validateJSX('<div>Valid JSX</div>');

      expect(result.valid).toBe(true);
    });
  });

  describe('getProjectInfo', () => {
    it('should return null when not initialized', () => {
      const info = partRender.getProjectInfo();
      expect(info).toBeNull();
    });

    it('should return project info after initialization', async () => {
      const mockScanner = require('../core/CodeScanner').CodeScanner;

      mockScanner.prototype.scanProject = jest.fn().mockResolvedValue({
        projectFiles: [{ path: 'test.tsx', content: '', type: 'tsx' }],
        dependencies: { react: '^18.0.0' },
        tsConfig: null
      });

      mockScanner.prototype.findExports = jest.fn().mockReturnValue({
        'test.tsx': ['Component']
      });

      await partRender.initialize();
      const info = partRender.getProjectInfo();

      expect(info).not.toBeNull();
      expect(info?.fileCount).toBe(1);
      expect(info?.dependencies).toEqual({ react: '^18.0.0' });
    });
  });
});