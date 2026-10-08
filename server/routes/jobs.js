const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const { createNotification, createGlobalNotification } = require('./notifications');

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

// ============= 1. GET ALL JOBS & SEARCH =============
router.get('/', async (req, res) => {
    const { search } = req.query;
    try {
        let query = `
            SELECT j.*, IFNULL(ROUND(AVG(r.rating), 1), 0) as rating 
            FROM jobs j
            LEFT JOIN job_ratings r ON j.id = r.job_id
            WHERE 1=1
        `;
        let params = [];
        if (search) {
            query += ' AND (j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }
        query += ' GROUP BY j.id ORDER BY j.created_at DESC';
        const [jobs] = await promisePool.query(query, params);
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 2. ADVANCED SEARCH =============
router.get('/search', async (req, res) => {
    const { title, location, type, minSalary, maxSalary } = req.query;
    let query = `
        SELECT j.*, IFNULL(ROUND(AVG(r.rating), 1), 0) as rating 
        FROM jobs j
        LEFT JOIN job_ratings r ON j.id = r.job_id
        WHERE 1=1
    `;
    let params = [];
    if (title) { query += ' AND j.title LIKE ?'; params.push(`%${title}%`); }
    if (location) { query += ' AND j.location LIKE ?'; params.push(`%${location}%`); }
    if (type) { query += ' AND j.type = ?'; params.push(type); }
    if (minSalary) {
        query += ' AND CAST(REPLACE(REPLACE(SUBSTRING_INDEX(j.salary, "-", 1), "$", ""), ",", "") AS UNSIGNED) >= ?';
        params.push(parseInt(minSalary));
    }
    if (maxSalary) {
        query += ' AND CAST(REPLACE(REPLACE(SUBSTRING_INDEX(j.salary, "-", -1), "$", ""), ",", "") AS UNSIGNED) <= ?';
        params.push(parseInt(maxSalary));
    }
    query += ' GROUP BY j.id ORDER BY j.created_at DESC';
    try {
        const [jobs] = await promisePool.query(query, params);
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 3. GET SINGLE JOB =============
router.get('/:id', async (req, res) => {
    try {
        const query = `
            SELECT j.*, IFNULL(ROUND(AVG(r.rating), 1), 0) as rating 
            FROM jobs j
            LEFT JOIN job_ratings r ON j.id = r.job_id
            WHERE j.id = ?
            GROUP BY j.id
        `;
        const [jobs] = await promisePool.query(query, [req.params.id]);
        if (jobs.length === 0) return res.status(404).json({ message: 'Job not found' });
        res.json(jobs[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 4. CREATE JOB (አሁን employer_id ተካቷል!) =============
router.post('/', async (req, res) => {
    // 🌟 እዚህ ጋር employer_id መጨመሩን አስተውል
    const { title, company, location, description, salary, type, employer_id } = req.body;

    // አሰሪው መታወቅ ስላለበት employer_id ግዴታ ነው
    if (!title || !company || !employer_id) {
        return res.status(400).json({ message: 'Title, company, and employer_id are required' });
    }

    try {
        // 1. ስራውን መመዝገብ (employer_id አብሮ ይገባል)
        const [result] = await promisePool.query(
            'INSERT INTO jobs (title, company, location, description, salary, type, employer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, company, location || null, description || null, salary || null, type || 'Full-time', employer_id]
        );

        // 2. 🌟 ፕሮፌሽናል ማሳወቂያ
        try {
            await createGlobalNotification(
                'new_job',
                'New Job Posted! 🚀',
                `${title} at ${company} has been posted. Check it out!`
            );
        } catch (notifErr) {
            console.error('❌ Global Notification error:', notifErr.message);
        }

        res.status(201).json({ id: result.insertId, message: 'Job created and global notification sent' });
    } catch (err) {
        console.error('Create job error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= 5. UPDATE JOB =============
router.put('/:id', async (req, res) => {
    const { title, company, location, description, salary, type } = req.body;
    try {
        const [result] = await promisePool.query(
            'UPDATE jobs SET title = ?, company = ?, location = ?, description = ?, salary = ?, type = ? WHERE id = ?',
            [title, company, location, description, salary, type, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Job not found' });
        res.json({ message: 'Job updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 6. DELETE JOB =============
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await promisePool.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Job not found' });
        res.json({ message: 'Job deleted successfully' });
    } catch (err) {
        if (err.errno === 1451) {
            return res.status(400).json({ error: "Cannot delete: This job has applications or views associated with it." });
        }
        res.status(500).json({ error: err.message });
    }
});

// ============= 7. DELETE SAVED JOB =============
router.delete('/saved/remove/:userId/:jobId', async (req, res) => {
    const { userId, jobId } = req.params;
    try {
        const [result] = await promisePool.query(
            'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, jobId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Saved job not found' });
        res.json({ success: true, message: 'Job removed from saved list' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;