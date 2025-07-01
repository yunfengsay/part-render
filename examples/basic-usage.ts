import PartRender from '../src/index';

async function basicExample() {
  console.log('🚀 Starting PartRender Basic Example');

  const partRender = new PartRender({
    projectRoot: process.cwd(),
    aiProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'codellama'
  });

  try {
    // Initialize the project context
    console.log('📁 Initializing project context...');
    await partRender.initialize();

    // Get project information
    const projectInfo = partRender.getProjectInfo();
    console.log('📊 Project Info:', {
      fileCount: projectInfo?.fileCount,
      dependencyCount: Object.keys(projectInfo?.dependencies || {}).length
    });

    // Validate JSX
    console.log('✅ Validating JSX...');
    const validation = await partRender.validateJSX(`
      const MyComponent = ({ name }: { name: string }) => {
        return <div>Hello, {name}!</div>;
      };
    `);
    console.log('Validation result:', validation);

    // Render JSX snippet
    console.log('🎨 Rendering JSX snippet...');
    const result = await partRender.renderJSX({
      code: `
        const SimpleComponent = () => {
          console.log('Component rendered!');
          return {
            type: 'div',
            props: { children: 'Hello from PartRender!' }
          };
        };
        
        export default SimpleComponent;
      `,
      fileName: 'SimpleComponent.tsx'
    });

    console.log('📄 Render Result:', {
      success: result.success,
      output: result.output,
      logs: result.logs,
      executionTime: result.executionTime
    });

    if (!result.success) {
      console.error('❌ Error:', result.error);
    }

  } catch (error) {
    console.error('💥 Example failed:', error);
  }
}

// Run the example
if (require.main === module) {
  basicExample();
}