
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
    port: process.env.DB_PORT || 3307,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectionLimit: 10
});

const promisePool = pool.promise();

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================
let ioInstance = null;

const setSocketIO = (io) => {
    ioInstance = io;
};

// ==========================================
// AUTHENTICATION
// ==========================================

const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication cookie is required'
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
                message: 'Invalid authentication token'
            });
        }

        const [users] = await promisePool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!users.length) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = users[0];
        next();

    } catch (err) {
        console.error(
            'Notification authentication error:',
            err.message
        );

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication cookie'
        });
    }
};


// ==========================================
// CREATE GLOBAL NOTIFICATION
// ==========================================
const createGlobalNotification = async (type, title, message) => {
    try {
        const [result] = await promisePool.query(
            `INSERT INTO global_notifications
             (type, title, message)
             VALUES (?, ?, ?)`,
            [type, title, message]
        );

        console.log('Global notification created:', title);

        // Send real-time notification to connected users.
        if (ioInstance) {
            ioInstance.emit('new-notification', {
                id: result.insertId,
                type,
                title,
                message,
                category: 'global',
                is_read: 0
            });
        }

        return result.insertId;

    } catch (err) {
        console.error('Global notification error:', err);
        return null;
    }
};

// ==========================================
// CREATE PERSONAL NOTIFICATION
// ==========================================
const createNotification = async (userId, type, title, message) => {
    try {
        const [result] = await promisePool.query(
            `INSERT INTO notifications
             (user_id, type, title, message, is_read, created_at)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [userId, type, title, message]
        );

        console.log(
            `Personal notification created for user ${userId}`
        );

        // Send real-time notification to the specific user's room.
        if (ioInstance) {
            ioInstance.to(String(userId)).emit('new-notification', {
                id: result.insertId,
                userId: String(userId),
                type,
                title,
                message,
                category: 'personal',
                is_read: 0
            });
        }

        return result.insertId;

    } catch (err) {
        console.error('Personal notification error:', err);
        return null;
    }
};

// ==========================================
// GET USER NOTIFICATIONS
// ==========================================
router.get('/user/:userId', authenticateUser, async (req, res) => {
    try {
        const requestedUserId = Number(req.params.userId);
        const authenticatedUserId = Number(req.user.id);

        // Users can only access their own notifications.
        if (requestedUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'You cannot access another user notifications'
            });
        }

        const [notifications] = await promisePool.query(
            `
            SELECT
                id,
                type,
                title,
                message,
                is_read,
                created_at,
                'personal' AS category
            FROM notifications
            WHERE user_id = ?

            UNION ALL

            SELECT
                g.id,
                g.type,
                g.title,
                g.message,
                0 AS is_read,
                g.created_at,
                'global' AS category
            FROM global_notifications g
            WHERE NOT EXISTS (
                SELECT 1
                FROM notification_reads r
                WHERE r.notification_id = g.id
                AND r.user_id = ?
            )

            ORDER BY created_at DESC
            `,
            [authenticatedUserId, authenticatedUserId]
        );

        return res.json(notifications);

    } catch (err) {
        console.error('Get notifications error:', err);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================
router.put('/read/:id', authenticateUser, async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const userId = Number(req.user.id);
        const { category } = req.body;

        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
        }

        if (!['personal', 'global'].includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification category'
            });
        }

        // PERSONAL NOTIFICATION
        if (category === 'personal') {
            const [result] = await promisePool.query(
                `UPDATE notifications
                 SET is_read = 1
                 WHERE id = ? AND user_id = ?`,
                [notificationId, userId]
            );

            if (result.affectedRows === 0) {
                const [existing] = await promisePool.query(
                    `SELECT id, is_read
                     FROM notifications
                     WHERE id = ? AND user_id = ?`,
                    [notificationId, userId]
                );

                if (!existing.length) {
                    return res.status(404).json({
                        success: false,
                        message: 'Notification not found'
                    });
                }
            }
        }

        // GLOBAL NOTIFICATION
        if (category === 'global') {
            const [globalNotification] = await promisePool.query(
                `SELECT id
                 FROM global_notifications
                 WHERE id = ?`,
                [notificationId]
            );

            if (!globalNotification.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Global notification not found'
                });
            }

            // Check first to avoid duplicate read records.
            const [existingRead] = await promisePool.query(
                `SELECT id
                 FROM notification_reads
                 WHERE user_id = ? AND notification_id = ?
                 LIMIT 1`,
                [userId, notificationId]
            );

            if (!existingRead.length) {
                await promisePool.query(
                    `INSERT INTO notification_reads
                     (user_id, notification_id)
                     VALUES (?, ?)`,
                    [userId, notificationId]
                );
            }
        }

        return res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (err) {
        console.error('Mark notification read error:', err);

        return res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
});

// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================
router.get('/unread/:userId', authenticateUser, async (req, res) => {
    try {
        const requestedUserId = Number(req.params.userId);
        const userId = Number(req.user.id);

        if (requestedUserId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You cannot access another user notifications'
            });
        }

        const [personalResult] = await promisePool.query(
            `SELECT COUNT(*) AS count
             FROM notifications
             WHERE user_id = ? AND is_read = 0`,
            [userId]
        );

        const [globalResult] = await promisePool.query(
            `SELECT COUNT(*) AS count
             FROM global_notifications g
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM notification_reads r
                 WHERE r.notification_id = g.id
                 AND r.user_id = ?
             )`,
            [userId]
        );

        const personalCount = Number(personalResult[0].count);
        const globalCount = Number(globalResult[0].count);

        return res.json({
            success: true,
            count: personalCount + globalCount,
            personalCount,
            globalCount
        });

    } catch (err) {
        console.error('Unread notification count error:', err);

        return res.status(500).json({
            success: false,
            message: 'Failed to count unread notifications'
        });
    }
});

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    router,
    createNotification,
    createGlobalNotification,
    setSocketIO
};