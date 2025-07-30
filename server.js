const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    }
});

app.post('/api/send-email', async (req, res) => {
    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        await transporter.sendMail({ from: EMAIL_USER, to, subject, text });
        res.json({ message: 'Email sent' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
