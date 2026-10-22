import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasSmtp) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Dev mode: log emails to console
    transporter = {
      sendMail: async (opts) => {
        console.log('\n📧 ──── DEV EMAIL ────────────────────────────────────');
        console.log(`   To:      ${opts.to}`);
        console.log(`   Subject: ${opts.subject}`);
        const linkMatch = (opts.html || opts.text || '').match(/https?:\/\/[^\s"<]+/);
        if (linkMatch) console.log(`   Link:    ${linkMatch[0]}`);
        console.log('────────────────────────────────────────────────────\n');
        return { messageId: 'dev-' + Date.now() };
      },
    };
  }

  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  return t.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@taskflow.dev',
    to,
    subject,
    html,
    text,
  });
};

export default { sendEmail };
