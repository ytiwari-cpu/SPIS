/**
 * RegistrationController — handles /api/v1/registration routes
 *
 * Thin wrapper that delegates to the existing registrationRouter.
 * The registration flow is complex (3113 lines) so the controller
 * acts as a pass-through to document the pattern without duplicating logic.
 *
 * The actual handler logic lives in routes/registration.routes.ts.
 * To migrate further: move individual handlers here as needed.
 */

export class RegistrationController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
  }

  // Placeholder — registration routes delegate directly to the router.
  // Individual methods can be extracted here incrementally.
}
