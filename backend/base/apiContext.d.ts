export declare class ApiContext {
  request: any;
  response: any;
  user: {
    sub: string;
    national_id?: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    [key: string]: unknown;
  } | undefined;
  logger: {
    info:  (msg: string, meta?: Record<string, unknown>) => void;
    warn:  (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    debug: (msg: string, meta?: Record<string, unknown>) => void;
  };
  constructor(request: any, response: any, logger?: any);
  get cookies(): Record<string, string>;
  get session(): Record<string, unknown> | undefined;
  setHeader(key: string, ...args: string[]): void;
}
