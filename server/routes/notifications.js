const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Database connection
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

// ============= 1. CREATE GLOBAL NOTIFICATION (ለአዲስ ስራ) =============
// ይህ ተግባር አንድ ስራ ሲለጠፍ አንዴ ብቻ ዳታቤዝ ላይ ለመመዝገብ ነው
const createGlobalNotification = async (type, title, message) => {
    try {
        const [result] = await promisePool.query(
            'INSERT INTO global_notifications (type, title, message) VALUES (?, ?, ?)',
            [type, title, message]
        );
        console.log(`✅ Global Notification Created: ${title}`);
        return result.insertId;
    } catch (err) {
        console.error('❌ Global notification error:', err);
        return null;
    }
};

// ============= 2. CREATE PERSONAL NOTIFICATION (ለኢንተርቪው) =============
// የድሮው createNotification ስሙን ጠብቆ ለግል መልእክቶች እንዲሰራ ሆኗል
const createNotification = async (userId, type, title, message) => {
    try {
        const [result] = await promisePool.query(
            'INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, ?, false, NOW())',
            [userId, type, title, message]
        );
        console.log(`✅ Personal Notification created for user ${userId}`);
        return result.insertId;
    } catch (err) {
        console.error('❌ Personal notification error:', err);
        return null;
    }
};

// ============= 3. GET ALL NOTIFICATIONS (Global + Personal) =============
// ተጠቃሚው ገጹን ሲከፍት ሁለቱንም በአንድ ላይ አዋህዶ ያሳያል
router.get('/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // የግል ማሳወቂያዎች እና አጠቃላይ ማሳወቂያዎችን (ያልተነበቡትን) በአንድ ላይ ያመጣል
        const [notifications] = await promisePool.query(`
            SELECT id, type, title, message, is_read, created_at, 'personal' as category FROM notifications WHERE user_id = ?
            UNION ALL
            SELECT g.id, g.type, g.title, g.message, false as is_read, g.created_at, 'global' as category 
            FROM global_notifications g
            LEFT JOIN notification_reads r ON g.id = r.notification_id AND r.user_id = ?
            WHERE r.notification_id IS NULL
            ORDER BY created_at DESC
        `, [userId, userId]);

        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 4. MARK AS READ (Global and Personal) =============
router.put('/read/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, category } = req.body; // category: 'global' ወይም 'personal'

    try {
        if (category === 'global') {
            // ለአጠቃላይ ማሳወቂያ 'notification_reads' ውስጥ መመዝገብ
            await promisePool.query(
                'INSERT IGNORE INTO notification_reads (user_id, notification_id) VALUES (?, ?)',
                [userId, id]
            );
        } else {
            // ለግል ማሳወቂያ 'is_read' ማደስ
            await promisePool.query('UPDATE notifications SET is_read = true WHERE id = ?', [id]);
        }
        res.json({ message: 'Marked as read successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// የድሮውን Routes ሳይቀነስ መቀጠል...
router.get('/unread/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const [personalCount] = await promisePool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false', [userId]);
        const [globalCount] = await promisePool.query(`
            SELECT COUNT(*) as count FROM global_notifications g
            LEFT JOIN notification_reads r ON g.id = r.notification_id AND r.user_id = ?
            WHERE r.notification_id IS NULL
        `, [userId]);
        
        res.json({ count: (personalCount[0].count + globalCount[0].count) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exporting
module.exports = {
    router,
    createNotification,
    createGlobalNotification // አዲሱ እዚህ ተጨምሯል
};