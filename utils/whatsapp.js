/**
 * WhatsApp auto-reply via Twilio WhatsApp API.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env.
 * If not configured, sends are skipped.
 *
 * TWILIO_WHATSAPP_FROM example: whatsapp:+14155238886 (sandbox or approved sender)
 * LEAD_WHATSAPP_DEFAULT_COUNTRY_CODE: digits only, e.g. 91 for India (no +)
 */

function normalizeWhatsAppTo({ raw, defaultCountryCode }) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[\s()-]/g, '');
  if (!s) return null;

  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }

  const digitsOnly = s.replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (defaultCountryCode && digitsOnly.length === 10) {
    return `+${defaultCountryCode}${digitsOnly}`;
  }

  return `+${digitsOnly}`;
}

async function sendLeadWhatsAppAutoReply({ to, name, landingPageName }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from || !to) {
    return;
  }

  const twilio = require('twilio');
  const defaultCc = (process.env.LEAD_WHATSAPP_DEFAULT_COUNTRY_CODE || '').replace(/\D/g, '') || undefined;
  const e164 = normalizeWhatsAppTo({ raw: to, defaultCountryCode: defaultCc });
  if (!e164) {
    console.warn('WhatsApp auto-reply: could not normalize phone:', to);
    return;
  }

  const client = twilio(accountSid, authToken);
  const displayName = name || 'there';
  const pageText = landingPageName ? ` about ${landingPageName}` : '';
  const body =
    `Hi ${displayName}, thanks for contacting us${pageText}. ` +
    `We have received your details and will get back to you shortly.`;

  await client.messages.create({
    from,
    to: `whatsapp:${e164}`,
    body,
  });
}

module.exports = { sendLeadWhatsAppAutoReply, normalizeWhatsAppTo };
