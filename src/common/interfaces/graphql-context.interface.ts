import { Request, Response } from 'express';

export interface GraphQLContext {
  req: Request;
  res: Response;
  correlationId: string; // un id para cada request, asi poder rastrearla
  userId?: string;
  startTime?: number;
}
