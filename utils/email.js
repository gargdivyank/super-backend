/**
 * Transactional email for lead auto-replies.
 * Configure SMTP in .env (see LEAD_AUTO_REPLY.md). If not configured, sends are skipped.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

/**
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} [opts.name]
 * @param {string} [opts.landingPageName]
 */
async function sendLeadAutoReply({ to, name, landingPageName }) {
  const tx = getTransporter();
  if (!tx || !to) {
    return;
  }

  const displayName = name || 'there';
  const pageText = landingPageName ? ` about ${landingPageName}` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.5;">
      <p>Hi ${displayName},</p>
      <p>Thank you for submitting your details${pageText}. We have received your request and our team will get back to you shortly.</p>
      <p>If you did not submit this form, you can ignore this message.</p>
      <p style="margin-top: 24px;">Best regards,<br/>The Team</p>
    </div>
  `;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await tx.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Our Team'}" <${from}>`,
    to,
    subject: process.env.LEAD_AUTO_REPLY_EMAIL_SUBJECT || 'Thanks for contacting us',
    html,
  });
}

module.exports = { sendLeadAutoReply, getTransporter };
