
const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

// ==========================================
// DATABASE CONNECTION
// ==========================================

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jobportal',
    port: parseInt(process.env.DB_PORT, 10) || 3307,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectionLimit: 10
});

const promisePool = pool.promise();


// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================


const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication cookie is required.'
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET is not configured');
        }

        const decoded = jwt.verify(token, secret);

        if (!decoded?.id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token.'
            });
        }

        const [users] = await promisePool.query(
            `SELECT id, name, email, role
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [decoded.id]
        );

        if (!users.length) {
            return res.status(401).json({
                success: false,
                message: 'User account not found.'
            });
        }

        req.user = users[0];
        next();

    } catch (error) {
        console.error(
            'Message authentication error:',
            error.message
        );

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication cookie.'
        });
    }
};


// All message routes require authentication.
router.use(authenticateUser);

// ==========================================
// GET CONVERSATIONS
// GET /api/messages/conversations/:userId
// ==========================================

router.get('/conversations/:userId', async (req, res) => {
    try {
        const userId = req.user.id;

        if (String(req.params.userId) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You cannot access another user conversations.'
            });
        }

        const [conversations] = await promisePool.query(
            `
            SELECT
                conversation.other_user_id,
                u.name AS other_user_name,
                u.role AS other_user_role,
                m.message AS last_message,
                m.created_at AS last_message_time,

                (
                    SELECT COUNT(*)
                    FROM messages unread
                    WHERE unread.sender_id = conversation.other_user_id
                    AND unread.receiver_id = ?
                    AND unread.is_read = false
                ) AS unread_count

            FROM (
                SELECT
                    CASE
                        WHEN sender_id = ? THEN receiver_id
                        ELSE sender_id
                    END AS other_user_id,
                    MAX(id) AS latest_message_id

                FROM messages
                WHERE sender_id = ? OR receiver_id = ?

                GROUP BY other_user_id
            ) conversation

            INNER JOIN messages m
                ON m.id = conversation.latest_message_id

            INNER JOIN users u
                ON u.id = conversation.other_user_id

            ORDER BY m.created_at DESC
            `,
            [userId, userId, userId, userId]
        );

        return res.status(200).json({
            success: true,
            data: conversations
        });

    } catch (error) {
        console.error('Get conversations error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve conversations.'
        });
    }
});

// ==========================================
// UNREAD MESSAGE COUNT
// GET /api/messages/unread/:userId
// IMPORTANT: Keep this BEFORE generic message routes.
// ==========================================

router.get('/unread/:userId', authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.id;

        if (String(currentUserId) !== String(req.params.userId)) {
            return res.status(403).json({
                success: false,
                message: 'You cannot access another user unread count.'
            });
        }

        const [result] = await promisePool.query(
            `
            SELECT COUNT(*) AS count
            FROM messages
            WHERE receiver_id = ?
            AND is_read = false
            `,
            [currentUserId]
        );

        return res.status(200).json({
            success: true,
            count: Number(result[0].count) || 0
        });

    } catch (error) {
        console.error('Unread count error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve unread count.'
        });
    }
});

// ==========================================
// SEND MESSAGE
// POST /api/messages
// ==========================================

router.post('/', async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiver_id, message } = req.body;

        if (!receiver_id || !message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Receiver and message are required.'
            });
        }

        const cleanMessage = message.trim();

        if (!cleanMessage || cleanMessage.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Message must contain 1 to 5000 characters.'
            });
        }

        if (String(senderId) === String(receiver_id)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot send a message to yourself.'
            });
        }

        const [receivers] = await promisePool.query(
            'SELECT id FROM users WHERE id = ? LIMIT 1',
            [receiver_id]
        );

        if (!receivers.length) {
            return res.status(404).json({
                success: false,
                message: 'Receiver not found.'
            });
        }

        const [result] = await promisePool.query(
            `INSERT INTO messages
             (sender_id, receiver_id, message, is_read)
             VALUES (?, ?, ?, false)`,
            [senderId, receiver_id, cleanMessage]
        );

        return res.status(201).json({
            success: true,
            message: 'Message sent successfully.',
            data: {
                id: result.insertId,
                sender_id: senderId,
                receiver_id,
                message: cleanMessage,
                is_read: false,
                created_at: new Date()
            }
        });

    } catch (error) {
        console.error('Send message error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to send message.'
        });
    }
});

// ==========================================
// MARK CONVERSATION AS READ
// PUT /api/messages/read/:userId/:otherUserId
// ==========================================

router.put('/read/:userId/:otherUserId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const requestedUserId = req.params.userId;
        const otherUserId = req.params.otherUserId;

        if (String(currentUserId) !== String(requestedUserId)) {
            return res.status(403).json({
                success: false,
                message: 'You cannot update another user messages.'
            });
        }

        const [result] = await promisePool.query(
            `
            UPDATE messages
            SET is_read = true
            WHERE sender_id = ?
            AND receiver_id = ?
            AND is_read = false
            `,
            [otherUserId, currentUserId]
        );

        return res.status(200).json({
            success: true,
            message: 'Messages marked as read.',
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('Mark messages read error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to mark messages as read.'
        });
    }
});

// ==========================================
// DELETE MESSAGE
// DELETE /api/messages/:messageId
// ==========================================

router.delete('/:messageId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const messageId = req.params.messageId;

        const [result] = await promisePool.query(
            `
            DELETE FROM messages
            WHERE id = ?
            AND sender_id = ?
            `,
            [messageId, currentUserId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found or you cannot delete it.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Message deleted successfully.'
        });

    } catch (error) {
        console.error('Delete message error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to delete message.'
        });
    }
});

// ==========================================
// GET MESSAGES BETWEEN TWO USERS
// GET /api/messages/:userId/:otherUserId
// Keep generic route AFTER specific routes.
// ==========================================

router.get('/:userId/:otherUserId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const requestedUserId = req.params.userId;
        const otherUserId = req.params.otherUserId;

        if (String(currentUserId) !== String(requestedUserId)) {
            return res.status(403).json({
                success: false,
                message: 'You cannot access another user messages.'
            });
        }

        if (String(currentUserId) === String(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid conversation.'
            });
        }

        const [messages] = await promisePool.query(
            `
            SELECT
                id,
                sender_id,
                receiver_id,
                message,
                is_read,
                created_at
            FROM messages
            WHERE
                (sender_id = ? AND receiver_id = ?)
                OR
                (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC, id ASC
            `,
            [
                currentUserId,
                otherUserId,
                otherUserId,
                currentUserId
            ]
        );

        await promisePool.query(
            `
            UPDATE messages
            SET is_read = true
            WHERE sender_id = ?
            AND receiver_id = ?
            AND is_read = false
            `,
            [otherUserId, currentUserId]
        );

        return res.status(200).json({
            success: true,
            data: messages
        });

    } catch (error) {
        console.error('Get messages error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve messages.'
        });
    }
});

module.exports = router;
