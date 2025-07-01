# PartRender

A TypeScript package for executing JSX code snippets in project context with AI model integration.

## Features

- 📁 **Project Code Scanning**: Automatically scans and analyzes your entire project structure
- 🔧 **JSX Compilation**: Compiles JSX snippets with project context and dependencies
- 🏃 **Safe Execution**: Runs compiled code in a secure sandbox environment
- 🤖 **AI Integration**: Built-in support for OpenAI and Ollama models
- 🧪 **Comprehensive Testing**: Full test suite with Jest
- 📦 **TypeScript Support**: Full TypeScript support with type definitions

## Installation

```bash
npm install part-render
```

## Quick Start

```typescript
import PartRender from 'part-render';

const partRender = new PartRender({
  projectRoot: './my-react-project',
  aiProvider: 'openai',
  openaiApiKey: 'your-openai-api-key'
});

// Initialize and scan project
await partRender.initialize();

// Render JSX snippet
const result = await partRender.renderJSX({
  code: `
    const MyComponent = () => {
      return <div>Hello from PartRender!</div>;
    };
    export default MyComponent;
  `
});

console.log(result);
```

## Configuration

### OpenAI Configuration

```typescript
const config = {
  projectRoot: './project',
  aiProvider: 'openai',
  openaiApiKey: 'sk-...',
  timeout: 30000
};
```

### Ollama Configuration

```typescript
const config = {
  projectRoot: './project',
  aiProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'codellama',
  timeout: 30000
};
```

## API Reference

### PartRender Class

#### Methods

##### `initialize(): Promise<void>`
Scans the project and initializes the code context.

##### `renderJSX(snippet: JSXSnippet, options?: PartRenderOptions): Promise<RenderResult>`
Compiles and executes a JSX code snippet.

```typescript
const snippet = {
  code: 'const App = () => <div>Hello</div>; export default App;',
  fileName: 'App.tsx',
  dependencies: ['lodash']
};

const options = {
  enableLogs: true,
  strictMode: false,
  customGlobals: { myGlobal: 'value' }
};

const result = await partRender.renderJSX(snippet, options);
```

##### `generateCodeWithAI(prompt: string, context?: string): Promise<AIModelResponse>`
Generates code using AI models.

```typescript
const response = await partRender.generateCodeWithAI(
  'Create a button component with TypeScript',
  'Make it accessible and include hover effects'
);
```

##### `analyzeCodeWithAI(code: string, question: string): Promise<AIModelResponse>`
Analyzes code using AI models.

```typescript
const analysis = await partRender.analyzeCodeWithAI(
  'const Button = () => <button>Click</button>',
  'How can this component be improved?'
);
```

##### `validateJSX(code: string): Promise<{valid: boolean; errors?: string[]}>`
Validates JSX syntax.

```typescript
const validation = await partRender.validateJSX('<div>Valid JSX</div>');
```

##### `getProjectInfo(): ProjectInfo | null`
Returns information about the scanned project.

```typescript
const info = partRender.getProjectInfo();
console.log(info?.dependencies, info?.fileCount, info?.exports);
```

## Types

### RenderConfig
```typescript
interface RenderConfig {
  projectRoot: string;
  aiProvider: 'openai' | 'ollama';
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number;
}
```

### JSXSnippet
```typescript
interface JSXSnippet {
  code: string;
  fileName?: string;
  dependencies?: string[];
}
```

### RenderResult
```typescript
interface RenderResult {
  success: boolean;
  output?: any;
  error?: string;
  logs?: string[];
  executionTime?: number;
}
```

## Examples

### Basic Usage

```typescript
import PartRender from 'part-render';

async function example() {
  const partRender = new PartRender({
    projectRoot: './my-project',
    aiProvider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY
  });

  await partRender.initialize();

  const result = await partRender.renderJSX({
    code: `
      import { useState } from 'react';
      
      const Counter = () => {
        const [count, setCount] = useState(0);
        
        return (
          <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
              Increment
            </button>
          </div>
        );
      };
      
      export default Counter;
    `
  });

  if (result.success) {
    console.log('Rendered successfully:', result.output);
  } else {
    console.error('Render failed:', result.error);
  }
}
```

### AI-Assisted Development

```typescript
async function aiExample() {
  const partRender = new PartRender({
    projectRoot: './my-project',
    aiProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'codellama'
  });

  // Generate code with AI
  const codeResponse = await partRender.generateCodeWithAI(
    'Create a responsive card component with props for title, description, and image'
  );

  if (codeResponse.success) {
    // Validate the generated code
    const validation = await partRender.validateJSX(codeResponse.data);
    
    if (validation.valid) {
      // Execute the generated code
      const result = await partRender.renderJSX({
        code: codeResponse.data
      });
      
      console.log('AI-generated component executed:', result);
    }
  }
}
```

## Testing

```bash
npm test
npm run test:watch
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run in development mode
npm run dev

# Lint code
npm run lint

# Type check
npm run typecheck
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request