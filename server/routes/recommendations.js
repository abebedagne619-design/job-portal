const express = require('express');
const router = express.Router();
const axios = require('axios');
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

// ============= ADD USER SKILLS =============
router.post('/skills', async (req, res) => {
    const { userId, skills } = req.body;
    
    try {
        // Remove existing skills
        await promisePool.query('DELETE FROM user_skills WHERE user_id = ?', [userId]);
        
        // Add new skills
        for (const skill of skills) {
            await promisePool.query(
                'INSERT INTO user_skills (user_id, skill) VALUES (?, ?)',
                [userId, skill.toLowerCase().trim()]
            );
        }
        
        res.json({ message: 'Skills added successfully' });
    } catch (err) {
        console.error('Add skills error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET USER SKILLS =============
router.get('/skills/:userId', async (req, res) => {
    try {
        const [skills] = await promisePool.query(
            'SELECT skill FROM user_skills WHERE user_id = ?',
            [req.params.userId]
        );
        res.json(skills.map(s => s.skill));
    } catch (err) {
        console.error('Get skills error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= TRACK JOB VIEW =============
router.post('/track-view', async (req, res) => {
    const { userId, jobId } = req.body;
    
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

// ============= GET AI RECOMMENDATIONS =============
router.get('/:userId', async (req, res) => {
    try {
        // Call Python ML service
        const response = await axios.post('http://localhost:5001/recommend', {
            userId: parseInt(req.params.userId)
        });
        
        res.json(response.data);
    } catch (err) {
        console.error('Get recommendations error:', err);
        
        // Fallback: return recent jobs
        const [jobs] = await promisePool.query(
            'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10'
        );
        res.json(jobs);
    }
});
// ============= SUBMIT FEEDBACK =============
router.post('/feedback', async (req, res) => {
    const { userId, jobId, feedback } = req.body;

    try {
        await promisePool.query(
            'INSERT INTO recommendation_feedback (user_id, job_id, feedback) VALUES (?, ?, ?)',
            [userId, jobId, feedback]
        );
        res.json({ message: 'Feedback recorded' });
    } catch (err) {
        console.error('Feedback error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= GET FEEDBACK STATS =============
router.get('/feedback/stats/:jobId', async (req, res) => {
    try {
        const [likes] = await promisePool.query(
            'SELECT COUNT(*) as count FROM recommendation_feedback WHERE job_id = ? AND feedback = "like"',
            [req.params.jobId]
        );
        const [views] = await promisePool.query(
            'SELECT COUNT(*) as count FROM recommendation_feedback WHERE job_id = ? AND feedback = "view"',
            [req.params.jobId]
        );
        res.json({ likes: likes[0].count, views: views[0].count });
    } catch (err) {
        console.error('Feedback stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;