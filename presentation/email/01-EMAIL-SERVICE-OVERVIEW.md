# Email Service - Complete Documentation

## Service Overview

**Port:** 3002  
**Purpose:** Handle all email communications for the SPIS system  
**Email Provider:** Resend (https://resend.com)

---

## Core Responsibilities

### 1. OTP Delivery
- Login OTP emails
- Password reset OTP emails
- MFA verification codes
- Worker registration OTPs

### 2. Notifications
- Welcome emails
- Account activation
- Password change confirmations
- Security alerts

### 3. System Communications
- Invitation emails
- Administrative notifications
- Service announcements

---

## Development Journey

### Phase 1: Email Service Setup

**User Need:**
OTP login and password reset features required reliable email delivery

**Requirements:**
- Send OTP codes with clear formatting
- Support HTML templates
- Handle failures gracefully
- Fast delivery (< 5 seconds)
- Track delivery status

**Implementation:**

#### Step 1: Choose Email Provider

**Options Considered:**
1. **SendGrid** - Popular, complex setup
2. **Mailgun** - Reliable, expensive
3. **AWS SES** - Cheap, complex AWS setup
4. **Resend** ✅ - Modern, simple API, developer-friendly

**Why Resend:**
- Simple REST API
- Excellent documentation
- Free tier: 100 emails/day
- No complex setup
- React Email template support
- Fast delivery

#### Step 2: Create Email Service

**File:** `/backend/email-service/src/index.ts`

```typescript
import express from 'express'
import { Resend } from 'resend'
import { logger } from './lib/logger.js'
import { config } from './config.js'

const app = express()
const resend = new Resend(config.resendApiKey)

app.use(express.json())

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'email-service' })
})

// Send email endpoint
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, from, subject, html, text } = req.body
    
    // Validation
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and html or text'
      })
    }
    
    // Send via Resend
    const result = await resend.emails.send({
      from: from || config.emailFrom,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    })
    
    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: result.data?.id,
    })
    
    res.json({
      success: true,
      messageId: result.data?.id,
    })
  } catch (error: any) {
    logger.error('Failed to send email', {
      error: error.message,
      to: req.body.to,
    })
    
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
    })
  }
})

// Send OTP email (convenience endpoint)
app.post('/api/email/otp', async (req, res) => {
  try {
    const { to, otp, purpose } = req.body
    
    if (!to || !otp) {
      return res.status(400).json({
        error: 'Missing required fields: to, otp'
      })
    }
    
    // Determine subject based on purpose
    let subject = 'Your SPIS Verification Code'
    let title = 'Your Verification Code'
    
    switch (purpose) {
      case 'otp_login':
        subject = 'Your SPIS Login Code'
        title = 'Your Login Code'
        break
      case 'password_reset':
        subject = 'Reset Your SPIS Password'
        title = 'Password Reset Code'
        break
      case 'mfa_email':
        subject = 'SPIS Two-Factor Authentication'
        title = 'Two-Factor Code'
        break
      case 'worker_registration':
        subject = 'Complete Your SPIS Worker Registration'
        title = 'Worker Registration Code'
        break
    }
    
    // HTML template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .otp-code {
            background: #f3f4f6;
            border: 2px dashed #2563eb;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code .code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #2563eb;
            font-family: 'Courier New', monospace;
          }
          .info-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box p {
            margin: 0;
            color: #92400e;
          }
          .footer {
            background: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
            font-size: 12px;
            color: #6b7280;
          }
          .button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ SPIS - Social Protection Information System</h1>
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            <p>Hello,</p>
            <p>You requested a verification code for your SPIS account. Use the code below to proceed:</p>
            
            <div class="otp-code">
              <div class="code">${otp}</div>
            </div>
            
            <div class="info-box">
              <p><strong>⏱️ This code expires in 10 minutes.</strong></p>
            </div>
            
            <p>If you didn't request this code, please ignore this email or contact support if you have concerns about your account security.</p>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>SPIS Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SPIS (Social Protection Information System).</p>
            <p>Please do not reply to this email.</p>
            <p style="margin-top: 15px;">© 2026 SPIS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    
    // Send email
    const result = await resend.emails.send({
      from: config.emailFrom,
      to,
      subject,
      html,
    })
    
    logger.info('OTP email sent', {
      to,
      purpose,
      messageId: result.data?.id,
    })
    
    res.json({
      success: true,
      messageId: result.data?.id,
    })
  } catch (error: any) {
    logger.error('Failed to send OTP email', {
      error: error.message,
      to: req.body.to,
    })
    
    res.status(500).json({
      error: 'Failed to send OTP email',
      details: error.message,
    })
  }
})

// Send password reset email
app.post('/api/email/password-reset', async (req, res) => {
  try {
    const { to, resetToken, resetUrl } = req.body
    
    if (!to || !resetToken) {
      return res.status(400).json({
        error: 'Missing required fields: to, resetToken'
      })
    }
    
    const fullResetUrl = resetUrl || 
      `${config.frontendUrl}/reset-password?token=${resetToken}`
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .warning {
            background: #fef3c7;
            padding: 15px;
            border-left: 4px solid #f59e0b;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Your SPIS Password</h2>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          
          <a href="${fullResetUrl}" class="button">Reset Password</a>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2563eb;">${fullResetUrl}</p>
          
          <div class="warning">
            <p><strong>⏱️ This link expires in 1 hour.</strong></p>
          </div>
          
          <p>If you didn't request this password reset, please ignore this email or contact support.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #666;">
            This is an automated message from SPIS. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `
    
    const result = await resend.emails.send({
      from: config.emailFrom,
      to,
      subject: 'Reset Your SPIS Password',
      html,
    })
    
    logger.info('Password reset email sent', {
      to,
      messageId: result.data?.id,
    })
    
    res.json({
      success: true,
      messageId: result.data?.id,
    })
  } catch (error: any) {
    logger.error('Failed to send password reset email', {
      error: error.message,
      to: req.body.to,
    })
    
    res.status(500).json({
      error: 'Failed to send password reset email',
      details: error.message,
    })
  }
})

