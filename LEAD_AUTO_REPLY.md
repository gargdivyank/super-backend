# Lead auto-reply (Email + WhatsApp)

When a lead is submitted via `POST /api/leads`, the server can send:

- **Email** auto-reply (Nodemailer + SMTP)
- **WhatsApp** auto-reply (Twilio WhatsApp API)

If credentials are missing, those channels are **skipped** — lead creation still returns `201`.

## Environment variables

Add to `.env`:

### Email (SMTP)

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | Yes for email | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | No | default `587` |
| `SMTP_SECURE` | No | `true` for port 465 |
| `SMTP_USER` | Yes for email | SMTP username |
| `SMTP_PASS` | Yes for email | SMTP password / app password |
| `SMTP_FROM` | No | From address (defaults to `SMTP_USER`) |
| `SMTP_FROM_NAME` | No | Display name, default `Our Team` |
| `LEAD_AUTO_REPLY_EMAIL_SUBJECT` | No | Default: `Thanks for contacting us` |

### WhatsApp (Twilio)

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes for WhatsApp | From Twilio console |
| `TWILIO_AUTH_TOKEN` | Yes for WhatsApp | From Twilio console |
| `TWILIO_WHATSAPP_FROM` | Yes for WhatsApp | e.g. `whatsapp:+14155238886` |
| `LEAD_WHATSAPP_DEFAULT_COUNTRY_CODE` | No | e.g. `91` if numbers are 10-digit local |

Twilio requires a WhatsApp-enabled sender; use the sandbox for testing.

## Install dependencies

From `super-backend`:

```bash
npm install nodemailer twilio
```
