const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const { sendEmail } = require('../utils/email');

// ማሳሰቢያ፡ notifications ን እዚህ በቀጥታ ከመጥራት ይልቅ 
// ዳታቤዝ ውስጥ ብቻ በመመዝገብ ወይም socket በመጠቀም ማሳወቅ ይቻላል።
const { createNotification } = require('./notifications'); 

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

// ============= 1. CREATE JOB ALERT =============
router.post('/', async (req, res) => {
    const { userId, keyword, location, jobType } = req.body;
    
    // አስፈላጊ መረጃ መኖሩን ማረጋገጥ
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    try {
        // አንቺ የላክሽው ዋናው ኮድ እዚህ ጋር ተካቷል
        await promisePool.query(
            'INSERT INTO job_alerts (user_id, keyword, location, job_type) VALUES (?, ?, ?, ?)',
            [userId, keyword || null, location || null, jobType || null]
        );
        
        // ምላሹን አንቺ በጠየቅሽው መሠረት አድርጌዋለሁ
        res.json({ message: 'Alert created' });
        
    } catch (err) {
        console.error('Create alert error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= 2. GET USER'S ALERTS =============
router.get('/user/:userId', async (req, res) => {
    try {
        const [alerts] = await promisePool.query(
            'SELECT * FROM job_alerts WHERE user_id = ? ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 3. DELETE ALERT =============
router.delete('/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM job_alerts WHERE id = ?', [req.params.id]);
        res.json({ message: 'Alert deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 4. CHECK AND SEND ALERTS =============
const checkAndSendAlerts = async (newJob) => {
    try {
        const [alerts] = await promisePool.query('SELECT * FROM job_alerts WHERE is_active = true');
        
        for (const alert of alerts) {
            let matches = true;
            
            // Keyword matching (title ውስጥ ካለ)
            if (alert.keyword && !newJob.title.toLowerCase().includes(alert.keyword.toLowerCase())) {
                matches = false;
            }
            // Location matching
            if (matches && alert.location && newJob.location !== alert.location) {
                matches = false;
            }
            // Job Type matching
            if (matches && alert.job_type && newJob.type !== alert.job_type) {
                matches = false;
            }
            
            if (matches) {
                const [userRows] = await promisePool.query('SELECT email FROM users WHERE id = ?', [alert.user_id]);
                const user = userRows[0];

                if (user) {
                    // Email
                    sendEmail(user.email, `New Job Alert: ${newJob.title}`, `A new job matching your criteria has been posted.`).catch(e => console.log(e));
                    
                    // Bell Notification
                    if (createNotification) {
                        createNotification(alert.user_id, 'job_alert', `New Job: ${newJob.title}`, `Matches your criteria!`)
                        .catch(e => console.log("Notification error:", e.message));
                    }
                }
            }
        }
    } catch (err) {
        console.error('CheckAndSend error:', err);
    }
};

// **ይህ በጣም አስፈላጊ ነው!**
module.exports = {
    router: router,
    checkAndSendAlerts: checkAndSendAlerts
};