// Start server
const PORT = config.port || 3002
app.listen(PORT, () => {
  logger.info('Email Service started', { port: PORT })
  console.log(`📧 Email Service running on port ${PORT}`)
})
```

#### Step 3: Configuration

**File:** `/backend/email-service/src/config.ts`

```typescript
export const config = {
  port: parseInt(process.env.EMAIL_SERVICE_PORT || '3002'),
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || 'noreply@spis.gov',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
}

// Validation
if (!config.resendApiKey) {
  throw new Error('RESEND_API_KEY environment variable is required')
}
```

#### Step 4: Environment Variables

**In `/backend/.env`:**
```env
# Email Service Configuration
EMAIL_SERVICE_PORT=3002
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@spis.gov
FRONTEND_URL=http://localhost:5173
```

---

### Phase 2: Email Templates

**Challenge:** Make emails look professional and trustworthy

**Solution:** Created HTML email templates with:
- Responsive design
- Clear branding
- Security indicators
- Mobile-friendly
- Accessibility considerations

**Template Features:**
- SPIS branding (colors, logo concept)
- Large, readable OTP codes
- Expiration warnings
- Security tips
- Professional footer

---

### Phase 3: Integration with IAM Service

**File:** `/backend/iam-service/src/clients/emailClient.ts`

```typescript
import axios from 'axios'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    const response = await axios.post(
      `${config.emailServiceUrl}/api/email/send`,
      {
        to: params.to,
        from: config.emailFrom,
        subject: params.subject,
        html: params.html,
        text: params.text,
      },
      {
        timeout: 10000, // 10 second timeout
      }
    )
    
    logger.info('Email sent via email service', {
      to: params.to,
      subject: params.subject,
      messageId: response.data.messageId,
    })
  } catch (error: any) {
    logger.error('Failed to send email via email service', {
      error: error.message,
      to: params.to,
      subject: params.subject,
    })
    
    // Don't throw - allow OTP to still be saved in database
    // Email failure shouldn't break the flow
  }
}

