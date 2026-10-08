require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'abebedagne619@gmail.com',
    subject: 'Test Email from Job Portal',
    html: '<h1>Test</h1><p>If you see this, email is working!</p>'
}).then(() => {
    console.log('✅ Test email sent!');
}).catch(err => {
    console.error('❌ Error:', err);
});