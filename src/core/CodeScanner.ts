import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectFile, CodeContext } from '../types';
import { logger } from '../utils/Logger';

export class CodeScanner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  async scanProject(): Promise<CodeContext> {
    const projectFiles = await this.scanProjectFiles();
    const dependencies = await this.loadDependencies();
    const tsConfig = await this.loadTsConfig();

    return {
      projectFiles,
      dependencies,
      tsConfig
    };
  }

  private async scanProjectFiles(): Promise<ProjectFile[]> {
    const patterns = [
      '**/*.{ts,tsx,js,jsx}',
      '!node_modules/**',
      '!dist/**',
      '!build/**',
      '!coverage/**',
      '!.git/**'
    ];

    const files: ProjectFile[] = [];
    
    for (const pattern of patterns) {
      const matchedFiles = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true
      });

      for (const filePath of matchedFiles) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.projectRoot, filePath);
          const fileType = this.getFileType(filePath);

          files.push({
            path: relativePath,
            content,
            type: fileType
          });
        } catch (error) {
          logger.scanner.warn(`Failed to read file ${filePath}:`, error);
        }
      }
    }

    return files;
  }

  private async loadDependencies(): Promise<Record<string, string>> {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, 'utf-8')
      );

      return {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {}
      };
    } catch (error) {
      logger.scanner.warn('Could not load package.json dependencies:', error);
      return {};
    }
  }

  private async loadTsConfig(): Promise<any> {
    try {
      const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
      return JSON.parse(
        await fs.promises.readFile(tsConfigPath, 'utf-8')
      );
    } catch (error) {
      logger.scanner.warn('Could not load tsconfig.json:', error);
      return null;
    }
  }

  private getFileType(filePath: string): ProjectFile['type'] {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.tsx': return 'tsx';
      case '.ts': return 'ts';
      case '.jsx': return 'jsx';
      case '.js': return 'js';
      case '.json': return 'json';
      default: return 'other';
    }
  }

  findFilesByPattern(pattern: string, files: ProjectFile[]): ProjectFile[] {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return files.filter(file => regex.test(file.path));
  }

  findExports(files: ProjectFile[]): Record<string, string[]> {
    const exports: Record<string, string[]> = {};

    for (const file of files) {
      if (['ts', 'tsx', 'js', 'jsx'].includes(file.type)) {
        const fileExports = this.extractExports(file.content);
        if (fileExports.length > 0) {
          exports[file.path] = fileExports;
        }
      }
    }

    return exports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const namedExports = match[1].split(',').map(exp => exp.trim().split(/\s+as\s+/)[0]);
      exports.push(...namedExports);
    }

    return exports;
  }
}