import PartRender from '../src/index';

async function livePreviewExample() {
  console.log('🎬 Starting Live Preview Example');

  const partRender = new PartRender({
    projectRoot: process.cwd(),
    aiProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'codellama'
  });

  try {
    // Initialize and detect components
    console.log('🔍 Initializing and detecting components...');
    await partRender.initialize();

    const components = partRender.getDetectedComponents();
    console.log(`✅ Found ${components.length} components:`);
    
    components.forEach(comp => {
      console.log(`  📦 ${comp.name} (${comp.type}) - ${comp.filePath}:${comp.line}`);
      console.log(`     Props: ${comp.props.map(p => `${p.name}: ${p.type}`).join(', ')}`);
    });

    // Analyze a specific component with AI
    if (components.length > 0) {
      const firstComponent = components[0];
      console.log(`\n🔬 Analyzing component: ${firstComponent.name}`);
      
      const analysis = await partRender.analyzeComponent(
        firstComponent.filePath, 
        firstComponent.name
      );
      
      if (analysis && (analysis as any).aiAnalysis) {
        console.log('🤖 AI Analysis:');
        console.log((analysis as any).aiAnalysis);
      }
    }

    // Start live preview server
    console.log('\n🚀 Starting live preview server...');
    await partRender.startPreviewServer({
      port: 3000,
      host: 'localhost',
      hmr: true
    });

    console.log(`
📱 Live Preview Server Started!
   
🌐 Component Browser: http://localhost:3000/api/components
🎨 Preview individual components at:
   http://localhost:3000/api/preview?file=<filePath>&component=<componentName>&props=<jsonProps>

Example URLs:
${components.slice(0, 3).map(comp => 
  `   http://localhost:3000/api/preview?file=${encodeURIComponent(comp.filePath)}&component=${comp.name}&props={}`
).join('\n')}

🔄 WebSocket HMR: ws://localhost:3001
    `);

    // Keep the server running
    console.log('⏳ Server running... Press Ctrl+C to stop');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down preview server...');
      await partRender.stopPreviewServer();
      process.exit(0);
    });

    // Demo: Simulate component updates
    setTimeout(async () => {
      console.log('\n🔄 Refreshing component context...');
      await partRender.refreshContext();
      console.log('✅ Context refreshed!');
    }, 5000);

  } catch (error) {
    console.error('💥 Live preview example failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  livePreviewExample();
}