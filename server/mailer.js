const nodemailer = require('nodemailer');

let transporter = null;
if (!process.env.BREVO_API_KEY && process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendViaBrevo({ to, subject, text }) {
  if (!process.env.MAIL_FROM_EMAIL) throw new Error('MAIL_FROM_EMAIL is not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: process.env.MAIL_FROM_NAME || 'BarterTrade', email: process.env.MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo error ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendMail({ to, subject, text }) {
  if (process.env.BREVO_API_KEY) return sendViaBrevo({ to, subject, text });

  if (transporter) {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'BarterTrade <no-reply@bartertrade.com>',
      to,
      subject,
      text,
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured');
  console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
}

module.exports = { sendMail };