declare namespace Express {
  interface Request {
    correlationId?: string;
    startTime?: number
    user: {
      sub: number;
      username: string;
    };
  }
}
