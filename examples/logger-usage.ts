import PartRender, { logger, LogLevel, LogCategory } from '../src';

// Configure logger with custom settings
logger.configure({
  level: LogLevel.DEBUG,
  format: 'detailed',
  timestamp: true,
  enabledCategories: [LogCategory.SCANNER, LogCategory.COMPILER, LogCategory.CORE],
  // disabledCategories: [LogCategory.AI] // Can also disable specific categories
});

// Example 1: Direct logger usage
logger.info('Starting application');
logger.debug('Debug information', LogCategory.CORE, { version: '1.0.0' });
logger.warn('Warning message', LogCategory.COMPILER);
logger.error('Error occurred', LogCategory.SCANNER, new Error('Sample error'));

// Example 2: Category-specific logging
logger.scanner.info('Scanning project files');
logger.compiler.debug('Compiling JSX snippet');
logger.preview.info('Starting preview server');
logger.ai.warn('AI model response delayed');
logger.executor.error('Execution failed', { code: 'EXEC_ERROR' });

// Example 3: Logger configuration through PartRender
const partRender = new PartRender({
  projectRoot: './my-project',
  aiProvider: 'ollama',
  logger: {
    level: LogLevel.WARN, // Only show warnings and errors
    format: 'simple',
    timestamp: false
  }
});

// Example 4: Dynamic logger configuration
logger.configure({
  level: LogLevel.INFO,
  disabledCategories: [LogCategory.DEBUG, LogCategory.TRACE]
});

// Example 5: Production vs Development configuration
const isDevelopment = process.env.NODE_ENV === 'development';

logger.configure({
  level: isDevelopment ? LogLevel.DEBUG : LogLevel.WARN,
  format: isDevelopment ? 'detailed' : 'simple',
  timestamp: true,
  enabledCategories: isDevelopment 
    ? undefined // All categories in development
    : [LogCategory.CORE, LogCategory.EXECUTOR] // Only critical categories in production
});