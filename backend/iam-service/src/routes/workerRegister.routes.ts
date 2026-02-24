/**
 * Worker Registration Routes
 * Self-registration for workers (Admin, CaseWorker) with secret key validation
 */

import { Router } from 'express'
import { ApiContext } from '../../../base/apiContext.js'
import { WorkerRegisterController } from '../features/workerRegister/workerRegisterController.js'

const router = Router()

router.post('/worker-register', async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new WorkerRegisterController(ctx).register()
  } catch (err) { next(err) }
})

router.post('/worker-register/verify', async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new WorkerRegisterController(ctx).verify()
  } catch (err) { next(err) }
})

export default router
