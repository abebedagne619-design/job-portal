const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const { createNotification } = require('./notifications');

// MySQL Pool Configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jobportal',
    port: 3307,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectionLimit: 10
});
const promisePool = pool.promise();

// ============= 1. SCHEDULE AN INTERVIEW (Employer) =============
router.post('/schedule', async (req, res) => {
    // ከ React የሚመጡትን Variable ስሞች እዚህ ጋር እንቀበል
    const { jobId, applicantId, employerId, application_id, scheduledDate, meetingLink, notes } = req.body;
    
    console.log("📥 ከፍሮንትኤንድ የመጣ ዳታ:", req.body); 

    // የግድ የሚያስፈልጉ ዳታዎች መኖራቸውን ማረጋገጥ
    if (!jobId || !applicantId || !employerId || !scheduledDate) {
        return res.status(400).json({ message: 'Job, Applicant, Employer, and Date are required' });
    }

    try {
        // ወደ ዳታቤዝ ማስገባት - scheduled_date እና applicant_id በትክክል ጥቅም ላይ ውለዋል
        const [result] = await promisePool.query(
            `INSERT INTO interviews 
            (job_id, applicant_id, employer_id, application_id, scheduled_date, meeting_link, notes, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                jobId, 
                applicantId, 
                employerId, 
                application_id || null, 
                scheduledDate, 
                meetingLink || null, 
                notes || null, 
                'pending'
            ]
        );

        // ለተቀጣሪው ኖቲፊኬሽን የመላክ ክፍል
        try {
            const [jobs] = await promisePool.query('SELECT title FROM jobs WHERE id = ?', [jobId]);
            const jobTitle = jobs[0]?.title || 'Position';
            const formattedDate = new Date(scheduledDate).toLocaleString('en-GB');

            await createNotification(
                applicantId,
                'interview',
                'Interview Scheduled! 📅',
                `You have an interview for ${jobTitle} on ${formattedDate}. Please Accept or Decline.`
            );
        } catch (notifErr) {
            console.error('⚠️ Notification error (Interview was saved):', notifErr.message);
        }

        res.json({ id: result.insertId, message: 'Interview scheduled and notification sent!' });

    } catch (err) {
        console.error("❌ Database Insert Error:", err); 
        res.status(500).json({ 
            error: "ዳታውን መመዝገብ አልተቻለም", 
            details: err.message 
        });
    }
});

// ============= 2. GET INTERVIEWS FOR APPLICANT =============
router.get('/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Queryውን በትክክለኛ የኮለም ስሞች (scheduled_date, applicant_id) አስተካክለነዋል
        const [rows] = await promisePool.query(`
            SELECT 
                i.id, 
                i.scheduled_date, 
                i.interview_time, 
                i.location, 
                i.notes, 
                i.status, 
                j.title AS job_title, 
                u.name AS employer_name 
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            JOIN users u ON i.employer_id = u.id
            WHERE i.applicant_id = ? 
            ORDER BY i.scheduled_date ASC
        `, [userId]);

        res.json(rows);
    } catch (err) {
        console.error('Interview Error:', err.message);
        res.status(500).json({ error: "Database query failed", details: err.message });
    }
});

// ============= 3. GET INTERVIEWS FOR EMPLOYER =============
router.get('/employer/:employerId', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT 
                i.*, 
                j.title AS job_title, 
                u.name AS applicant_name 
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            JOIN users u ON i.applicant_id = u.id
            WHERE i.employer_id = ?
        `, [req.params.employerId]);
        
        res.json(rows);
    } catch (err) {
        console.error("ኢንተርቪው ሲፈለግ ስህተት ተፈጠረ:", err.message);
        res.status(500).json({ error: "ዳታቤዙን ማንበብ አልተቻለም" });
    }
});

// ============= 4. ACCEPT INTERVIEW (Applicant updates, Employer notified) =============
router.put('/accept/:id', async (req, res) => {
    try {
        const [interviewData] = await promisePool.query(`
            SELECT i.employer_id, j.title, u.name as applicant_name 
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            JOIN users u ON i.applicant_id = u.id
            WHERE i.id = ?
        `, [req.params.id]);

        if (interviewData.length === 0) return res.status(404).json({ message: 'Interview not found' });

        const { employer_id, title, applicant_name } = interviewData[0];

        await promisePool.query('UPDATE interviews SET status = "accepted" WHERE id = ?', [req.params.id]);

        await createNotification(
            employer_id,
            'interview_update',
            'Interview Accepted! ✅',
            `${applicant_name} has accepted the interview invitation for ${title}.`
        );

        res.json({ success: true, message: 'Interview accepted and employer notified!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 5. DECLINE INTERVIEW (Applicant updates, Employer notified) =============
router.put('/decline/:id', async (req, res) => {
    try {
        const [interviewData] = await promisePool.query(`
            SELECT i.employer_id, j.title, u.name as applicant_name 
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            JOIN users u ON i.applicant_id = u.id
            WHERE i.id = ?
        `, [req.params.id]);

        if (interviewData.length === 0) return res.status(404).json({ message: 'Interview not found' });

        const { employer_id, title, applicant_name } = interviewData[0];

        await promisePool.query('UPDATE interviews SET status = "cancelled" WHERE id = ?', [req.params.id]);

        await createNotification(
            employer_id,
            'interview_update',
            'Interview Declined ❌',
            `${applicant_name} has declined the interview for ${title}.`
        );

        res.json({ success: true, message: 'Interview declined and employer notified.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 6. UPDATE INTERVIEW (General Update) =============
router.put('/:id', async (req, res) => {
    const { scheduled_date, meeting_link, status } = req.body;
    try {
        await promisePool.query(
            'UPDATE interviews SET scheduled_date = ?, meeting_link = ?, status = ? WHERE id = ?',
            [scheduled_date, meeting_link, status, req.params.id]
        );
        res.json({ message: 'Interview updated successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= 7. DELETE INTERVIEW =============
router.delete('/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM interviews WHERE id = ?', [req.params.id]);
        res.json({ message: 'Interview deleted successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;