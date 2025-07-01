import axios from 'axios';
import { AIModelResponse } from '../types';
import { logger } from '../utils/Logger';

export class OllamaProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'codellama') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async generateCode(prompt: string, context?: string): Promise<AIModelResponse> {
    try {
      const systemPrompt = `You are a helpful assistant that generates JSX/React code. 
${context ? `Context: ${context}` : ''}
Please respond with clean, executable JSX code.`;

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: `${systemPrompt}\n\nUser request: ${prompt}`,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      });

      if (response.data?.response) {
        return {
          success: true,
          data: response.data.response
        };
      } else {
        throw new Error('No response from Ollama');
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  async analyzeCode(code: string, question: string): Promise<AIModelResponse> {
    try {
      const prompt = `Analyze the following JSX code and answer the question:

Code:
\`\`\`jsx
${code}
\`\`\`

Question: ${question}

Please provide a detailed analysis.`;

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.8
        }
      });

      if (response.data?.response) {
        return {
          success: true,
          data: response.data.response
        };
      } else {
        throw new Error('No response from Ollama');
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  async optimizeCode(code: string, requirements?: string): Promise<AIModelResponse> {
    try {
      const prompt = `Optimize the following JSX code${requirements ? ` with these requirements: ${requirements}` : ''}:

\`\`\`jsx
${code}
\`\`\`

Please provide the optimized version with explanations for the changes made. Focus on performance, readability, and React best practices.`;

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.5,
          top_p: 0.9
        }
      });

      if (response.data?.response) {
        return {
          success: true,
          data: response.data.response
        };
      } else {
        throw new Error('No response from Ollama');
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data?.models?.map((model: any) => model.name) || [];
    } catch (error) {
      logger.ai.warn('Failed to list Ollama models:', error);
      return [];
    }
  }

  private formatError(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return 'Cannot connect to Ollama server. Please ensure Ollama is running.';
      }
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}