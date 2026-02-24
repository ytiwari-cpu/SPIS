/**
 * UploadController — handles /api/v1/upload routes
 *
 * Delegates to uploadService and historyService.
 * Multer middleware (file parsing) stays on the route level.
 */

export class UploadController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
  }

  // Placeholder — upload routes delegate directly to the router.
  // The actual multer + supabase storage logic lives in routes/upload.routes.ts.
  // Individual methods can be extracted here incrementally.
}
