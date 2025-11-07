export const LOGGER_SERVICE = Symbol('LOGGER_SERVICE');
export const LOG_CONTEXT = {
  HTTP: 'HTTP',
  APP: 'Application',
  DATABSE: 'Database',
  AUTH: 'Authentication',
  VALIDATION: 'Validation',
} as const;
