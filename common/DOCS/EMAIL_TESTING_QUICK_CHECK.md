# Testing Email Service

## ✅ Quick Health Check

```bash
curl http://localhost:3002/healthz
```

Expected: `{"status":"ok","service":"email-service","timestamp":"..."}`

---

## 📧 Test 1: Send OTP Email

```bash
curl -X POST http://localhost:3002/email/otp \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "your-email@example.com",
    "otp_code": "123456",
    "expires_at": "2026-02-12T13:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "request_id": "uuid-here",
  "status": "queued"
}
```

---

## 📧 Test 2: Send Invitation Email

```bash
curl -X POST http://localhost:3002/email/invite \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "newuser@example.com",
    "invite_link": "https://spis.gov.jm/register?token=abc123"
  }'
```

---

## 📧 Test 3: Send Notification Email

```bash
curl -X POST http://localhost:3002/email/notify \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "user@example.com",
    "subject": "Test Notification",
    "content": "<p>This is a test notification from SPIS.</p>"
  }'
```

---

## 🔍 Check Email Requests in Database

You can query the database to see all queued/sent emails:

```bash
cd /home/yuvraj/Desktop/SPIS/backend/email-service && node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://qlehzgxxhbbiniouwgta.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWh6Z3h4aGJiaW5pb3V3Z3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg3NDUyOCwiZXhwIjoyMDg2NDUwNTI4fQ.Z7n9JDcABBe6OeiLaLMCl4gMPjfJthyOrE7ObaSc_To'
);

s.rpc('exec_sql', { 
  query: 'SELECT request_id, to_email, template_code, status, attempts, provider_used, sent_at, created_at FROM email_requests ORDER BY created_at DESC LIMIT 5' 
}).then(r => {
  if (r.error) console.log('ERROR:', r.error);
  else console.table(r.data);
});
"
```

---

## 📊 What You Should See

### 1. **API Response** (202 Accepted)
The email service returns immediately with `{"success": true, "status": "queued"}` — this means the request was saved to the database.

### 2. **RabbitMQ Processing**
Check the email-service logs — you should see:
```
{"level":"info","message":"OTP email queued","request_id":"..."}
```

### 3. **Email Delivery**
The background worker will:
1. Pick up the queued message from RabbitMQ
2. Render the template with your data
3. Send via SendGrid (configured with your API key: `SG.i2daHMoMQ...`)
4. Update the database status to `sent` or `failed`

### 4. **Database Status Updates**
Re-run the database query above — the `status` should change from `queued` → `processing` → `sent`

The `provider_used` field will show `sendgrid` and `sent_at` will have a timestamp.

---

## 🔧 Email Service Configuration

**Current Setup:**
- **SendGrid API Key**: Configured in `.env`
- **From Email**: `noreply@spis.gov.jm`
- **CloudAMQP**: Connected for async processing
- **Database**: `qlehzgxxhbbiniouwgta.supabase.co`
- **Templates**: 4 pre-loaded (iam_otp, invite, notification, password_reset)

---

## ⚠️ Important Notes

1. **Email Delivery Time**: Emails are queued immediately but may take 1-5 seconds to actually send (async via RabbitMQ worker)

2. **Idempotency**: If you call the API with the same `request_id`, it won't create duplicates

3. **Rate Limiting**: The service has built-in rate limits (check `rate_limits` table)

4. **Provider Failover**: If SendGrid fails, the service automatically tries SMTP (if configured)

---

## 🐛 Troubleshooting

### Email not sending?

1. **Check RabbitMQ connection**:
   ```bash
   # Look for "RabbitMQ connected" in email-service logs
   ```

2. **Verify SendGrid API key**:
   ```bash
   cat /home/yuvraj/Desktop/SPIS/backend/email-service/.env | grep SENDGRID
   ```

3. **Check email_providers table**:
   ```bash
   # Make sure 'sendgrid' status is 'active', not 'down'
   ```

4. **Look for errors in logs**:
   - Check the terminal running email-service for error messages
   - Look for `"level":"error"` in the logs

---

## ✅ Success Indicators

You'll know the email service is working correctly when:

1. ✅ API returns `202 Accepted` with a `request_id`
2. ✅ Database shows the email request with `status: 'queued'`
3. ✅ Logs show "email queued" message
4. ✅ After a few seconds, status changes to `'sent'`
5. ✅ `sent_at` timestamp is populated
6. ✅ You receive the email in your inbox!

**Note**: Since SendGrid is configured, emails will actually be delivered to the `to_email` address. Make sure to use a real email you can access for testing!
