import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonLoggerService } from '../services/winston-logger.service';
import { LOGGER_SERVICE } from '../constants/logger.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LOGGER_SERVICE,
      useClass: WinstonLoggerService,
    }
  ],
  exports: [LOGGER_SERVICE],
})
export class LoggerModule { }



