require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const messageRoutes = require('./routes/messages');
const axios = require('axios'); // axios መጫኑን አረጋግጥ (npm install axios)

const app = express();
const PORT = process.env.PORT || 5000;

// ============= 1. ሰርቨሩ በስህተት እንዳይዘጋ መከላከያ =============
process.on('uncaughtException', (err) => {
    console.error('❌ There was an uncaught error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============= 2. MIDDLEWARES (ትክክለኛ ቅደም ተከተል) =============
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

// CORS - የግድ ከRoutes በፊት መሆን አለበት
app.use(cors({
    origin: "http://localhost:5173", // አንዱን ብቻ መጠቀም ከተቻለ
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session & Passport
app.use(session({
    secret: process.env.SESSION_SECRET || 'jobportal_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use('/api/messages', messageRoutes); // ይሄ መስመር በላክኸው server.js ውስጥ የለም!
// ከ React የሚመጣውን የክህሎት ጥያቄ ተቀብሎ ወደ Python (5001) ያስተላልፋል
app.post('/api/recommendations/skills', async (req, res) => {
    try {
        // ከReact የሚመጣውን ዳታ መቀበል
        const { user_id, skills } = req.body;

        console.log(`📡 Processing recommendations for User: ${user_id}`);

        // ለ Python ML ሰርቨር (Port 5001) ጥያቄ መላክ
        // ማሳሰቢያ፡ Python ላይ አድራሻው '/recommend' መሆኑን አረጋግጥ
        const response = await axios.post('http://localhost:5001/recommend', {
            userId: user_id,
            skills: skills
        });
        
        // ከፓይዘን የመጣውን ውጤት ለ React መመለስ
        res.json(response.data);

    } catch (error) {
        console.error("❌ ML Service Error:", error.message);
        res.status(500).json({ 
            error: "የማሽን ለርኒንግ አገልግሎቱ (Python) ምላሽ አልሰጠም",
            details: error.message 
        });
    }
});

// ============= DATABASE CONNECTION =============
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jobportal',
    port: 3307,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

const promisePool = pool.promise();

const checkConnection = async () => {
    try {
        await promisePool.query('SELECT 1');
        console.log('✅ MySQL connected successfully on port 3307');
    } catch (err) {
        console.error('❌ MySQL connection error:', err.message);
        console.log('🔄 Retrying database connection in 5 seconds...');
        setTimeout(checkConnection, 5000);
    }
};

checkConnection();

// ============= HELPER FUNCTIONS =============
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'jobportal_secret_key_2024', {
        expiresIn: '30d'
    });
};

// ============= AUTH ROUTES =============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, phone, location } = req.body;
        
        const [existing] = await promisePool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await promisePool.query(
            'INSERT INTO users (name, email, password, role, phone, location) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role || 'applicant', phone || null, location || null]
        );
        
        const [users] = await promisePool.query('SELECT id, name, email, role FROM users WHERE id = ?', [result.insertId]);
        const token = generateToken(result.insertId);
        
        res.status(201).json({
            success: true,
            data: { user: users[0], token }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const token = generateToken(user.id);
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            data: { user: userWithoutPassword, token }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        const [users] = await promisePool.query('SELECT id, name, email, role, phone, location FROM users WHERE id = ?', [decoded.id]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, data: users[0] });
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// ============= JOBS API (ተስተካክሎ የጸዳ) =============
app.get('/api/jobs', async (req, res) => {
    try {
        const { search } = req.query;
        
        // አላስፈላጊ ክፍት ቦታዎችን ለማስቀረት ኩዌሪውን በአንድ መስመር እንጀምረዋለን
        let query = "SELECT j.*, u.name as employer_name FROM jobs j JOIN users u ON j.employer_id = u.id WHERE 1=1";
        let params = [];
        
        if (search) {
            query += " AND (j.title LIKE ? OR j.description LIKE ? OR j.company LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += " ORDER BY j.created_at DESC";
        
        // እዚህ ጋር 'promisePool' መጠቀሙን እርግጠኛ ሁኚ
        const [jobs] = await promisePool.query(query, params);
        res.json(jobs);
    } catch (err) {
        console.error('Get jobs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single job (የጸዳ)
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const query = "SELECT j.*, u.name as employer_name, u.email as employer_email FROM jobs j JOIN users u ON j.employer_id = u.id WHERE j.id = ?";
        
        const [jobs] = await promisePool.query(query, [req.params.id]);
        
        if (jobs.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(jobs[0]);
    } catch (err) {
        console.error('Get job error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= USERS API =============
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await promisePool.query('SELECT id, name, email, role FROM users');
        res.json(users);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const [users] = await promisePool.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(users[0]);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/interviews/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const sql = `
            SELECT 
                i.id, 
                i.interview_date AS scheduled_date, -- እዚህ ጋር ስሙን ቀይረነዋል
                i.location, 
                i.notes, 
                i.status, 
                j.title AS job_title, 
                c.name AS company -- ኩባንያው ሌላ Table ካለው JOIN አድርጊ
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            LEFT JOIN users c ON j.employer_id = c.id
            WHERE i.user_id = ?
            ORDER BY i.interview_date ASC
        `;
        
        const [rows] = await promisePool.query(sql, [userId]);
        res.json(rows); // Array መላኩን ያረጋግጣል
    } catch (err) {
        console.error('Interview Error:', err);
        res.status(500).json({ error: "Database query failed", details: err.message });
    }
});


// ============= ANALYTICS API =============
app.post('/api/analytics/track-view', async (req, res) => {
    try {
        const { job_id } = req.body;
        if (job_id) {
            await promisePool.query(
                'UPDATE jobs SET views_count = views_count + 1 WHERE id = ?',
                [job_id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: true });
    }
});

// ============= SAVED JOBS API =============
app.post('/api/saved', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        const userId = decoded.id;
        const { job_id, title, company, location } = req.body;
        
        const [existing] = await promisePool.query(
            'SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, job_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Job already saved' });
        }
        
        await promisePool.query(
            'INSERT INTO saved_jobs (user_id, job_id, title, company, location) VALUES (?, ?, ?, ?, ?)',
            [userId, job_id, title || '', company || '', location || '']
        );
        
        res.json({ success: true, message: 'Job saved successfully!' });
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ይህን ኮድ በ server.js ውስጥ ጨምሪው
app.get('/api/notifications/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // ዳታቤዙ ውስጥ table-ኡ ባይኖር እንኳ እንዳይሰቀስቅ catch ውስጥ እናስገባዋለን
        const [notifications] = await promisePool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        res.json(notifications);
    } catch (err) {
        // ሰንጠረዡ ከሌለ ወይም ሌላ ስህተት ቢፈጠር ባዶ ዝርዝር [] እንመልሳለን
        console.log('Notification table not found, returning empty array');
        res.json([]); 
    }
});

app.delete('/api/saved/:jobId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        const userId = decoded.id;
        
        await promisePool.query(
            'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, req.params.jobId]
        );
        
        res.json({ success: true, message: 'Job removed from saved' });
    } catch (err) {
        console.error('Unsave error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/saved/check/:jobId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        const userId = decoded.id;
        
        const [rows] = await promisePool.query(
            'SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
            [userId, req.params.jobId]
        );
        
        res.json({ isSaved: rows.length > 0 });
    } catch (err) {
        console.error('Check saved error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/saved', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jobportal_secret_key_2024');
        const userId = decoded.id;
        
        // Query-ውን በአንድ መስመር በማድረግ የማይታዩ ስህተቶችን አስወግደናል
        const sql = "SELECT sj.id AS saved_id, sj.saved_at, j.id, j.title, j.company, j.location, j.salary, j.type FROM saved_jobs sj LEFT JOIN jobs j ON sj.job_id = j.id WHERE sj.user_id = ? ORDER BY sj.saved_at DESC";
        
        const [savedJobs] = await promisePool.query(sql, [userId]);
        res.json(savedJobs);
    } catch (err) {
        console.error('Get saved error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= STATS API =============
app.get('/api/stats', async (req, res) => {
    try {
        const [jobsResult, usersResult] = await Promise.all([
            promisePool.query('SELECT COUNT(*) as count FROM jobs'),
            promisePool.query('SELECT COUNT(*) as count FROM users')
        ]);

        res.json({
            jobs: jobsResult[0][0].count || 0,
            users: usersResult[0][0].count || 0,
            applications: 0,
            savedJobs: 0,
            averageRating: '0.0'
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= TEST API =============
app.get('/api/test', async (req, res) => {
    try {
        await promisePool.query('SELECT 1');
        res.json({ message: 'Backend is working!', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        res.json({ message: 'Backend is working!', db: 'error', error: err.message });
    }
});
// ሁሉንም የሥራ ማመልከቻዎች (Applications) ለAdmin ለማምጣት
app.get('/api/applications', async (req, res) => {
    try {
        const [applications] = await promisePool.query(`
            SELECT 
                a.id, 
                a.name AS applicant_name, 
                a.email AS applicant_email, 
                a.phone,
                a.cover_letter,
                a.cv_path,
                a.status,
                a.applied_at,
                j.title AS job_title,
                j.company
            FROM applications a
            LEFT JOIN jobs j ON a.job_id = j.id
            ORDER BY a.applied_at DESC
        `);
        res.json(applications);
    } catch (err) {
        console.error('Error fetching applications:', err);
        res.status(500).json({ error: err.message });
    }
});
// 1. Jobs by Type (የነበረውን አስተካክለነዋል)
app.get('/api/analytics/jobs-by-type', async (req, res) => {
    try {
        // እዚህ ጋር 'db' ሳይሆን 'promisePool' ነው መሆን ያለበት
        const [rows] = await promisePool.query('SELECT type, COUNT(*) as count FROM jobs GROUP BY type');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// 2. Popular Jobs (ይህ አልነበረም - አሁን ተጨምሯል)
app.get('/api/analytics/popular-jobs', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT title, views_count as count 
            FROM jobs 
            ORDER BY views_count DESC 
            LIMIT 5
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// 3. Applications Timeline (ይህ አልነበረም - አሁን ተጨምሯል)
app.get('/api/analytics/applications-timeline', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT DATE_FORMAT(applied_at, '%Y-%m-%d') as date, COUNT(*) as count 
            FROM applications 
            GROUP BY date 
            ORDER BY date ASC 
            LIMIT 30
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// አሠሪው ለእሱ የተለጠፉ ስራዎች ላይ የመጡ ማመልከቻዎችን ለማየት
app.get('/api/applications/employer/:employerId', async (req, res) => {
    try {
        const employerId = req.params.employerId;
        const [applications] = await promisePool.query(`
            SELECT 
                a.id, 
                a.status, 
                a.applied_at, 
                j.title AS job_title, 
                u.name AS applicant_name, 
                u.email AS applicant_email
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN users u ON a.user_id = u.id
            WHERE j.employer_id = ?
            ORDER BY a.applied_at DESC
        `, [employerId]);

        if (applications.length === 0) {
            return res.status(200).json([]); // ባዶ ከሆነ ባዶ array ይላካል
        }

        res.json(applications);
    } catch (err) {
        console.error('Employer applications fetch error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ============= SOCKET.IO =============
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { 
        // 127.0.0.1 መጨመር ለ Vite ተጠቃሚዎች በጣም አስፈላጊ ነው
        origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"], 
        methods: ['GET', 'POST'], 
        credentials: true 
    },
    pingTimeout: 60000, // ግንኙነቱ ቶሎ እንዳይቋረጥ ይረዳል
    pingInterval: 25000
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('🟢 New client connected:', socket.id);
    
    socket.on('user-connected', (userId) => {
        if (userId) {
            onlineUsers.set(String(userId), socket.id);
            io.emit('online-users', Array.from(onlineUsers.keys()));
            console.log(`✅ User ${userId} is online`);
        }
    });
    
    socket.on('send-message', async (data) => {
        const { senderId, receiverId, message } = data;
        try {
            const [result] = await promisePool.query(
                'INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, false)',
                [senderId, receiverId, message]
            );
            
            const receiverSocketId = onlineUsers.get(String(receiverId));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new-message', { 
                    id: result.insertId, 
                    senderId, 
                    message, 
                    createdAt: new Date() 
                });
            }
            
            const [unreadResult] = await promisePool.query(
                'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = false',
                [receiverId]
            );
            // ያልተነበቡ መልእክቶችን ለተቀባዩ ብቻ መላክ
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('unread-update', { userId: receiverId, count: unreadResult[0].count });
            }
        } catch (err) {
            console.error('Send message error:', err);
        }
    });

    // የ Typing ኮድ እዚህ ጋር አንድ ጊዜ ብቻ ይበቃል
    socket.on('typing', ({ senderId, receiverId }) => {
        const receiverSocketId = onlineUsers.get(String(receiverId));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user-typing', { userId: senderId });
        }
    });
    
    socket.on('disconnect', () => {
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                console.log(`❌ User ${userId} disconnected`);
                break;
            }
        }
        io.emit('online-users', Array.from(onlineUsers.keys()));
    });
});
// ============= OAUTH =============
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await promisePool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, users[0]);
    } catch (err) { done(err, null); }
});

const GoogleStrategy = require('passport-google-oauth20').Strategy;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails[0].value;
        try {
            const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
            if (users.length > 0) return done(null, users[0]);
            const [result] = await promisePool.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [profile.displayName, email, 'google_oauth', 'applicant']
            );
            const [newUser] = await promisePool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
            return done(null, newUser[0]);
        } catch (err) { return done(err, null); }
    }));
    
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }), 
    (req, res) => {
        // ለጎግል ተጠቃሚው JWT ቶከን እንፈጥራለን
        const token = generateToken(req.user.id);

        // ፓስወርድ ካለ ከዳታው ውስጥ እናስወጣለን
        const { password, ...userWithoutPassword } = req.user;

        // ቶከኑን እና ተጠቃሚውን በአንድ ላይ ወደ React እንልካለን
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        
        // encodeURIComponent መጠቀም ዳታው በURL ላይ እንዳይበላሽ ይረዳል
        const redirectUrl = `${clientUrl}/auth-success?token=${token}&user=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`;
        
        res.redirect(redirectUrl);
    }
);
    console.log('🔑 Google OAuth: enabled');
}

// ============= Global Error Handler =============
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Handler:', err.stack);
    res.status(500).json({ error: 'Something went wrong on the server!' });
});

// ============= START SERVER =============
server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`📋 Jobs API: http://localhost:${PORT}/api/jobs`);
    console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
    console.log(`💾 Saved API: http://localhost:${PORT}/api/saved`);
    console.log(`💬 Messages API: http://localhost:${PORT}/api/messages`);
    console.log(`📊 Analytics API: http://localhost:${PORT}/api/analytics`);
    console.log(`💬 Chat Socket.IO: ws://localhost:${PORT}`);
});