export declare class ApiContext {
  request:    any;
  response:   any;
  user:       Record<string, unknown> | undefined;  // req.user from requireAuth
  connection: object;
  logger: {
    info:  (msg: string, meta?: Record<string, unknown>) => void;
    warn:  (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    debug: (msg: string, meta?: Record<string, unknown>) => void;
  };
  constructor(request: any, connection: object);
  get cookies(): Record<string, string>;
  get session(): Record<string, unknown> | undefined;
  setHeader(key: string, ...args: string[]): void;
}
