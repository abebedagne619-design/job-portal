const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jobportal',
    port: process.env.DB_PORT || 3307,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectionLimit: 10 
});

const promisePool = pool.promise();

// ============= SETUP 2FA =============
router.post('/setup', async (req, res) => {
    const { userId, email } = req.body;
    
    const secret = speakeasy.generateSecret({
        name: `JobPortal:${email}`
    });
    
    await promisePool.query(
        'UPDATE users SET two_factor_secret = ? WHERE id = ?',
        [secret.base32, userId]
    );
    
    QRCode.toDataURL(secret.otpauth_url, (err, qrCode) => {
        if (err) {
            return res.status(500).json({ error: 'QR generation failed' });
        }
        res.json({ secret: secret.base32, qrCode });
    });
});

// ============= VERIFY 2FA =============
router.post('/verify', async (req, res) => {
    const { userId, token } = req.body;
    
    const [users] = await promisePool.query(
        'SELECT two_factor_secret FROM users WHERE id = ?',
        [userId]
    );
    
    if (!users[0]?.two_factor_secret) {
        return res.status(400).json({ message: '2FA not setup' });
    }
    
    const verified = speakeasy.totp.verify({
        secret: users[0].two_factor_secret,
        encoding: 'base32',
        token: token
    });
    
    if (verified) {
        await promisePool.query(
            'UPDATE users SET two_factor_enabled = true WHERE id = ?',
            [userId]
        );
        res.json({ verified: true });
    } else {
        res.status(401).json({ verified: false });
    }
});

// ============= DISABLE 2FA =============
router.post('/disable', async (req, res) => {
    const { userId } = req.body;
    
    await promisePool.query(
        'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false WHERE id = ?',
        [userId]
    );
    
    res.json({ message: '2FA disabled' });
});

// ============= VERIFY 2FA DURING LOGIN =============
router.post('/login-verify', async (req, res) => {
    const { userId, token } = req.body;
    
    const [users] = await promisePool.query(
        'SELECT two_factor_secret FROM users WHERE id = ?',
        [userId]
    );
    
    const verified = speakeasy.totp.verify({
        secret: users[0].two_factor_secret,
        encoding: 'base32',
        token: token
    });
    
    res.json({ verified });
});

module.exports = router;