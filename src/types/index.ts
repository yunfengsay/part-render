import { LogLevel, LogCategory } from '../utils/Logger';

export interface LoggerConfig {
  level?: LogLevel;
  enabledCategories?: LogCategory[];
  disabledCategories?: LogCategory[];
  format?: 'simple' | 'detailed';
  timestamp?: boolean;
}

export interface RenderConfig {
  projectRoot: string;
  aiProvider: 'openai' | 'ollama';
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number;
  logger?: LoggerConfig;
}

export interface CodeContext {
  projectFiles: ProjectFile[];
  dependencies: Record<string, string>;
  tsConfig?: any;
}

export interface ProjectFile {
  path: string;
  content: string;
  type: 'tsx' | 'ts' | 'jsx' | 'js' | 'json' | 'other';
}

export interface JSXSnippet {
  code: string;
  fileName?: string;
  dependencies?: string[];
}

export interface RenderResult {
  success: boolean;
  output?: any;
  error?: string;
  logs?: string[];
  executionTime?: number;
}

export interface AIModelResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CompilationResult {
  success: boolean;
  code?: string;
  error?: string;
  warnings?: string[];
}

export interface PartRenderOptions {
  enableLogs?: boolean;
  strictMode?: boolean;
  customGlobals?: Record<string, any>;
}