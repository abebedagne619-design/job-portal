const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const upload = require('../middleware/upload');
const { sendApplicationNotification, sendConfirmationEmail } = require('../utils/email');
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

// --- 1. Get all applications (ለአስተዳዳሪ/Admin ሊሆን ይችላል) ---
router.get('/', async (req, res) => {
    try {
        const [applications] = await promisePool.query(`
            SELECT a.*, j.title as job_title, j.company 
            FROM applications a 
            JOIN jobs j ON a.job_id = j.id 
            ORDER BY a.applied_at DESC
        `);
        res.json(applications);
    } catch (err) {
        console.error('Get applications error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- 🌟 2. Get applications for Employer (አዲስ የተጨመረ - ለአሰሪው ብቻ) ---
// ይህ ራውት 'EmployerApplications.jsx' ገጽ እንዲሰራ የግድ አስፈላጊ ነው
router.get(
    '/employer/:employerId',
    authenticate,
    authorize('employer', 'admin'),
    async (req, res) => {
        try {
            const employerId = Number(req.params.employerId);

            if (!Number.isInteger(employerId) || employerId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid employer ID'
                });
            }

            // Employer can only view their own applications
            if (
                req.user.role === 'employer' &&
                Number(req.user.id) !== employerId
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot view another employer applications'
                });
            }

            const [applications] = await promisePool.query(
                `SELECT
                    a.*,
                    j.title AS job_title,
                    j.company
                 FROM applications a
                 JOIN jobs j ON a.job_id = j.id
                 WHERE j.employer_id = ?
                 ORDER BY a.applied_at DESC`,
                [employerId]
            );

            return res.json(applications);

        } catch (error) {
            console.error('Fetch employer applications error:', error);

            return res.status(500).json({
                success: false,
                message: 'Failed to fetch applications'
            });
        }
    }
);

// --- 3. Submit application ---
router.post(
    '/',
    authenticate,
    authorize('user', 'applicant'),
    upload.single('cv'),
    async (req, res) => {
        let cvPath = null;

        try {
            const { job_id, name, email, phone, cover_letter } = req.body;

            cvPath = req.file ? req.file.path : null;

            if (!job_id || !name || !email || !cover_letter) {
                return res.status(400).json({
                    success: false,
                    message: 'Please fill in all required fields'
                });
            }

            // Confirm that the job exists
            const [jobs] = await promisePool.query(
                'SELECT id, title, employer_id FROM jobs WHERE id = ?',
                [job_id]
            );

            if (jobs.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }

            // Save application using the authenticated user's ID
            const [result] = await promisePool.query(
                `INSERT INTO applications
                (job_id, name, email, phone, cover_letter, cv_path, applicant_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    job_id,
                    name,
                    email,
                    phone || null,
                    cover_letter,
                    cvPath,
                    req.user.id
                ]
            );

            // Send notifications
            try {
                await sendApplicationNotification(
                    jobs[0].employer_id,
                    name,
                    jobs[0].title
                );

                await sendConfirmationEmail(email, name, jobs[0].title);

                await createNotification(
                    jobs[0].employer_id,
                    `New application received for ${jobs[0].title}`
                );
            } catch (notificationError) {
                console.error('Notification error:', notificationError.message);
            }

            return res.status(201).json({
                success: true,
                message: 'Application submitted successfully!',
                id: result.insertId
            });

        } catch (error) {
            console.error('Application submission error:', error);

            return res.status(500).json({
                success: false,
                message: 'Failed to submit application'
            });
        }
    }
);

// --- 4. Update application status ---

router.put(
    '/:id/status',
    authenticate,
    authorize('employer', 'admin'),
    async (req, res) => {
        try {
            const applicationId = Number(req.params.id);
            const { status } = req.body;

            const allowedStatuses = [
                'pending',
                'reviewed',
                'accepted',
                'rejected'
            ];

            if (!Number.isInteger(applicationId) || applicationId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid application ID'
                });
            }

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid application status'
                });
            }

            // Check application and its job owner
            const [applications] = await promisePool.query(
                `SELECT a.id, j.employer_id
                 FROM applications a
                 JOIN jobs j ON a.job_id = j.id
                 WHERE a.id = ?`,
                [applicationId]
            );

            if (applications.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            const application = applications[0];

            // Employer can update only applications for their own jobs
            if (
                req.user.role === 'employer' &&
                Number(application.employer_id) !== Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot update this application'
                });
            }

            await promisePool.query(
                'UPDATE applications SET status = ? WHERE id = ?',
                [status, applicationId]
            );

            return res.json({
                success: true,
                message: 'Application status updated successfully'
            });

        } catch (error) {
            console.error('Update application status error:', error);

            return res.status(500).json({
                success: false,
                message: 'Failed to update application status'
            });
        }
    }
);

// --- 5. Delete application ---
router.delete(
    '/:id',
    authenticate,
    authorize('employer', 'admin'),
    async (req, res) => {
        try {
            const applicationId = Number(req.params.id);

            if (!Number.isInteger(applicationId) || applicationId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid application ID'
                });
            }

            const [applications] = await promisePool.query(
                `SELECT a.id, a.cv_path, j.employer_id
                 FROM applications a
                 JOIN jobs j ON a.job_id = j.id
                 WHERE a.id = ?`,
                [applicationId]
            );

            if (applications.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            const application = applications[0];

            // Employer can delete only applications for their own jobs
            if (
                req.user.role === 'employer' &&
                Number(application.employer_id) !== Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot delete this application'
                });
            }

            await promisePool.query(
                'DELETE FROM applications WHERE id = ?',
                [applicationId]
            );

            return res.json({
                success: true,
                message: 'Application deleted successfully'
            });

        } catch (error) {
            console.error('Delete application error:', error);

            return res.status(500).json({
                success: false,
                message: 'Failed to delete application'
            });
        }
    }
);

// --- Authentication functions ---
const jwt = require('jsonwebtoken');

// Verify logged-in user
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Please login first'
            });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'jobportal_secret_key_2024'
        );

        const [users] = await promisePool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = users[0];
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

// Check user role
function authorize(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        next();
    };
}

module.exports = router;