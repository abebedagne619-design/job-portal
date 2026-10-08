const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

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

// ============= MIDDLEWARE to get user from token =============
const getUserIdFromToken = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        return decoded.id;
    } catch (err) {
        return null;
    }
};

// ============= CHECK IF JOB IS SAVED =============
// ✅ ከቶከን ጋር (የሚመከር)
router.get('/check/:jobId', async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const [result] = await promisePool.query(
            'SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, req.params.jobId]
        );
        res.json({ isSaved: result.length > 0 });
    } catch (err) {
        console.error('Check saved error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ ከuserId እና jobId ጋር (backward compatibility)
router.get('/check/:userId/:jobId', async (req, res) => {
    try {
        const [result] = await promisePool.query(
            'SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [req.params.userId, req.params.jobId]
        );
        res.json({ saved: result.length > 0 });
    } catch (err) {
        console.error('Check saved error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= SAVE A JOB =============
router.post('/', async (req, res) => {
    // ከቶከን በመጠቀም userId ማግኘት ይቻላል
    let userId = getUserIdFromToken(req);
    
    // ወይም ከbody በመጠቀም (backward compatibility)
    if (!userId && req.body.userId) {
        userId = req.body.userId;
    }
    
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { jobId, title, company, location } = req.body;
    const job_id = jobId || req.body.job_id;
    
    if (!job_id) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    try {
        // Check if already saved
        const [existing] = await promisePool.query(
            'SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, job_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Job already saved' });
        }

        // Save the job
        await promisePool.query(
            'INSERT INTO saved_jobs (user_id, job_id, title, company, location) VALUES (?, ?, ?, ?, ?)',
            [userId, job_id, title || '', company || '', location || '']
        );
        
        res.json({ success: true, message: 'Job saved successfully' });
    } catch (err) {
        console.error('Save job error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= UNSAVE A JOB =============
router.delete('/:jobId', async (req, res) => {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const jobId = req.params.jobId;
    
    try {
        await promisePool.query(
            'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, jobId]
        );
        
        res.json({ success: true, message: 'Job removed from saved' });
    } catch (err) {
        console.error('Remove saved job error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET ALL SAVED JOBS FOR CURRENT USER =============
router.get('/', async (req, res) => {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const [jobs] = await promisePool.query(`
            SELECT sj.*, j.salary_min, j.salary_max, j.job_type
            FROM saved_jobs sj
            LEFT JOIN jobs j ON sj.job_id = j.id
            WHERE sj.user_id = ?
            ORDER BY sj.saved_at DESC
        `, [userId]);
        
        res.json(jobs);
    } catch (err) {
        console.error('Get saved jobs error:', err);
        res.status(500).json({ error: err.message });
    }
});

/// ============= GET SAVED JOBS FOR A SPECIFIC USER =============
router.get('/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // በዳታቤዝህ ውስጥ saved_jobs እና jobs የሚባሉ table-ዎች ካሉህ join አድርጋቸው
        // ካልሆነ ግን saved_jobs table ውስጥ ያሉትን ብቻ አምጣ
        const [jobs] = await promisePool.query(`
            SELECT * FROM saved_jobs 
            WHERE user_id = ?
            ORDER BY saved_at DESC
        `, [userId]);
        
        // ውጤቱ ባዶ ከሆነ [] ይመልሳል፣ ይህ ሪአክት እንዳይሰበር ይረዳል
        res.json(jobs); 
    } catch (err) {
        console.error('Get saved jobs error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============= DELETE SAVED JOB (using body) - backward compatibility =============
router.delete('/', async (req, res) => {
    let userId = getUserIdFromToken(req);
    if (!userId && req.body.userId) {
        userId = req.body.userId;
    }
    
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { jobId } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }
    
    try {
        await promisePool.query(
            'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, jobId]
        );
        
        res.json({ success: true, message: 'Job removed from saved' });
    } catch (err) {
        console.error('Remove saved job error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;