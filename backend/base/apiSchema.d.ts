export class ApiSchema {
    /**
     * @param {Array<{ ... }> | { name: string, url: string, endpoints: Array<{ ... }> }} schemaOrRoutes
     */
    /**
     * @param {Array<{
     *   path: string,
     *   verb: string,
     *   handler: { controller: Function, method: string },
     *   middleware?: Function[]
     * }>} schemaOrRoutes
     */
    constructor(schemaOrRoutes: Array<{
        path: string;
        verb: string;
        handler: {
            controller: Function;
            method: string;
        };
        middleware?: Function[];
    }>);
    name: any;
    url: any;
    routes: any;
    /**
     * Register all routes on an Express app or Router.
     *
     * @param {import('express').Application | import('express').Router} app
     * @param {string} [basePath] — optional prefix; defaults to this.url when omitted
     */
    register(app: any | any, basePath?: string): void;
}
//# sourceMappingURL=apiSchema.d.ts.map