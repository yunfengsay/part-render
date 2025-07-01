import OpenAI from 'openai';
import { AIModelResponse } from '../types';

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL
    });
  }

  async generateCode(prompt: string, context?: string): Promise<AIModelResponse> {
    try {
      const systemMessage = `You are a helpful assistant that generates JSX/React code. 
${context ? `Context: ${context}` : ''}
Please respond with clean, executable JSX code.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        data: content
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async analyzeCode(code: string, question: string): Promise<AIModelResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a code analyst. Analyze the provided code and answer questions about it.'
          },
          {
            role: 'user',
            content: `Code:\n\`\`\`jsx\n${code}\n\`\`\`\n\nQuestion: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        data: content
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async optimizeCode(code: string, requirements?: string): Promise<AIModelResponse> {
    try {
      const prompt = `Optimize the following JSX code${requirements ? ` with these requirements: ${requirements}` : ''}:

\`\`\`jsx
${code}
\`\`\`

Please provide the optimized version with explanations for the changes made.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a code optimization expert. Optimize React/JSX code for performance, readability, and best practices.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 2000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        data: content
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}