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

  const { to, subject, text, name } = req.body || {};
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0 || !subject || !text) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const recipientName = name || 'Vecino/a';
  const currentDate = new Date().toLocaleDateString('es-AR');
  const logoUrl = 'https://drive.google.com/uc?export=view&id=1BXBBYqL3uDoPXd4i9jdRu1gFnA2McZpj';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <p><b>${subject}</b></p>
      <p><b>Fecha:</b> ${currentDate}</p>
      <br>
      <p>Estimado/a ${recipientName},</p>
      <br>
      <p>${text}</p>
      <br>
      <p>Atentamente,</p>
      <p><b>Dirección de Ambiente - Municipalidad de San Isidro</b></p>
      <img src="${logoUrl}" alt="Logo San Isidro" style="width: 150px; height: auto;"/>
    </div>
  `;

  const mailOptions = {
    from: EMAIL_USER,
    to: recipients.join(','),
    subject,
    text,
    html: htmlBody,
  };

  const notify = process.env.NOTIFY_EMAILS;
  if (notify) {
    const bccList = notify.split(',').map(email => email.trim()).filter(Boolean);
    if (bccList.length > 0) {
      mailOptions.bcc = bccList;
    }
  }

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
};
