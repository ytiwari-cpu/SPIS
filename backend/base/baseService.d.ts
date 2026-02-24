import { ApiContext } from './apiContext.js';

export declare class BaseService {
  context: ApiContext;
  log: ApiContext['logger'];
  constructor(context: ApiContext);
  static genUUID(): string;
  getUserId(): string;
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
}
