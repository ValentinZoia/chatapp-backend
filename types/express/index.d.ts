declare namespace Express {
  interface Request {
    user: {
      sub: number;
      username: string;
    };
  }
}
