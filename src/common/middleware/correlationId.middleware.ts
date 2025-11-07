import { Injectable, NestMiddleware, Inject } from "@nestjs/common";
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { ILogger } from "../interfaces/logger.interface";
import { LOGGER_SERVICE, LOG_CONTEXT } from "../constants/logger.constants";


/*
Como sabemos los middlewares se ejecutan antes que los guards, interceptors y pipes.
la idea de este middleware es primeramente crear un correlationId para cada request y agregarla al objecto request y response. Luego si la app es una api rest, vasmos a interceptar toda peticion que llegue a la app y hacer un log.
tambien hacer log de respuesta y error en caso que exista.
En cambio si la app usa graphql, el middleware no conoce el contexto de graphql. Para eso utilizamos los plugins.



*/
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) { }

  use(req: Request, res: Response, next: NextFunction): void {
    //Generar correlation ID para la petición.
    req.correlationId = this.getCorrelationId(req);
    req.startTime = Date.now();
    res.setHeader('x-correlation-id', req.correlationId);

    // Log de petición entrante - en API REST
    // this.logRequest(req);

    // Interceptar el evento finish para loggear la respuesta - en API REST
    // res.on('finish', () => {
    //   this.logResponse(req, res);
    // });

    // Interceptar errores - en API REST
    // res.on('error', (error: Error) => {
    //   this.logError(req, res, error);
    // });

    next();
  }

  private getCorrelationId(req: Request): string {
    // Intentar obtener de headers (útil para tracking distribuido)
    const existingId = req.headers['x-correlation-id'] as string;
    const correlationId = existingId || uuidv4()

    // Propagar el id en los headers de la respuesta
    req.res?.setHeader('x-correlation-id', correlationId)
    return correlationId;
  }

  // private logRequest(req: Request): void {
  //   const { method, originalUrl, ip, correlationId } = req;
  //   const userAgent = req.get('user-agent') || 'Unknown';

  //   this.logger.log(`Incoming request`, LOG_CONTEXT.HTTP, {
  //     correlationId,
  //     method,
  //     url: originalUrl,
  //     ip: this.sanitizeIp(ip),
  //     userAgent: this.sanitizeUserAgent(userAgent),
  //   })
  // }

  // private logResponse(req: Request, res: Response): void {
  //   const { method, originalUrl, correlationId, startTime } = req;
  //   const { statusCode } = res;
  //   const responseTime = startTime ? Date.now() - startTime : 0;

  //   const logLevel = this.getLogLevel(statusCode);
  //   const message = `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`;

  //   logLevel === 'error' ? (
  //     this.logger.error(message, undefined, LOG_CONTEXT.HTTP, {
  //       correlationId,
  //       method,
  //       url: originalUrl,
  //       statusCode,
  //       responseTime,
  //     })
  //   ) : (
  //     this.logger[logLevel](message, LOG_CONTEXT.HTTP, {
  //       correlationId,
  //       method,
  //       url: originalUrl,
  //       statusCode,
  //       responseTime,
  //     })
  //   )




  // }

  // private logError(req: Request, res: Response, error: Error): void {
  //   const { method, originalUrl, correlationId } = req;
  //   const { statusCode } = res;

  //   this.logger.error(
  //     `Request error: ${error.message}`,
  //     error.stack,
  //     LOG_CONTEXT.HTTP,
  //     {
  //       correlationId,
  //       method,
  //       url: originalUrl,
  //       statusCode,
  //       errorName: error.name,
  //     },
  //   );
  // }

  // private getLogLevel(statusCode: number): 'log' | 'warn' | 'error' {
  //   if (statusCode >= 500) return 'error';
  //   if (statusCode >= 400) return 'warn';
  //   return 'log';
  // }

  // Métodos de sanitización para prevenir log injection
  // private sanitizeIp(ip?: string): string {
  //   if (!ip) return 'Unknown';
  //   // Remover caracteres potencialmente peligrosos
  //   return ip.replace(/[^\d.:a-fA-F]/g, '').substring(0, 45);
  // }

  // private sanitizeUserAgent(userAgent: string): string {
  //   // Limitar longitud y remover saltos de línea
  //   return userAgent
  //     .replace(/[\r\n]/g, '')
  //     .substring(0, 200);
  // }

}
