import { GraphQLResolveInfo } from 'graphql';

export interface GraphQLExecutionInfo extends GraphQLResolveInfo {
  operationName?: string;
  operationType: 'query' | 'mutation' | 'subscription';
  fieldName: string;
  variables?: Record<string, any>;
}

export interface GraphQLErrorInfo {
  message: string;
  extensions?: Record<string, any>;
  path?: (string | number)[];
  locations?: Array<{ line: number; column: number }>;
}
