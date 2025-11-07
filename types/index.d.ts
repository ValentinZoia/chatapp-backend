//NodeJS.ProcessEnv

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: string;
    PORT: number;
    APP_NAME: string;
    APP_URL: string;

    LOG_LEVEL: string;

    POSTGRES_HOST: string;
    POSTGRES_PORT: number;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB_NAME: string;

    DATABASE_URL: string;

    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRATION: string;

    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_EXPIRATION: string;

    IMAGE_PATH: string;

    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD: string;
    REDIS_DB: string;
    REDIS_TLS: boolean;

    CORS_ORIGIN: string;

    THROTTLE_TTL: number;
    THROTTLE_LIMIT: number;
  }
}
