import * as ts from 'typescript';
import * as fs from 'fs';
import { ProjectFile } from '../types';

export interface ComponentInfo {
  name: string;
  filePath: string;
  props: PropInfo[];
  isDefaultExport: boolean;
  type: 'function' | 'class' | 'arrow';
  line: number;
  column: number;
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export class ComponentDetector {
  private program: ts.Program;
  private checker: ts.TypeChecker;

  constructor(projectRoot: string, tsConfigPath?: string) {
    const configPath = tsConfigPath || ts.findConfigFile(
      projectRoot,
      ts.sys.fileExists,
      'tsconfig.json'
    );

    let compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false
    };

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        projectRoot
      );
      compilerOptions = parsedConfig.options;
    }

    const rootFiles = this.findSourceFiles(projectRoot);
    this.program = ts.createProgram(rootFiles, compilerOptions);
    this.checker = this.program.getTypeChecker();
  }

  detectComponents(files: ProjectFile[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    for (const file of files) {
      if (!['tsx', 'ts', 'jsx', 'js'].includes(file.type)) {
        continue;
      }

      const sourceFile = this.program.getSourceFile(file.path);
      if (!sourceFile) {
        continue;
      }

      const fileComponents = this.extractComponentsFromFile(sourceFile, file.path);
      components.push(...fileComponents);
    }

    return components;
  }

  private extractComponentsFromFile(sourceFile: ts.SourceFile, filePath: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    const visit = (node: ts.Node) => {
      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const component = this.analyzeFunction(node, filePath, sourceFile);
        if (component) {
          components.push(component);
        }
      }

      // Variable declarations with function expressions
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const component = this.analyzeVariableDeclaration(node, filePath, sourceFile);
        if (component) {
          components.push(component);
        }
      }

      // Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const component = this.analyzeClass(node, filePath, sourceFile);
        if (component) {
          components.push(component);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  private analyzeFunction(
    node: ts.FunctionDeclaration, 
    filePath: string, 
    sourceFile: ts.SourceFile
  ): ComponentInfo | null {
    if (!node.name || !this.isReactComponent(node)) {
      return null;
    }

    const name = node.name.text;
    const signature = this.checker.getSignatureFromDeclaration(node);
    const props = signature ? this.extractPropsFromSignature(signature) : [];
    const isExported = this.isExported(node);
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      name,
      filePath,
      props,
      isDefaultExport: this.isDefaultExport(node, sourceFile),
      type: 'function',
      line: position.line + 1,
      column: position.character + 1
    };
  }

  private analyzeVariableDeclaration(
    node: ts.VariableDeclaration,
    filePath: string,
    sourceFile: ts.SourceFile
  ): ComponentInfo | null {
    if (!node.name || !ts.isIdentifier(node.name) || !node.initializer) {
      return null;
    }

    const isArrowFunction = ts.isArrowFunction(node.initializer);
    const isFunctionExpression = ts.isFunctionExpression(node.initializer);

    if (!isArrowFunction && !isFunctionExpression) {
      return null;
    }

    if (!this.isReactComponent(node.initializer)) {
      return null;
    }

    const name = node.name.text;
    const type = this.checker.getTypeAtLocation(node.initializer);
    const callSignatures = type.getCallSignatures();
    const props = callSignatures.length > 0 ? 
      this.extractPropsFromSignature(callSignatures[0]) : [];
    
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      name,
      filePath,
      props,
      isDefaultExport: this.isDefaultExport(node, sourceFile),
      type: isArrowFunction ? 'arrow' : 'function',
      line: position.line + 1,
      column: position.character + 1
    };
  }

  private analyzeClass(
    node: ts.ClassDeclaration,
    filePath: string,
    sourceFile: ts.SourceFile
  ): ComponentInfo | null {
    if (!node.name || !this.isReactClassComponent(node)) {
      return null;
    }

    const name = node.name.text;
    const props = this.extractPropsFromClassComponent(node);
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      name,
      filePath,
      props,
      isDefaultExport: this.isDefaultExport(node, sourceFile),
      type: 'class',
      line: position.line + 1,
      column: position.character + 1
    };
  }

  private isReactComponent(node: ts.Node): boolean {
    const type = this.checker.getTypeAtLocation(node);
    const callSignatures = type.getCallSignatures();

    for (const signature of callSignatures) {
      const returnType = signature.getReturnType();
      if (this.isJSXElementType(returnType)) {
        return true;
      }
    }

    return false;
  }

  private isReactClassComponent(node: ts.ClassDeclaration): boolean {
    if (!node.heritageClauses) {
      return false;
    }

    for (const heritage of node.heritageClauses) {
      for (const type of heritage.types) {
        const typeText = type.expression.getText();
        if (typeText.includes('Component') || typeText.includes('PureComponent')) {
          return true;
        }
      }
    }

    return false;
  }

  private isJSXElementType(type: ts.Type): boolean {
    const typeString = this.checker.typeToString(type);
    return typeString.includes('JSX.Element') || 
           typeString.includes('React.ReactElement') ||
           typeString.includes('ReactNode') ||
           typeString.includes('Element');
  }

  private extractPropsFromSignature(signature: ts.Signature): PropInfo[] {
    const parameters = signature.getParameters();
    if (parameters.length === 0) {
      return [];
    }

    const propsParam = parameters[0];
    const propsType = this.checker.getTypeOfSymbolAtLocation(propsParam, propsParam.valueDeclaration!);
    
    return this.extractPropsFromType(propsType);
  }

  private extractPropsFromType(type: ts.Type): PropInfo[] {
    const props: PropInfo[] = [];
    const properties = this.checker.getPropertiesOfType(type);

    for (const prop of properties) {
      const propType = this.checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
      const typeString = this.checker.typeToString(propType);
      const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;

      props.push({
        name: prop.name,
        type: typeString,
        required: !isOptional,
        description: this.getJSDocComment(prop)
      });
    }

    return props;
  }

  private extractPropsFromClassComponent(node: ts.ClassDeclaration): PropInfo[] {
    // Look for generic type parameters (e.g., Component<Props>)
    if (!node.typeParameters) {
      return [];
    }

    // This is a simplified implementation
    // In practice, you'd need to analyze the generic constraints
    return [];
  }

  private isExported(node: ts.Node): boolean {
    return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;
  }

  private isDefaultExport(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    // Check if this node is referenced in a default export
    const exportAssignments = sourceFile.statements.filter(ts.isExportAssignment);
    
    for (const exportAssign of exportAssignments) {
      if (ts.isIdentifier(exportAssign.expression)) {
        const name = exportAssign.expression.text;
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
          return true;
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
          return true;
        }
        if (ts.isClassDeclaration(node) && node.name?.text === name) {
          return true;
        }
      }
    }

    return node.modifiers?.some(mod => 
      mod.kind === ts.SyntaxKind.ExportKeyword && 
      mod.getText().includes('default')
    ) || false;
  }

  private getJSDocComment(symbol: ts.Symbol): string | undefined {
    const documentation = symbol.getDocumentationComment(this.checker);
    return documentation.map(doc => doc.text).join('');
  }

  private findSourceFiles(projectRoot: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        
        if (entry.isDirectory() && !['node_modules', 'dist', 'build'].includes(entry.name)) {
          walkDir(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    walkDir(projectRoot);
    return files;
  }
}