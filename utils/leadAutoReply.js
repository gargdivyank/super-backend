/**
 * Fire-and-forget auto-replies after a lead is created.
 * Does not throw; logs errors only so lead creation always succeeds.
 */
const { sendLeadAutoReply } = require('./email');
const { sendLeadWhatsAppAutoReply } = require('./whatsapp');

/**
 * @param {import('mongoose').Document} lead - saved Lead document
 * @param {{ name?: string }} landingPage - populated or plain landing page
 */
function scheduleLeadAutoReplies(lead, landingPage) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || undefined;
  const landingPageName = landingPage && landingPage.name;

  if (lead.email) {
    sendLeadAutoReply({
      to: lead.email,
      name,
      landingPageName,
    }).catch((err) => {
      console.error('[Lead auto-reply] Email failed:', err.message || err);
    });
  }

  // if (lead.phone) {
  //   sendLeadWhatsAppAutoReply({
  //     to: lead.phone,
  //     name,
  //     landingPageName,
  //   }).catch((err) => {
  //     console.error('[Lead auto-reply] WhatsApp failed:', err.message || err);
  //   });
  // }
}

module.exports = { scheduleLeadAutoReplies };
