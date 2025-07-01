import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer } from 'ws';
import { createViteServer, ViteDevServer } from 'vite';
import { ComponentInfo } from '../core/ComponentDetector';
import { CodeContext } from '../types';
import { logger } from '../utils/Logger';

export interface PreviewServerConfig {
  port: number;
  host: string;
  projectRoot: string;
  hmr: boolean;
}

export class LivePreviewServer {
  private server: http.Server | null = null;
  private viteServer: ViteDevServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private config: PreviewServerConfig;
  private components: ComponentInfo[] = [];
  private codeContext: CodeContext | null = null;

  constructor(config: PreviewServerConfig) {
    this.config = config;
  }

  async start(components: ComponentInfo[], codeContext: CodeContext): Promise<void> {
    this.components = components;
    this.codeContext = codeContext;

    // Create Vite dev server
    this.viteServer = await createViteServer({
      root: this.config.projectRoot,
      server: { 
        port: this.config.port,
        host: this.config.host,
        hmr: this.config.hmr
      },
      plugins: [
        {
          name: 'part-render-preview',
          configureServer: (server) => {
            server.middlewares.use('/api/components', this.handleComponentsAPI.bind(this));
            server.middlewares.use('/api/preview', this.handlePreviewAPI.bind(this));
          }
        }
      ]
    });

    // Setup WebSocket for real-time updates
    if (this.config.hmr) {
      this.setupWebSocket();
    }

    await this.viteServer.listen();
    
    logger.preview.info(`🚀 Preview server running at http://${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    if (this.viteServer) {
      await this.viteServer.close();
    }
  }

  private setupWebSocket(): void {
    this.wsServer = new WebSocketServer({ 
      port: this.config.port + 1,
      host: this.config.host
    });

    this.wsServer.on('connection', (ws) => {
      logger.preview.info('🔗 WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(data, ws);
        } catch (error) {
          logger.preview.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        logger.preview.info('🔌 WebSocket client disconnected');
      });
    });
  }

  private handleWebSocketMessage(data: any, ws: any): void {
    switch (data.type) {
      case 'subscribe':
        // Subscribe to component updates
        ws.componentId = data.componentId;
        break;
      
      case 'update-props':
        // Handle props update from client
        this.broadcastUpdate({
          type: 'props-updated',
          componentId: data.componentId,
          props: data.props
        });
        break;
    }
  }

  private broadcastUpdate(data: any): void {
    if (!this.wsServer) return;

    this.wsServer.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data));
      }
    });
  }

  private async handleComponentsAPI(req: any, res: any, next: any): Promise<void> {
    if (req.method !== 'GET') {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const componentsWithPreviewData = this.components.map(component => ({
      ...component,
      previewUrl: `/preview/${encodeURIComponent(component.filePath)}/${component.name}`,
      propsSchema: this.generatePropsSchema(component)
    }));

    res.end(JSON.stringify({
      components: componentsWithPreviewData,
      projectInfo: {
        dependencies: this.codeContext?.dependencies || {},
        fileCount: this.codeContext?.projectFiles.length || 0
      }
    }));
  }

  private async handlePreviewAPI(req: any, res: any, next: any): Promise<void> {
    if (req.method !== 'GET') {
      return next();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const filePath = decodeURIComponent(url.searchParams.get('file') || '');
    const componentName = url.searchParams.get('component') || '';
    const propsJson = url.searchParams.get('props') || '{}';

    try {
      const props = JSON.parse(propsJson);
      const previewHTML = await this.generatePreviewHTML(filePath, componentName, props);
      
      res.setHeader('Content-Type', 'text/html');
      res.end(previewHTML);
    } catch (error) {
      res.statusCode = 500;
      res.end(`Error generating preview: ${error}`);
    }
  }

  private async generatePreviewHTML(filePath: string, componentName: string, props: any): Promise<string> {
    const component = this.components.find(c => 
      c.filePath === filePath && c.name === componentName
    );

    if (!component) {
      throw new Error(`Component ${componentName} not found in ${filePath}`);
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Preview: ${componentName}</title>
  <script type="module">
    import { createRoot } from 'react-dom/client';
    import React from 'react';
    
    // WebSocket connection for HMR
    ${this.config.hmr ? this.generateHMRScript() : ''}
    
    // Import the component
    import { ${componentName} } from '/${filePath}';
    
    // Render the component with props
    const container = document.getElementById('root');
    const root = createRoot(container);
    
    function render() {
      const props = ${JSON.stringify(props)};
      root.render(React.createElement(${componentName}, props));
    }
    
    render();
    
    // HMR handling
    if (import.meta.hot) {
      import.meta.hot.accept('/${filePath}', () => {
        render();
      });
    }
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  }

  private generateHMRScript(): string {
    return `
    const ws = new WebSocket('ws://${this.config.host}:${this.config.port + 1}');
    
    ws.onopen = () => {
      logger.preview.info('🔗 Connected to HMR server');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'props-updated':
          // Handle props update
          window.location.reload();
          break;
        case 'file-changed':
          // Handle file change
          window.location.reload();
          break;
      }
    };
    
    ws.onclose = () => {
      logger.preview.info('🔌 Disconnected from HMR server');
    };
    `;
  }

  private generatePropsSchema(component: ComponentInfo): any {
    const schema: any = {
      type: 'object',
      properties: {},
      required: []
    };

    for (const prop of component.props) {
      const propSchema = this.typeToJsonSchema(prop.type);
      schema.properties[prop.name] = {
        ...propSchema,
        description: prop.description
      };

      if (prop.required) {
        schema.required.push(prop.name);
      }
    }

    return schema;
  }

  private typeToJsonSchema(typeString: string): any {
    // Basic type mapping
    if (typeString === 'string') {
      return { type: 'string' };
    }
    if (typeString === 'number') {
      return { type: 'number' };
    }
    if (typeString === 'boolean') {
      return { type: 'boolean' };
    }
    if (typeString.includes('[]')) {
      return { type: 'array' };
    }
    if (typeString.includes('|')) {
      const types = typeString.split('|').map(t => t.trim());
      return { enum: types };
    }
    
    return { type: 'string' }; // fallback
  }

  updateComponents(components: ComponentInfo[]): void {
    this.components = components;
    this.broadcastUpdate({
      type: 'components-updated',
      components: this.components
    });
  }

  updateCodeContext(codeContext: CodeContext): void {
    this.codeContext = codeContext;
    this.broadcastUpdate({
      type: 'context-updated',
      context: {
        dependencies: codeContext.dependencies,
        fileCount: codeContext.projectFiles.length
      }
    });
  }
}