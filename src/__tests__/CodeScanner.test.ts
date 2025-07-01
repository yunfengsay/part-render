import { CodeScanner } from '../core/CodeScanner';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('glob');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('CodeScanner', () => {
  let scanner: CodeScanner;
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    scanner = new CodeScanner(mockProjectRoot);
    jest.clearAllMocks();
  });

  describe('scanProject', () => {
    it('should scan project files and load dependencies', async () => {
      const mockPackageJson = {
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' }
      };

      mockFs.promises.readFile = jest.fn()
        .mockResolvedValueOnce('export const Component = () => <div>Test</div>;')
        .mockResolvedValueOnce(JSON.stringify(mockPackageJson))
        .mockResolvedValueOnce('{"compilerOptions": {"jsx": "react-jsx"}}');

      const mockGlob = require('glob');
      mockGlob.glob = jest.fn().mockResolvedValue(['/test/project/src/Component.tsx']);

      const result = await scanner.scanProject();

      expect(result.projectFiles).toHaveLength(1);
      expect(result.dependencies).toEqual({
        react: '^18.0.0',
        typescript: '^5.0.0'
      });
      expect(result.tsConfig).toEqual({
        compilerOptions: { jsx: 'react-jsx' }
      });
    });

    it('should handle missing package.json gracefully', async () => {
      mockFs.promises.readFile = jest.fn()
        .mockResolvedValueOnce('export const Component = () => <div>Test</div>;')
        .mockRejectedValueOnce(new Error('File not found'));

      const mockGlob = require('glob');
      mockGlob.glob = jest.fn().mockResolvedValue(['/test/project/src/Component.tsx']);

      const result = await scanner.scanProject();

      expect(result.dependencies).toEqual({});
    });
  });

  describe('findExports', () => {
    it('should extract exports from file content', () => {
      const files = [
        {
          path: 'Component.tsx',
          content: 'export const MyComponent = () => <div>Hello</div>;\nexport default MyComponent;',
          type: 'tsx' as const
        }
      ];

      const exports = scanner.findExports(files);

      expect(exports['Component.tsx']).toContain('MyComponent');
    });

    it('should handle named exports', () => {
      const files = [
        {
          path: 'utils.ts',
          content: 'export { helper1, helper2 } from "./helpers";',
          type: 'ts' as const
        }
      ];

      const exports = scanner.findExports(files);

      expect(exports['utils.ts']).toEqual(expect.arrayContaining(['helper1', 'helper2']));
    });
  });

  describe('findFilesByPattern', () => {
    it('should find files matching pattern', () => {
      const files = [
        { path: 'src/components/Button.tsx', content: '', type: 'tsx' as const },
        { path: 'src/utils/helpers.ts', content: '', type: 'ts' as const },
        { path: 'tests/Button.test.tsx', content: '', type: 'tsx' as const }
      ];

      const result = scanner.findFilesByPattern('.*components.*', files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/components/Button.tsx');
    });
  });
});