export async function sendOtpEmail(params: {
  to: string
  otp: string
  purpose: string
}): Promise<void> {
  try {
    await axios.post(
      `${config.emailServiceUrl}/api/email/otp`,
      params,
      { timeout: 10000 }
    )
    
    logger.info('OTP email sent', { to: params.to, purpose: params.purpose })
  } catch (error: any) {
    logger.error('Failed to send OTP email', {
      error: error.message,
      to: params.to,
    })
  }
}
```

---

## API Endpoints

### POST /api/email/send
Send a custom email

**Request:**
```json
{
  "to": "user@example.com",
  "from": "noreply@spis.gov",
  "subject": "Welcome to SPIS",
  "html": "<h1>Welcome!</h1><p>Thank you for registering.</p>",
  "text": "Welcome! Thank you for registering."
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "re_abc123"
}
```

---

### POST /api/email/otp
Send OTP code email (convenience endpoint)

**Request:**
```json
{
  "to": "user@example.com",
  "otp": "123456",
  "purpose": "otp_login"
}
```

**Purposes:**
- `otp_login` - Login verification
- `password_reset` - Password reset
- `mfa_email` - MFA verification
- `worker_registration` - Worker signup

**Response:**
```json
{
  "success": true,
  "messageId": "re_abc123"
}
```

---

### POST /api/email/password-reset
Send password reset email with link

**Request:**
```json
{
  "to": "user@example.com",
  "resetToken": "abc123...",
  "resetUrl": "https://spis.gov/reset?token=abc123"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "re_abc123"
}
```

---

## Email Templates

### OTP Login Email

**Subject:** Your SPIS Login Code

**Content:**
```
🛡️ SPIS - Social Protection Information System

Your Login Code

Hello,

You requested a verification code for your SPIS account. Use the code below to proceed:

┌─────────────────┐
│   123456       │
└─────────────────┘

⏱️ This code expires in 10 minutes.

If you didn't request this code, please ignore this email or contact support.

Best regards,
SPIS Team

────────────────────────────────
This is an automated message from SPIS.
Please do not reply to this email.
© 2026 SPIS. All rights reserved.
```

---

### Password Reset Email

**Subject:** Reset Your SPIS Password

**Content:**
```
Reset Your SPIS Password

You requested to reset your password. Click the button below:

[Reset Password Button]

Or copy this link:
https://spis.gov/reset-password?token=abc123...

⏱️ This link expires in 1 hour.

If you didn't request this, please ignore this email.

────────────────────────────────
SPIS - Social Protection Information System
```

---

## Challenges & Solutions

### Challenge 1: Email Deliverability

**Problem:** Emails going to spam

**Solutions Implemented:**
1. Use reputable provider (Resend)
2. Configure SPF/DKIM records
3. Use professional 'from' address
4. Clear, non-spammy content
5. No URL shorteners
6. Proper HTML structure

**To Configure:**
```
Add these DNS records to your domain:

TXT record for SPF:
v=spf1 include:_spf.resend.com ~all

CNAME records for DKIM:
(Provided by Resend dashboard)
```

---

### Challenge 2: Template Rendering

**Problem:** Emails looked broken on some clients

**Solution:**
- Use inline CSS styles
- Test on multiple email clients
- Avoid complex layouts
- Use tables for structure (old school but works)
- Fallback for images
- Plain text alternative

---

### Challenge 3: Rate Limiting

**Problem:** Could send unlimited emails (abuse risk)

**Solution:**
```typescript
// Add rate limiting middleware
import rateLimit from 'express-rate-limit'

const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 emails per minute
  message: 'Too many emails sent. Please try again later.',
})

