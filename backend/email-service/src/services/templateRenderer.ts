/**
 * SPIS Email Service — Template Renderer
 *
 * Uses Handlebars for template rendering.
 * Loads versioned templates from DB (template_versions table).
 * Falls back to English if locale not found.
 * Caches compiled templates in memory for performance.
 */

import Handlebars from 'handlebars'
import { getLatestTemplate } from '../db/repository.js'
import { logger } from '../lib/logger.js'
import type { RenderedEmail } from '../types.js'

// In-memory cache: key = `${templateCode}:${locale}:${version}`
const compiledCache = new Map<string, { subject: HandlebarsTemplateDelegate; body: HandlebarsTemplateDelegate }>()

/**
 * Render an email from a template code + variables.
 *
 * @returns RenderedEmail with { to, subject, html, text }
 * @throws Error if template not found
 */
export async function renderEmail(params: {
  to_email: string
  template_code: string
  variables: Record<string, unknown>
  locale?: string
}): Promise<RenderedEmail> {
  const locale = params.locale || 'en'

  // 1. Load template from DB
  const template = await getLatestTemplate(params.template_code, locale)
  if (!template) {
    throw new Error(`Template not found: ${params.template_code} (locale=${locale})`)
  }

  // 2. Compile (or get from cache)
  const cacheKey = `${template.template_code}:${template.locale}:${template.version}`
  let compiled = compiledCache.get(cacheKey)

  if (!compiled) {
    compiled = {
      subject: Handlebars.compile(template.subject),
      body: Handlebars.compile(template.body),
    }
    compiledCache.set(cacheKey, compiled)
    logger.debug('Template compiled and cached', { cacheKey })
  }

  // 3. Render with variables
  const subject = compiled.subject(params.variables)
  const html = compiled.body(params.variables)

  // 4. Generate plaintext by stripping HTML tags
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .trim()

  return {
    to: params.to_email,
    subject,
    html,
    text,
  }
}

/** Clear the compiled template cache (useful after template updates) */
export function clearTemplateCache(): void {
  compiledCache.clear()
  logger.info('Template cache cleared')
}
