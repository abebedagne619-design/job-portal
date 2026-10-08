const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// ✅ MySQL Pool setup
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jobportal',
    port: parseInt(process.env.DB_PORT) || 3307,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectionLimit: 10
});

const promisePool = pool.promise();

// ============= GET CONVERSATIONS =============
router.get('/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const [conversations] = await promisePool.query(`
            SELECT 
                CASE 
                    WHEN m.sender_id = ? THEN m.receiver_id
                    ELSE m.sender_id
                END as other_user_id,
                u.name as other_user_name,
                u.role as other_user_role,
                (SELECT message FROM messages 
                 WHERE (sender_id = ? AND receiver_id = other_user_id)
                    OR (sender_id = other_user_id AND receiver_id = ?)
                 ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages 
                 WHERE (sender_id = ? AND receiver_id = other_user_id)
                    OR (sender_id = other_user_id AND receiver_id = ?)
                 ORDER BY created_at DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM messages 
                 WHERE sender_id = other_user_id AND receiver_id = ? AND is_read = false) as unread_count
            FROM messages m
            JOIN users u ON u.id = CASE 
                WHEN m.sender_id = ? THEN m.receiver_id
                ELSE m.sender_id
            END
            WHERE m.sender_id = ? OR m.receiver_id = ?
            GROUP BY other_user_id
            ORDER BY last_message_time DESC
        `, [userId, userId, userId, userId, userId, userId, userId, userId, userId]);

        res.status(200).json(conversations || []);
    } catch (err) {
        console.error('❌ Get conversations error:', err);
        res.status(200).json([]);
    }
});

// ============= SEND MESSAGE =============
router.post('/', async (req, res) => {
    const { sender_id, receiver_id, message } = req.body;
    
    if (!sender_id || !receiver_id || !message) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    
    try {
        const [result] = await promisePool.query(
            'INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, false)',
            [sender_id, receiver_id, message]
        );
        res.status(201).json({ id: result.insertId, message: 'Sent' });
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET MESSAGES BETWEEN USERS =============
router.get('/:userId/:otherUserId', async (req, res) => {
    try {
        const [messages] = await promisePool.query(`
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
        `, [req.params.userId, req.params.otherUserId, req.params.otherUserId, req.params.userId]);
        
        // Mark messages as read
        await promisePool.query(
            'UPDATE messages SET is_read = true WHERE sender_id = ? AND receiver_id = ? AND is_read = false',
            [req.params.otherUserId, req.params.userId]
        );
        
        res.json(messages);
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= UNREAD COUNT =============
router.get('/unread/:userId', async (req, res) => {
    try {
        const [result] = await promisePool.query(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = false', 
            [req.params.userId]
        );
        res.json({ count: result[0].count || 0 });
    } catch (err) { 
        console.error('Unread count error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

// ============= MARK AS READ =============
router.put('/read/:userId/:otherUserId', async (req, res) => {
    try {
        await promisePool.query(
            'UPDATE messages SET is_read = true WHERE sender_id = ? AND receiver_id = ?', 
            [req.params.otherUserId, req.params.userId]
        );
        res.json({ message: 'Marked as read' });
    } catch (err) { 
        console.error('Mark read error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

// ============= DELETE MESSAGE =============
router.delete('/:messageId', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM messages WHERE id = ?', [req.params.messageId]);
        res.json({ message: 'Deleted' });
    } catch (err) { 
        console.error('Delete message error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;