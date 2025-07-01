import { OllamaProvider } from './OllamaProvider';
import { logger } from '../utils/Logger';
import { DependencyContext } from '../core/DependencyResolver';

export interface CompletionContext {
  code: string;
  dependencies: DependencyContext;
  componentType?: 'function' | 'class' | 'unknown';
  missingImports?: string[];
  projectContext?: string;
}

export interface CompletionResult {
  completedCode: string;
  suggestions: string[];
  confidence: number;
}

export class CodeCompleter {
  private aiProvider: OllamaProvider;
  private cache = new Map<string, CompletionResult>();

  constructor(ollamaBaseUrl?: string, model?: string) {
    this.aiProvider = new OllamaProvider(ollamaBaseUrl, model);
  }

  async completePartialCode(context: CompletionContext): Promise<CompletionResult> {
    const cacheKey = this.getCacheKey(context);
    
    if (this.cache.has(cacheKey)) {
      logger.ai.debug('Using cached completion');
      return this.cache.get(cacheKey)!;
    }

    try {
      // 构建精确的提示
      const prompt = this.buildCompletionPrompt(context);
      
      // 调用AI模型
      const response = await this.aiProvider.generateCode(prompt, context.projectContext || '');
      
      if (!response.success || !response.data) {
        return this.getFallbackCompletion(context);
      }

      // 解析AI响应
      const result = this.parseAIResponse(response.data, context);
      
      // 缓存结果
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.ai.error('Code completion failed', error);
      return this.getFallbackCompletion(context);
    }
  }

  private buildCompletionPrompt(context: CompletionContext): string {
    const missingIdsList = Array.from(context.dependencies.missingIdentifiers).join(', ');
    
    return `Complete this React component code. The code is missing these identifiers: ${missingIdsList}.

Current code:
\`\`\`jsx
${context.code}
\`\`\`

Requirements:
1. Add necessary imports for React and missing identifiers
2. Complete any partial function implementations
3. Ensure the component is exportable
4. Add basic error handling
5. Keep the code simple and focused

Return ONLY the completed code without explanations.`;
  }

  private parseAIResponse(response: string, context: CompletionContext): CompletionResult {
    // 提取代码块
    const codeMatch = response.match(/```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)\n```/);
    const completedCode = codeMatch ? codeMatch[1] : response;

    // 评估完成度
    const confidence = this.evaluateCompletion(completedCode, context);

    // 生成建议
    const suggestions = this.generateSuggestions(context);

    return {
      completedCode,
      suggestions,
      confidence
    };
  }

  private getFallbackCompletion(context: CompletionContext): CompletionResult {
    // 基于规则的后备方案
    const imports = this.generateFallbackImports(context);
    const wrapper = this.generateComponentWrapper(context);
    
    const completedCode = `${imports}\n\n${context.code}\n\n${wrapper}`;

    return {
      completedCode,
      suggestions: [
        'Add props validation',
        'Consider adding error boundaries',
        'Add loading states if async operations exist'
      ],
      confidence: 0.5
    };
  }

  private generateFallbackImports(context: CompletionContext): string {
    const imports: string[] = ['import React from "react";'];
    
    // 根据缺失的标识符添加常见imports
    const missing = context.dependencies.missingIdentifiers;
    
    if (missing.has('useState') || missing.has('useEffect') || missing.has('useCallback')) {
      const hooks = Array.from(missing).filter(id => id.startsWith('use'));
      if (hooks.length > 0) {
        imports.push(`import { ${hooks.join(', ')} } from 'react';`);
      }
    }

    if (missing.has('styled')) {
      imports.push('import styled from "styled-components";');
    }

    if (missing.has('axios')) {
      imports.push('import axios from "axios";');
    }

    return imports.join('\n');
  }

  private generateComponentWrapper(context: CompletionContext): string {
    // 检查是否已有导出
    if (context.code.includes('export default') || context.code.includes('export {')) {
      return '';
    }

    // 尝试找到组件名
    const componentMatch = context.code.match(/(?:function|const|class)\s+(\w+)/);
    const componentName = componentMatch?.[1] || 'Component';

    return `\nexport default ${componentName};`;
  }

  private evaluateCompletion(code: string, context: CompletionContext): number {
    let confidence = 0.5;

    // 检查是否有imports
    if (code.includes('import')) confidence += 0.1;

    // 检查是否有导出
    if (code.includes('export')) confidence += 0.1;

    // 检查缺失的标识符是否被解决
    const resolvedCount = Array.from(context.dependencies.missingIdentifiers)
      .filter(id => code.includes(id)).length;
    
    confidence += (resolvedCount / context.dependencies.missingIdentifiers.size) * 0.3;

    return Math.min(confidence, 1);
  }

  private generateSuggestions(context: CompletionContext): string[] {
    const suggestions: string[] = [];

    if (context.dependencies.missingIdentifiers.has('useState')) {
      suggestions.push('Consider initializing state with default values');
    }

    if (context.dependencies.missingIdentifiers.has('useEffect')) {
      suggestions.push('Add cleanup function to useEffect if needed');
    }

    if (!context.code.includes('try')) {
      suggestions.push('Add error handling for robust component behavior');
    }

    return suggestions;
  }

  private getCacheKey(context: CompletionContext): string {
    return `${context.code}:${Array.from(context.dependencies.missingIdentifiers).sort().join(',')}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}