export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export enum LogCategory {
  SCANNER = 'scanner',
  COMPILER = 'compiler',
  EXECUTOR = 'executor',
  PREVIEW = 'preview',
  AI = 'ai',
  CORE = 'core',
  DETECTOR = 'detector'
}

export interface LoggerConfig {
  level: LogLevel;
  enabledCategories?: LogCategory[];
  disabledCategories?: LogCategory[];
  format?: 'simple' | 'detailed';
  timestamp?: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    format: 'simple',
    timestamp: true
  };

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel, category?: LogCategory): boolean {
    if (level > this.config.level) {
      return false;
    }

    if (category) {
      if (this.config.enabledCategories && !this.config.enabledCategories.includes(category)) {
        return false;
      }
      if (this.config.disabledCategories && this.config.disabledCategories.includes(category)) {
        return false;
      }
    }

    return true;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    category?: LogCategory,
    data?: any
  ): string {
    const levelName = LogLevel[level];
    const timestamp = this.config.timestamp ? new Date().toISOString() : '';
    const categoryStr = category ? `[${category}]` : '';

    if (this.config.format === 'detailed') {
      const parts = [timestamp, levelName, categoryStr, message].filter(Boolean);
      if (data !== undefined) {
        parts.push(JSON.stringify(data, null, 2));
      }
      return parts.join(' ');
    }

    const parts = [categoryStr, message].filter(Boolean);
    return parts.join(' ');
  }

  private log(
    level: LogLevel,
    message: string,
    category?: LogCategory,
    data?: any
  ): void {
    if (!this.shouldLog(level, category)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, category, data);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.TRACE:
        console.trace(formattedMessage);
        break;
    }
  }

  error(message: string, category?: LogCategory, data?: any): void {
    this.log(LogLevel.ERROR, message, category, data);
  }

  warn(message: string, category?: LogCategory, data?: any): void {
    this.log(LogLevel.WARN, message, category, data);
  }

  info(message: string, category?: LogCategory, data?: any): void {
    this.log(LogLevel.INFO, message, category, data);
  }

  debug(message: string, category?: LogCategory, data?: any): void {
    this.log(LogLevel.DEBUG, message, category, data);
  }

  trace(message: string, category?: LogCategory, data?: any): void {
    this.log(LogLevel.TRACE, message, category, data);
  }

  // Convenience methods for specific categories
  scanner = {
    error: (message: string, data?: any) => this.error(message, LogCategory.SCANNER, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.SCANNER, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.SCANNER, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.SCANNER, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.SCANNER, data)
  };

  compiler = {
    error: (message: string, data?: any) => this.error(message, LogCategory.COMPILER, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.COMPILER, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.COMPILER, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.COMPILER, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.COMPILER, data)
  };

  executor = {
    error: (message: string, data?: any) => this.error(message, LogCategory.EXECUTOR, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.EXECUTOR, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.EXECUTOR, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.EXECUTOR, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.EXECUTOR, data)
  };

  preview = {
    error: (message: string, data?: any) => this.error(message, LogCategory.PREVIEW, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.PREVIEW, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.PREVIEW, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.PREVIEW, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.PREVIEW, data)
  };

  ai = {
    error: (message: string, data?: any) => this.error(message, LogCategory.AI, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.AI, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.AI, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.AI, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.AI, data)
  };

  core = {
    error: (message: string, data?: any) => this.error(message, LogCategory.CORE, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.CORE, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.CORE, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.CORE, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.CORE, data)
  };

  detector = {
    error: (message: string, data?: any) => this.error(message, LogCategory.DETECTOR, data),
    warn: (message: string, data?: any) => this.warn(message, LogCategory.DETECTOR, data),
    info: (message: string, data?: any) => this.info(message, LogCategory.DETECTOR, data),
    debug: (message: string, data?: any) => this.debug(message, LogCategory.DETECTOR, data),
    trace: (message: string, data?: any) => this.trace(message, LogCategory.DETECTOR, data)
  };
}

export const logger = Logger.getInstance();