const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

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

// ============= 1. ADD OR UPDATE RATING =============
router.post('/', async (req, res) => {
    // 💡 ማስተካከያ፦ ሁለቱንም የአጻጻፍ ስልቶች እንዲቀበል ተደርጓል
    const jobId = req.body.jobId || req.body.job_id;
    const userId = req.body.userId || req.body.user_id;
    const rating = req.body.rating;
    const comment = req.body.comment;

    // አስፈላጊ መረጃዎች መኖራቸውን ማረጋገጥ
    if (!jobId || !userId || !rating) {
        return res.status(400).json({ 
            message: `ስህተት ተፈጥሯል: Job ID (${jobId}), User ID (${userId}), and rating (${rating}) are required` 
        });
    }

    // የሬቲንግ መጠን ከ 1 እስከ 5 መሆኑን ማረጋገጥ
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    try {
        const [existing] = await promisePool.query(
            'SELECT * FROM job_ratings WHERE job_id = ? AND user_id = ?',
            [jobId, userId]
        );

        if (existing.length > 0) {
            await promisePool.query(
                'UPDATE job_ratings SET rating = ?, comment = ? WHERE job_id = ? AND user_id = ?',
                [rating, comment || null, jobId, userId]
            );
            res.json({ message: 'Rating updated successfully' });
        } else {
            await promisePool.query(
                'INSERT INTO job_ratings (job_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
                [jobId, userId, rating, comment || null]
            );
            res.json({ message: 'Rating saved' });
        }
    } catch (err) {
        console.error('Rating error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= 2. GET AVERAGE RATING FOR A JOB =============
router.get('/job/:jobId', async (req, res) => {
    try {
        const [result] = await promisePool.query(
            'SELECT AVG(rating) as average, COUNT(*) as count FROM job_ratings WHERE job_id = ?',
            [req.params.jobId]
        );
        
        res.json({
            average: parseFloat(result[0].average || 0).toFixed(1),
            count: result[0].count || 0
        });
    } catch (err) {
        console.error('Get rating error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= 3. GET USER'S RATING FOR A SPECIFIC JOB =============
router.get('/user/:userId/:jobId', async (req, res) => {
    try {
        const [result] = await promisePool.query(
            'SELECT rating, comment FROM job_ratings WHERE user_id = ? AND job_id = ?',
            [req.params.userId, req.params.jobId]
        );
        res.json(result[0] || { rating: null, comment: null });
    } catch (err) {
        console.error('Get user rating error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;