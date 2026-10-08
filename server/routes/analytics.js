const express = require('express');
const router = express.Router();
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

// Most popular jobs
router.get('/popular-jobs', async (req, res) => {
    try {
        const [jobs] = await promisePool.query(`
            SELECT j.id, j.title, j.company, COUNT(a.id) as applications 
            FROM jobs j 
            LEFT JOIN applications a ON j.id = a.job_id 
            GROUP BY j.id 
            ORDER BY applications DESC 
            LIMIT 10
        `);
        res.json(jobs);
    } catch (err) {
        console.error('Popular jobs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Jobs by type
router.get('/jobs-by-type', async (req, res) => {
    try {
        const [stats] = await promisePool.query(`
            SELECT type, COUNT(*) as count 
            FROM jobs 
            GROUP BY type
        `);
        res.json(stats);
    } catch (err) {
        console.error('Jobs by type error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Applications timeline
router.get('/applications-timeline', async (req, res) => {
    try {
        const [timeline] = await promisePool.query(`
            SELECT DATE(applied_at) as date, COUNT(*) as count 
            FROM applications 
            WHERE applied_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(applied_at) 
            ORDER BY date DESC
        `);
        res.json(timeline);
    } catch (err) {
        console.error('Timeline error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============= TRACK JOB VIEW =============
router.post('/track-view', async (req, res) => {
    const { jobId, userId } = req.body;
    
    try {
        await promisePool.query(
            'INSERT INTO job_views (job_id, user_id) VALUES (?, ?)',
            [jobId, userId || null]
        );
        res.json({ message: 'View tracked' });
    } catch (err) {
        console.error('Track view error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET MOST VIEWED JOBS =============
router.get('/most-viewed', async (req, res) => {
    try {
        const [jobs] = await promisePool.query(`
            SELECT j.*, COUNT(v.id) as view_count
            FROM jobs j
            LEFT JOIN job_views v ON j.id = v.job_id
            GROUP BY j.id
            ORDER BY view_count DESC
            LIMIT 10
        `);
        res.json(jobs);
    } catch (err) {
        console.error('Most viewed error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;