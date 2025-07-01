import PartRender from '../src/index';

async function aiIntegrationExample() {
  console.log('🤖 Starting AI Integration Example');

  // You can switch between OpenAI and Ollama
  const useOpenAI = process.env.OPENAI_API_KEY ? true : false;
  
  const partRender = new PartRender(useOpenAI ? {
    projectRoot: process.cwd(),
    aiProvider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY!
  } : {
    projectRoot: process.cwd(),
    aiProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'codellama'
  });

  try {
    console.log(`🧠 Using ${useOpenAI ? 'OpenAI' : 'Ollama'} provider`);
    
    await partRender.initialize();

    // Generate code with AI
    console.log('✨ Generating code with AI...');
    const codeResponse = await partRender.generateCodeWithAI(
      'Create a React functional component called UserCard that accepts props for name, email, and avatar URL. Use TypeScript.',
      'The component should be accessible and have proper TypeScript types.'
    );

    if (codeResponse.success) {
      console.log('📝 Generated Code:');
      console.log(codeResponse.data);

      // Validate the generated code
      console.log('🔍 Validating generated code...');
      const validation = await partRender.validateJSX(codeResponse.data as string);
      console.log('Validation:', validation);

      if (validation.valid) {
        // Try to render the generated code
        console.log('🎨 Attempting to render generated code...');
        const renderResult = await partRender.renderJSX({
          code: codeResponse.data as string,
          fileName: 'UserCard.tsx'
        });

        console.log('Render result:', {
          success: renderResult.success,
          error: renderResult.error,
          executionTime: renderResult.executionTime
        });
      }
    } else {
      console.error('❌ Code generation failed:', codeResponse.error);
    }

    // Analyze existing code
    console.log('🔬 Analyzing code with AI...');
    const codeToAnalyze = `
      const Button = ({ children, onClick, disabled = false }) => {
        return (
          <button onClick={onClick} disabled={disabled}>
            {children}
          </button>
        );
      };
    `;

    const analysisResponse = await partRender.analyzeCodeWithAI(
      codeToAnalyze,
      'What improvements can be made to this React component? Consider TypeScript, accessibility, and best practices.'
    );

    if (analysisResponse.success) {
      console.log('📊 Code Analysis:');
      console.log(analysisResponse.data);
    }

    // Optimize code with AI
    console.log('⚡ Optimizing code with AI...');
    const optimizationResponse = await partRender.optimizeCodeWithAI(
      codeToAnalyze,
      'Add TypeScript types, improve accessibility, and follow React best practices'
    );

    if (optimizationResponse.success) {
      console.log('🚀 Optimized Code:');
      console.log(optimizationResponse.data);
    }

  } catch (error) {
    console.error('💥 AI integration example failed:', error);
  }
}

// Run the example
if (require.main === module) {
  aiIntegrationExample();
}