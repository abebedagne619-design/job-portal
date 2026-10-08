const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            html
        });
        console.log('✅ Email sent successfully to:', to);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
    }
};

const sendApplicationNotification = async (jobTitle, applicantName, applicantEmail) => {
    const subject = `📝 New Application for ${jobTitle}`;
    const html = `
        <h2>New Job Application</h2>
        <p><strong>Position:</strong> ${jobTitle}</p>
        <p><strong>Applicant:</strong> ${applicantName}</p>
        <p><strong>Email:</strong> ${applicantEmail}</p>
        <p>Please check the admin dashboard for more details.</p>
    `;
    return await sendEmail(process.env.EMAIL_USER, subject, html);
};

const sendConfirmationEmail = async (applicantName, applicantEmail, jobTitle) => {
    const subject = `✅ Application Received - ${jobTitle}`;
    const html = `
        <h2>Thank you for your application!</h2>
        <p>Dear ${applicantName},</p>
        <p>We have received your application for <strong>${jobTitle}</strong>.</p>
        <p>We will review your application and get back to you soon.</p>
        <br/>
        <p>Best regards,</p>
        <p>Job Portal Team</p>
    `;
    return await sendEmail(applicantEmail, subject, html);
};

const sendPasswordResetEmail = async (email, resetToken) => {
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    const subject = '🔐 Password Reset Request';
    const html = `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
    `;
    return await sendEmail(email, subject, html);
};

module.exports = { sendEmail, sendApplicationNotification, sendConfirmationEmail, sendPasswordResetEmail };