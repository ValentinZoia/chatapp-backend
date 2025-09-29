//NodeJS.ProcessEnv

declare namespace NodeJS {
  export interface ProcessEnv {
    USER_DB: string;
    PASSWORD_DB: string;
    DB_NAME: string;

    DATABASE_URL: string;

    PORT: number;
    APP_URL: string;

    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_SECRET: string;

    IMAGE_PATH: string;

    REDIS_HOST: string;
    REDIS_PORT: string;
  }
}
