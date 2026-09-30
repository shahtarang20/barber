/**
 * Sends a WhatsApp template message through the WhatsApp Business Cloud API.
 *
 * Business-initiated messages (reminders) must use a template pre-approved in
 * Meta Business Manager. Required env vars:
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_REMINDER_TEMPLATE
 * Waitlist alerts use WHATSAPP_WAITLIST_TEMPLATE ({{1}} name, {{2}} slot time, {{3}} booking link).
 * Optional: WHATSAPP_TEMPLATE_LANG (default "en").
 * The template body takes 3 variables: {{1}} customer name, {{2}} date & time, {{3}} barber name.
 *
 * Returns true only if WhatsApp accepted the message.
 */
export async function sendTemplate(toDigits: string, template: string | undefined, params: string[]): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || !template) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (!res.ok) console.error("WhatsApp send failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return false;
  }
}

export const sendReminderTemplate = (toDigits: string, params: [string, string, string]) =>
  sendTemplate(toDigits, process.env.WHATSAPP_REMINDER_TEMPLATE, params);

export const isWhatsAppConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_REMINDER_TEMPLATE);