app.post('/api/email/send', emailLimiter, async (req, res) => {
  // ... send email
})
```

---

### Challenge 4: Tracking Delivery Status

**Problem:** Don't know if emails were delivered

**Solution Options:**
1. **Resend Webhooks** ✅ (Recommended)
   - Set up webhook endpoint
   - Receive delivery/bounce events
   - Update database with status

2. **Query Resend API**
   - Poll for delivery status
   - More requests, less real-time

**Webhook Implementation (Future):**
```typescript
app.post('/api/email/webhook', async (req, res) => {
  const event = req.body
  
  switch (event.type) {
    case 'email.delivered':
      logger.info('Email delivered', { messageId: event.data.email_id })
      break
    case 'email.bounced':
      logger.warn('Email bounced', { messageId: event.data.email_id })
      break
    case 'email.opened':
      logger.info('Email opened', { messageId: event.data.email_id })
      break
  }
  
  res.json({ received: true })
})
```

---

## Security Considerations

### 1. API Key Protection
- Store in environment variables
- Never commit to git
- Rotate periodically
- Use different keys for dev/prod

### 2. Email Content Sanitization
```typescript
import DOMPurify from 'isomorphic-dompurify'

// Sanitize HTML before sending
const cleanHtml = DOMPurify.sanitize(html)
```

### 3. Rate Limiting
- Per IP address
- Per email recipient
- Prevent spam abuse

### 4. Email Validation
```typescript
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
```

---

## Monitoring & Logging

### Key Metrics to Track
1. **Email Send Rate** - emails/minute
2. **Delivery Success Rate** - delivered/sent
3. **Bounce Rate** - bounced/sent
4. **Error Rate** - errors/attempts
5. **Average Send Time** - latency

### Log Important Events
```typescript
logger.info('Email sent', {
  to: maskEmail(to),
  subject,
  messageId,
  duration: endTime - startTime,
})

logger.error('Email failed', {
  to: maskEmail(to),
  subject,
  error: error.message,
  statusCode: error.response?.status,
})
```

---

## Testing Recommendations

### Unit Tests
```typescript
describe('Email Service', () => {
  test('should send basic email', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.success).toBe(true)
  })
  
  test('should validate email address', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('invalid')).toBe(false)
  })
})
```

### Integration Tests
- Test with real Resend API (test mode)
- Verify email delivery
- Check template rendering
- Test error handling

### Manual Testing
- Send test emails to various providers
- Check spam folders
- Test on mobile devices
- Verify links work

---

## Future Enhancements

### Planned Features
1. **Email Templates Library**
   - Pre-built templates
   - Template variables
   - Multi-language support

2. **Email Queue**
   - Background processing
   - Retry failed sends
   - Priority queuing

3. **Analytics Dashboard**
   - Open rates
   - Click rates
   - Bounce analysis

4. **SMS Integration**
   - Fallback to SMS if email fails
   - OTP via SMS
   - Notification preferences

5. **Rich Templates**
   - React Email components
   - Interactive elements
   - Personalization

---

## Resend Setup Guide

### Step 1: Create Account
1. Go to https://resend.com
2. Sign up with email
3. Verify email address

### Step 2: Get API Key
1. Go to API Keys section
2. Create new API key
3. Copy key (only shown once!)
4. Add to `.env` file

### Step 3: Verify Domain (Production)
1. Add your domain in Resend dashboard
2. Add DNS records provided
3. Wait for verification (can take 24-48 hours)
4. Use verified domain in 'from' address

### Step 4: Test
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>Hello World</p>"
  }'
```

---

## Lessons for Presentation

### Key Points
1. **Reliable Email Delivery** - Critical for OTP login
2. **Professional Templates** - Build user trust
3. **Fast Performance** - Emails sent in < 5 seconds
4. **Error Handling** - Graceful failures don't break login
5. **Scalability** - Can handle high volume

### Demo Points
- Show email template design
- Display OTP email in real inbox
- Explain Resend integration
- Show email service logs
- Demonstrate error handling

### Common Questions
**Q:** Why not use Gmail SMTP?  
**A:** Unreliable, rate limits, not designed for transactional emails

**Q:** What if Resend is down?  
**A:** Email failures logged, OTP still saved, can be resent

**Q:** How much does it cost?  
**A:** Free tier: 100 emails/day, Paid: $20/month for 50k emails

**Q:** Can users customize email templates?  
**A:** Future feature, currently admin-controlled

**Q:** Are emails encrypted?  
**A:** TLS in transit, but content not end-to-end encrypted
