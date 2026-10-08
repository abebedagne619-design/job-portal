// Forgot password - send reset token
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
    
    await promisePool.query(
        'UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?',
        [token, expires, email]
    );
    
    // Send email with reset link
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendEmail(email, 'Password Reset', `Click here: ${resetLink}`);
    
    res.json({ message: 'Reset link sent to your email' });
});

// Reset password
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    const [users] = await promisePool.query(
        'SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?',
        [token, Date.now()]
    );
    
    if (users.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    await promisePool.query(
        'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
        [newPassword, users[0].id]
    );
    
    res.json({ message: 'Password reset successfully' });
});