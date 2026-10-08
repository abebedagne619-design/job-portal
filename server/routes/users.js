const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/email');

// MySQL Pool ዝግጅት
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

// ============= REGISTER USER =============
router.post('/register', async (req, res) => {
    // 🔔 'role' እዚህ ጋር ተጨምሯል (ከ Frontend 'employer' ወይም 'user' ተብሎ እንዲመጣ)
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const [existing] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 🔔 ለ role ተለዋዋጭ እንዲሆን ተደርጓል። ካልተላከ 'user' ይሆናል።
        const userRole = role || 'user';

        const [result] = await promisePool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, userRole]
        );

        res.status(201).json({ 
            id: result.insertId, 
            name, 
            email, 
            role: userRole,
            message: 'Registration successful' 
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= LOGIN USER =============
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];
        
        // የይለፍ ቃል ንፅፅር
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, user.password);
        } catch (compareErr) {
            // በሆነ ምክንያት bcrypt ቢከሽፍ ለድሮዎቹ plain text ከሆነ ለማረጋገጥ፡
            if (password === user.password) {
                isValidPassword = true;
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        res.json({ 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role, 
            message: 'Login successful' 
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= FORGOT PASSWORD =============
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        // Token የሚቆይበት ጊዜ (1 ሰዓት)
        const resetExpires = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');

        await promisePool.query(
            'UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?',
            [resetToken, resetExpires, email]
        );

        await sendPasswordResetEmail(email, resetToken);
        res.json({ message: 'Password reset link sent to your email' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= RESET PASSWORD =============
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }

    try {
        // Token በትክክል እና ጊዜው እንዳላለፈ ቼክ ማድረግ
        const [users] = await promisePool.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await promisePool.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, users[0].id]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= CHANGE PASSWORD =============
router.post('/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const [users] = await promisePool.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await promisePool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.json({ message: 'Password changed successfully!' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET ALL USERS (FIXED PATH) =============
// 🔔 እዚህ ጋር '/users' የነበረው ወደ '/' ተቀይሯል ምክንያቱም server.js ላይ /api/users ተብሏል
router.get('/', async (req, res) => {
    try {
        const [users] = await promisePool.query(
            'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= UPDATE USER =============
router.put('/:id', async (req, res) => {
    const { name, email, role } = req.body;
    try {
        await promisePool.query(
            'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
            [name, email, role, req.params.id]
        );
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= DELETE USER =============
router.delete('/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;