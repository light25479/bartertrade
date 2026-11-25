const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail({ to, subject, text }) {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured');
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'BarterTrade <no-reply@bartertrade.com>',
    to,
    subject,
    text,
  });
}

module.exports = { sendMail };