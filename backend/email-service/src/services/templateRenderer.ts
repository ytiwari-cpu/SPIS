/**
 * SPIS Email Service — Template Renderer
 *
 * Fetches the latest version of an email template from the DB,
 * compiles it with Handlebars, and returns a RenderedEmail ready for sending.
 */

import Handlebars from 'handlebars'
import { getLatestTemplate } from '../db/repository.js'
import type { RenderedEmail } from '../types.js'

export interface RenderEmailParams {
  to_email:      string
  template_code: string
  variables:     Record<string, unknown>
  locale?:       string
}

/**
 * Render an email template from the DB with the provided variables.
 *
 * @throws Error if the template is not found in the database.
 */
export async function renderEmail(params: RenderEmailParams): Promise<RenderedEmail> {
  const { to_email, template_code, variables, locale = 'en' } = params

  const template = await getLatestTemplate(template_code, locale)

  if (!template) {
    throw new Error(
      `Email template not found: template_code="${template_code}" locale="${locale}"`,
    )
  }

  // Compile and render subject + body
  const renderSubject = Handlebars.compile(template.subject, { noEscape: true })
  const renderBody    = Handlebars.compile(template.body)

  const subject = renderSubject(variables)
  const html    = renderBody(variables)

  // Strip HTML tags for a plain-text fallback
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  return {
    to:      to_email,
    subject,
    html,
    text,
  }
}
