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
router.get('/employer/:employerId', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT 
                a.id, 
                a.status, 
                a.applied_at, 
                a.name AS applicant_name, 
                a.email AS applicant_email, 
                a.phone, 
                a.cv_path,
                a.job_id,
                j.title AS job_title
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE j.employer_id = ?
            ORDER BY a.applied_at DESC
        `, [req.params.employerId]);

        res.json(rows);
    } catch (err) {
        console.error('Employer Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch employer applications' });
    }
});

// --- 3. Submit application ---
router.post('/', upload.single('cv'), async (req, res) => {
    const { job_id, name, email, phone, cover_letter, userId } = req.body; 
    const cv_path = req.file ? req.file.path : null;

    if (!job_id || !name || !email) {
        return res.status(400).json({ message: 'Job ID, name, and email are required' });
    }

    try {
        const [result] = await promisePool.query(
            `INSERT INTO applications (job_id, name, email, phone, cover_letter, cv_path, applicant_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [job_id, name, email, phone || null, cover_letter || null, cv_path, userId || null]
        );

        const [jobs] = await promisePool.query('SELECT title, employer_id FROM jobs WHERE id = ?', [job_id]);
        const job = jobs[0];
        const jobTitle = job?.title || 'Job';

        // ማሳወቂያዎች
        try {
            await sendApplicationNotification(jobTitle, name, email);
            await sendConfirmationEmail(name, email, jobTitle);
            
            if (job && job.employer_id) {
                await createNotification(
                    job.employer_id, 
                    'application', 
                    'New Application Received', 
                    `${name} has applied for the position of ${jobTitle}`
                );
            }
            
            if (userId) {
                await createNotification(
                    userId, 
                    'application_status', 
                    'Application Sent', 
                    `You have successfully applied for ${jobTitle}.`
                );
            }
        } catch (subErr) {
            console.error('Secondary tasks failed:', subErr.message);
        }

        res.status(201).json({ id: result.insertId, message: 'Application submitted successfully!' });
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. Update application status ---
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await promisePool.query('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 5. Delete application ---
router.delete('/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM applications WHERE id = ?', [req.params.id]);
        res.json({ message: 'Application deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;