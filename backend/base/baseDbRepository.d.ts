import { ApiContext } from './apiContext.js';

export declare class BaseDbRepository {
  context: ApiContext;
  log: ApiContext['logger'];
  pool: any;
  constructor(context: ApiContext, pool: any);
  query(sql: string, params?: unknown[]): Promise<object[]>;
  queryOne(sql: string, params?: unknown[]): Promise<object | null>;
  execute(sql: string, params?: unknown[]): Promise<number>;
}
