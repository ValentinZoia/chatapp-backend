export interface LogMetadata {
  correlationId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}
