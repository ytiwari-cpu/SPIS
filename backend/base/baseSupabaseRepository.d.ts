import { ApiContext } from './apiContext.js';

export declare class BaseSupabaseRepository {
  context: ApiContext;
  log: ApiContext['logger'];
  db: any;
  constructor(context: ApiContext, db: any);
  from(table: string): any;
  insertOne(table: string, record: Record<string, unknown>): Promise<any>;
  updateOne(table: string, updates: Record<string, unknown>, column: string, value: string): Promise<any>;
  findOne(table: string, column: string, value: string, selectExpr?: string): Promise<any>;
}
