const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    await transporter.sendMail({ from: EMAIL_USER, to, subject, text });
    res.status(200).json({ message: 'Email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
};
