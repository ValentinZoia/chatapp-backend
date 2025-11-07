import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { ILogger } from '../interfaces/logger.interface';

@Injectable()
export class WinstonLoggerService implements ILogger {
  private logger: winston.Logger;
  private readonly environment: string;

  constructor(private configService: ConfigService) {
    this.environment = this.configService.get<string>('NODE_ENV', 'development');
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const isProduction = this.environment === 'production';

    //Formato para desarrollo, va a ser mas legible
    const devFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        //Aca le estamos diciendo como va a ser el mensaje/log
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${context || 'App'}] ${level}: ${message} ${metaString}`
      }),
    )
    // Formato para producción: JSON estructurado
    const prodFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    return winston.createLogger({
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      format: isProduction ? prodFormat : devFormat,
      defaultMeta: {
        service: this.configService.get<string>('APP_NAME', 'nestjs-app'),
        environment: this.environment,
      },
      //un transport es un destino al que se envian los logs -> transport = una “salida"
      transports: [
        // Console para todos los ambientes . imprime los logs en la terminal -> .Console()
        new winston.transports.Console({
          stderrLevels: ['error'],
        }),
        // Archivo para errores en producción. imprime los logs en un archivo -> .File()
        //se puede usar DailyRotateFile en prod tmb, es recomendable.
        ...(isProduction
          ? [
            new winston.transports.File({
              filename: 'logs/error.log', //nombre del archivo
              level: 'error',
              maxsize: 5242880, // 5MB - tamaño maximo
              maxFiles: 5, //guardar solo 5 logs
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              maxsize: 5242880,
              maxFiles: 5,
            }),
          ]
          : []),
      ],
      // No salir en errores no capturados
      exitOnError: false,
    });
  }
  log(message: string, context?: string, meta?: Record<string, any>): void {
    this.logger.info(message, { context, ...meta });
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, any>): void {
    this.logger.error(message, {
      context,
      trace,
      ...meta,
    });
  }

  warn(message: string, context?: string, meta?: Record<string, any>): void {
    this.logger.warn(message, { context, ...meta });
  }

  debug(message: string, context?: string, meta?: Record<string, any>): void {
    this.logger.debug(message, { context, ...meta });
  }

  verbose(message: string, context?: string, meta?: Record<string, any>): void {
    this.logger.verbose(message, { context, ...meta });
  }


}
