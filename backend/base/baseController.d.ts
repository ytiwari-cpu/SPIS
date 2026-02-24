import { ApiContext } from './apiContext.js';

export declare class BaseController {
  context: ApiContext;
  log: ApiContext['logger'];
  constructor(context: ApiContext);
  respondOk(result?: unknown): void;
  respondCreated(result?: unknown): void;
  respondBadRequest(result?: unknown): void;
  respondNotFound(result?: unknown): void;
  respondForbidden(result?: unknown): void;
  respondError(result?: unknown, statusCode?: number): void;
  respondJson(result?: unknown, statusCode?: number): void;
  sendResponse(result?: unknown, statusCode?: number): void;
}
