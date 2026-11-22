require("dotenv").config();

const express = require("express");
const compression = require("compression");
const cors = require("cors");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");
const http = require("http");
const socketIo = require("socket.io");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const messageRoutes = require("./routes/messages");
const notificationsModule = require("./routes/notifications");
const { sendNotification, isWebPushConfigured } = require("./utils/webpush");
const axios = require("axios");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ============= 1. ERROR HANDLING =============

process.on("uncaughtException", (err) => {
  console.error("❌ There was an uncaught error:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// ============= 2. MIDDLEWARES =============

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Session & Passport

app.use(
  session({
    secret: process.env.SESSION_SECRET || "jobportal_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Existing message routes

app.use("/api/messages", messageRoutes);

// Notifications router

app.use("/api/notifications", notificationsModule.router);

// ============= CACHE SYSTEM =============

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

function getCache(key) {
  const item = cache.get(key);

  if (!item) return null;

  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

function setCache(key, data) {
  cache.set(key, {
    data: data,
    expiry: Date.now() + CACHE_DURATION,
  });
}

function clearCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ============= DATABASE CONNECTION =============

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "jobportal",
  port: Number(process.env.DB_PORT || 3307),

  // Enable TLS only for the cloud database
  ssl:
    process.env.DB_HOST &&
    process.env.DB_HOST !== "127.0.0.1" &&
    process.env.DB_HOST !== "localhost"
      ? { minVersion: "TLSv1.2" }
      : undefined,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

const promisePool = pool.promise();

// ============= DATABASE CONNECTION CHECK =============

const checkConnection = async () => {
  try {
    await promisePool.query("SELECT 1");

    console.log("✅ MySQL connected successfully on port 3307");
  } catch (err) {
    console.error("❌ MySQL connection error:", err.message);

    console.log("🔄 Retrying database connection in 5 seconds...");

    setTimeout(checkConnection, 5000);
  }
};

checkConnection();

// ============= HELPER FUNCTIONS =============

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || "jobportal_secret_key_2024",
    {
      expiresIn: "30d",
    },
  );
};

// ============= AUTHENTICATION HELPER =============

function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Unauthorized");
  }

  return jwt.verify(
    token,
    process.env.JWT_SECRET || "jobportal_secret_key_2024",
  );
}

// Get authenticated user

async function getAuthenticatedUser(req) {
  const decoded = verifyAuthToken(req);

  const [users] = await promisePool.query(
    "SELECT id, name, email, role FROM users WHERE id = ?",
    [decoded.id],
  );

  if (users.length === 0) {
    throw new Error("User not found");
  }

  return users[0];
}

// Check admin

async function requireAdmin(req) {
  const user = await getAuthenticatedUser(req);

  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}

// ============= WEB PUSH NOTIFICATION SYSTEM =============

async function sendPushToSubscriptions(subscriptions, payload) {
  if (!isWebPushConfigured()) {
    console.warn("⚠️ Web Push is not configured. Check VAPID keys.");
    return;
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await sendNotification(pushSubscription, payload);

        console.log(
          `✅ Push notification sent to subscription ${subscription.id}`,
        );
      } catch (error) {
        console.error(
          "❌ Push notification failed:",
          error.statusCode || error.message,
        );

        if (error.statusCode === 404 || error.statusCode === 410) {
          try {
            await promisePool.query(
              "DELETE FROM push_subscriptions WHERE id = ?",
              [subscription.id],
            );

            console.log(`🗑️ Removed expired subscription ${subscription.id}`);
          } catch (deleteError) {
            console.error(
              "Failed to remove expired subscription:",
              deleteError.message,
            );
          }
        }
      }
    }),
  );

  return results;
}

async function sendPushToAll(payload) {
  try {
    const [subscriptions] = await promisePool.query(
      "SELECT * FROM push_subscriptions",
    );

    if (subscriptions.length === 0) {
      console.log("ℹ️ No push subscriptions found.");
      return;
    }

    console.log(
      `📢 Sending push notification to ${subscriptions.length} subscriptions`,
    );

    await sendPushToSubscriptions(subscriptions, payload);
  } catch (error) {
    console.error("❌ Send push to all error:", error.message);
  }
}

async function sendPushToUser(userId, payload) {
  try {
    const [subscriptions] = await promisePool.query(
      "SELECT * FROM push_subscriptions WHERE user_id = ?",
      [userId],
    );

    if (subscriptions.length === 0) {
      console.log(`ℹ️ No push subscription found for user ${userId}`);
      return;
    }

    await sendPushToSubscriptions(subscriptions, payload);
  } catch (error) {
    console.error("❌ Send push to user error:", error.message);
  }
}

// ============= PUSH SUBSCRIPTION API =============

app.post("/api/notifications/subscribe", async (req, res) => {
  try {
    const decoded = verifyAuthToken(req);
    const userId = decoded.id;

    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription",
      });
    }

    const { endpoint, keys } = subscription;

    if (!keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        message: "Push subscription keys are missing",
      });
    }

    await promisePool.query(
      `
            INSERT INTO push_subscriptions
            (user_id, endpoint, p256dh, auth)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                p256dh = VALUES(p256dh),
                auth = VALUES(auth),
                updated_at = CURRENT_TIMESTAMP
            `,
      [userId, endpoint, keys.p256dh, keys.auth],
    );

    console.log(`✅ Push subscription saved for user ${userId}`);

    res.status(201).json({
      success: true,
      message: "Push notification subscription saved successfully",
    });
  } catch (error) {
    console.error("❌ Push subscription error:", error.message);

    const status = error.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
});

app.delete("/api/notifications/unsubscribe", async (req, res) => {
  try {
    const decoded = verifyAuthToken(req);
    const userId = decoded.id;

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Subscription endpoint is required",
      });
    }

    await promisePool.query(
      `
            DELETE FROM push_subscriptions
            WHERE user_id = ? AND endpoint = ?
            `,
      [userId, endpoint],
    );

    res.json({
      success: true,
      message: "Push notification subscription removed",
    });
  } catch (error) {
    console.error("❌ Unsubscribe error:", error.message);

    const status = error.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/notifications/push-status", (req, res) => {
  res.json({
    success: true,
    configured: isWebPushConfigured(),
  });
});

// ============= RECOMMENDATIONS API =============

app.post("/api/recommendations/skills", async (req, res) => {
  try {
    const { user_id, skills } = req.body;

    console.log(`📡 Processing recommendations for User: ${user_id}`);

    const response = await axios.post("http://localhost:5001/recommend", {
      userId: user_id,
      skills: skills,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ ML Service Error:", error.message);

    res.status(500).json({
      error: "የማሽን ለርኒንግ አገልግሎቱ (Python) ምላሽ አልሰጠም",
      details: error.message,
    });
  }
});

// ============= GET RECOMMENDATIONS BY SKILLS =============

app.get("/api/recommendations/skills/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const cacheKey = `rec_${userId}`;

    const cached = getCache(cacheKey);

    if (cached) {
      console.log(`⚡ Cache HIT for user ${userId}`);

      return res.json(cached);
    }

    console.log(`🔄 Cache MISS for user ${userId} - fetching from ML`);

    let skills = [];

    try {
      const [skillRows] = await promisePool.query(
        "SELECT DISTINCT skill FROM user_skills WHERE user_id = ?",
        [userId],
      );

      skills = skillRows.map((row) => row.skill);
    } catch (skillErr) {
      console.log("⚠️ user_skills table not found, using empty skills");
    }

    console.log(`📡 GET Recommendations - User: ${userId}, Skills:`, skills);

    const response = await axios.post(
      "http://localhost:5001/recommend",
      {
        userId: parseInt(userId),
        skills: skills,
      },
      {
        timeout: 60000,
      },
    );

    setCache(cacheKey, response.data);

    console.log(
      `✅ Cached ${response.data.length} recommendations for user ${userId}`,
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ ML Service Error:", error.message);

    res.status(500).json({
      error: "ML service unavailable",
      details: error.message,
    });
  }
});

// ============= RECOMMENDATIONS BY CV UPLOAD =============

const upload = multer({
  storage: multer.memoryStorage(),
});

app.post("/api/recommendations/cv", upload.single("cv"), async (req, res) => {
  let parser;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No CV file uploaded",
      });
    }

    const userId = req.body.userId;

    console.log(`📄 Received CV from User: ${userId}`);

    parser = new PDFParse({
      data: req.file.buffer,
    });

    const pdfData = await parser.getText();

    const cvText = pdfData.text;

    await parser.destroy();
    parser = null;

    if (!cvText) {
      return res.status(400).json({
        error: "Could not extract text from PDF",
      });
    }

    const response = await axios.post(
      "http://localhost:5001/recommend-cv",
      {
        userId: parseInt(userId),
        cvText: cvText,
      },
      {
        timeout: 60000,
      },
    );

    res.json(response.data);
  } catch (error) {
    if (parser) {
      try {
        await parser.destroy();
      } catch (e) {
        console.error("PDF parser cleanup error:", e.message);
      }
    }

    console.error("❌ CV Processing Error:", error.message);

    res.status(500).json({
      error: "Failed to process CV",
      details: error.message,
    });
  }
});

// ============= CLEAR RECOMMENDATIONS CACHE =============

app.post("/api/recommendations/clear-cache/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    clearCache(`rec_${userId}`);

    console.log(`🗑️ Cache cleared for user ${userId}`);

    res.json({
      success: true,
      message: `Cache cleared for user ${userId}`,
    });
  } catch (err) {
    console.error("Clear cache error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============= AUTH ROUTES =============

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, location } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const [existing] = await promisePool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Public registration must not allow a visitor to create an admin account.

    const allowedRole = role === "employer" ? "employer" : "applicant";

    const [result] = await promisePool.query(
      `
            INSERT INTO users
            (name, email, password, role, phone, location)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
      [
        name,
        email,
        hashedPassword,
        allowedRole,
        phone || null,
        location || null,
      ],
    );

    const [users] = await promisePool.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [result.insertId],
    );

    const token = generateToken(result.insertId);

    res.status(201).json({
      success: true,
      data: {
        user: users[0],
        token,
      },
    });
  } catch (err) {
    console.error("Register error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await promisePool.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user.id);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (err) {
    console.error("Login error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "jobportal_secret_key_2024",
    );

    const [users] = await promisePool.query(
      `
            SELECT id, name, email, role, phone, location
            FROM users
            WHERE id = ?
            `,
      [decoded.id],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

// ============= JOBS API =============

app.get("/api/jobs", async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
            SELECT j.*, u.name as employer_name
            FROM jobs j
            JOIN users u ON j.employer_id = u.id
            WHERE 1=1
        `;

    let params = [];

    if (search) {
      query += `
                AND (
                    j.title LIKE ?
                    OR j.description LIKE ?
                    OR j.company LIKE ?
                )
            `;

      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY j.created_at DESC";

    const [jobs] = await promisePool.query(query, params);

    res.json(jobs);
  } catch (err) {
    console.error("Get jobs error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============= ADVANCED SEARCH =============

app.get("/api/jobs/search", async (req, res) => {
  const { title, location, type, minSalary, maxSalary } = req.query;

  let query = `
        SELECT
            j.*,
            IFNULL(ROUND(AVG(r.rating), 1), 0) as rating
        FROM jobs j
        LEFT JOIN job_ratings r ON j.id = r.job_id
        WHERE 1=1
    `;

  let params = [];

  if (title) {
    query += " AND j.title LIKE ?";
    params.push(`%${title}%`);
  }

  if (location) {
    query += " AND j.location LIKE ?";
    params.push(`%${location}%`);
  }

  if (type) {
    query += " AND j.type = ?";
    params.push(type);
  }

  if (minSalary) {
    query += `
            AND CAST(
                REPLACE(
                    REPLACE(
                        SUBSTRING_INDEX(j.salary, "-", 1),
                        "$",
                        ""
                    ),
                    ",",
                    ""
                ) AS UNSIGNED
            ) >= ?
        `;

    params.push(parseInt(minSalary));
  }

  if (maxSalary) {
    query += `
            AND CAST(
                REPLACE(
                    REPLACE(
                        SUBSTRING_INDEX(j.salary, "-", -1),
                        "$",
                        ""
                    ),
                    ",",
                    ""
                ) AS UNSIGNED
            ) <= ?
        `;

    params.push(parseInt(maxSalary));
  }

  query += " GROUP BY j.id ORDER BY j.created_at DESC";

  try {
    const [jobs] = await promisePool.query(query, params);

    res.json(jobs);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const query = `
            SELECT
                j.*,
                u.name as employer_name
            FROM jobs j
            JOIN users u ON j.employer_id = u.id
            WHERE j.id = ?
        `;

    const [jobs] = await promisePool.query(query, [req.params.id]);

    if (jobs.length === 0) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    res.json(jobs[0]);
  } catch (err) {
    console.error("Get job error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============= CREATE JOB + GLOBAL PUSH NOTIFICATION =============

app.post("/api/jobs", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        error: "Only employers can create jobs",
      });
    }

    const employerId = user.id;

    const {
      title,
      description,
      company,
      location,
      salary,
      type,
      requirements,
      category,
    } = req.body;

    console.log(`📢 Creating job for employer ${employerId}:`, {
      title,
      company,
    });

    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required",
      });
    }

    const [result] = await promisePool.query(
      `
            INSERT INTO jobs
            (
                title,
                description,
                company,
                location,
                salary,
                type,
                requirements,
                category,
                employer_id,
                views_count,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
            `,
      [
        title,
        description,
        company || null,
        location || null,
        salary || null,
        type || "Full-time",
        requirements || null,
        category || null,
        employerId,
      ],
    );

    const [newJob] = await promisePool.query(
      "SELECT * FROM jobs WHERE id = ?",
      [result.insertId],
    );

    console.log(`✅ Job created with ID: ${result.insertId}`);

    try {
      const notificationMessage = `${title} at ${company || "a new company"} is now available.`;

      await notificationsModule.createGlobalNotification(
        "new_job",
        "New Job Posted!",
        notificationMessage,
      );

      console.log("✅ Global notification created");

      await sendPushToAll({
        title: "New Job Posted!",
        body: notificationMessage,
        url: "/",
      });
    } catch (notificationError) {
      console.error(
        "⚠️ Job created, but notification failed:",
        notificationError.message,
      );
    }

    res.status(201).json({
      success: true,
      message: "Job created successfully!",
      job: newJob[0],
    });
  } catch (err) {
    console.error("❌ Create job error:", err);

    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
          ? 403
          : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.put("/api/jobs/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    const employerId = user.id;

    const { title, description, company, location, salary, type } = req.body;

    let jobs;

    if (user.role === "admin") {
      [jobs] = await promisePool.query("SELECT id FROM jobs WHERE id = ?", [
        req.params.id,
      ]);
    } else {
      [jobs] = await promisePool.query(
        `
                SELECT id
                FROM jobs
                WHERE id = ? AND employer_id = ?
                `,
        [req.params.id, employerId],
      );
    }

    if (jobs.length === 0) {
      return res.status(403).json({
        error: "Not authorized to edit this job",
      });
    }

    await promisePool.query(
      `
            UPDATE jobs
            SET
                title = ?,
                description = ?,
                company = ?,
                location = ?,
                salary = ?,
                type = ?
            WHERE id = ?
            `,
      [title, description, company, location, salary, type, req.params.id],
    );

    res.json({
      success: true,
      message: "Job updated successfully!",
    });
  } catch (err) {
    console.error("Update job error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.delete("/api/jobs/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    let jobs;

    if (user.role === "admin") {
      [jobs] = await promisePool.query("SELECT id FROM jobs WHERE id = ?", [
        req.params.id,
      ]);
    } else {
      [jobs] = await promisePool.query(
        `
                SELECT id
                FROM jobs
                WHERE id = ? AND employer_id = ?
                `,
        [req.params.id, user.id],
      );
    }

    if (jobs.length === 0) {
      return res.status(403).json({
        error: "Not authorized to delete this job",
      });
    }

    await promisePool.query("DELETE FROM jobs WHERE id = ?", [req.params.id]);

    res.json({
      success: true,
      message: "Job deleted successfully!",
    });
  } catch (err) {
    console.error("Delete job error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= FAKE JOB DETECTION =============

app.post("/api/jobs/check-fake", async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!description) {
      return res.status(400).json({
        error: "Description is required",
      });
    }

    const response = await axios.post("http://localhost:5001/detect-fake", {
      title: title || "",
      description: description,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Fake Detection Error:", error.message);

    res.status(500).json({
      error: "Failed to check job authenticity",
      details: error.message,
    });
  }
});

// ============= USERS API =============

// Authenticated users can view the safe user list
// for the JobPortal messaging feature.

app.get("/api/users", async (req, res) => {
  try {
    const currentUser = await getAuthenticatedUser(req);

    const [users] = await promisePool.query(
      `
            SELECT id, name, email, role
            FROM users
            WHERE id != ?
            ORDER BY name ASC
            `,
      [currentUser.id],
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Get users error:", err.message);

    const status =
      err.message === "Unauthorized" || err.message === "User not found"
        ? 401
        : 500;

    res.status(status).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const [users] = await promisePool.query(
      `
            SELECT id, name, email, role
            FROM users
            WHERE id = ?
            `,
      [req.params.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (err) {
    console.error("Get user error:", err.message);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/api/users/:userId/skills", async (req, res) => {
  try {
    // 1. Check logged-in user
    const currentUser = await getAuthenticatedUser(req);

    // 2. Get requested user ID
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // 3. Allow users to see their own skills.
    // Other users' skills can be viewed by employers/admins.
    if (
      Number(currentUser.id) !== userId &&
      !["employer", "admin"].includes(currentUser.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view these skills",
      });
    }

    console.log(`📚 Fetching skills for user: ${userId}`);

    // 4. Fetch skills from database
    const [rows] = await promisePool.query(
      `SELECT skill
             FROM user_skills
             WHERE user_id = ?`,
      [userId],
    );

    const skills = rows.map((row) => row.skill);

    console.log(`✅ Found ${skills.length} skills for user ${userId}`);

    return res.json(skills);
  } catch (err) {
    console.error("❌ Get skills error:", err);

    const status =
      err.message === "Unauthorized" || err.message === "User not found"
        ? 401
        : 500;

    return res.status(status).json({
      success: false,
      error: err.message,
    });
  }
});

// ============= INTERVIEWS API =============

// APPLICANT: GET OWN INTERVIEWS
// ADMIN: GET ALL INTERVIEWS
app.get("/api/interviews/user/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    const isAdmin = user.role === "admin";
    const isApplicant = user.role === "user" || user.role === "applicant";

    // Only applicants and admins can access this route
    if (!isAdmin && !isApplicant) {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    // Applicants can only access their own interviews
    if (!isAdmin && Number(user.id) !== Number(req.params.id)) {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    const query = `
            SELECT
                i.id,
                i.job_id,
                i.applicant_id,
                i.employer_id,
                i.scheduled_date,
                i.interview_time,
                i.meeting_link,
                i.location,
                i.notes,
                i.status,

                j.title AS job_title,
                j.company,

                employer.name AS employer_name,

                applicant.name AS applicant_name,
                applicant.email AS applicant_email

            FROM interviews i

            JOIN jobs j
                ON i.job_id = j.id

            LEFT JOIN users employer
                ON i.employer_id = employer.id

            LEFT JOIN users applicant
                ON i.applicant_id = applicant.id

            ${isAdmin ? "" : "WHERE i.applicant_id = ?"}

            ORDER BY
                i.scheduled_date ASC,
                i.interview_time ASC
        `;

    const [rows] = await promisePool.query(query, isAdmin ? [] : [user.id]);

    res.json(rows);
  } catch (err) {
    console.error("Applicant interviews error:", err);

    res.status(err.message === "Unauthorized" ? 401 : 500).json({
      error: err.message,
    });
  }
});

// 2. EMPLOYER: GET OWN INTERVIEWS
app.get("/api/interviews/employer/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (user.role !== "admin" && Number(user.id) !== Number(req.params.id)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const [rows] = await promisePool.query(
      `
            SELECT
                i.id,
                i.job_id,
                i.applicant_id,
                i.employer_id,
                i.scheduled_date,
                i.interview_time,
                i.meeting_link,
                i.location,
                i.notes,
                i.status,
                j.title AS job_title,
                j.company,
                u.name AS applicant_name,
                u.email AS applicant_email
            FROM interviews i
            JOIN jobs j ON i.job_id = j.id
            LEFT JOIN users u ON i.applicant_id = u.id
            WHERE i.employer_id = ?
            ORDER BY i.scheduled_date ASC, i.interview_time ASC
        `,
      [req.params.id],
    );

    res.json(rows);
  } catch (err) {
    console.error("Employer interviews error:", err);
    res
      .status(err.message === "Unauthorized" ? 401 : 500)
      .json({ error: err.message });
  }
});

// 3. EMPLOYER: SCHEDULE INTERVIEW
app.post("/api/interviews/schedule", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Only employers can schedule interviews
    if (user.role !== "employer") {
      return res.status(403).json({
        success: false,
        error: "Only employers can schedule interviews",
      });
    }

    const { jobId, applicantId, scheduledDate, meetingLink, location, notes } =
      req.body;

    // Required fields
    if (!jobId || !applicantId || !scheduledDate) {
      return res.status(400).json({
        success: false,
        error: "Job, applicant and interview date/time are required",
      });
    }

    // Validate date and time format
    const match = String(scheduledDate).match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/,
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        error: "Invalid date/time format",
      });
    }

    const date = match[1];
    const time = `${match[2]}:${match[3] || "00"}`;

    // Validate calendar date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second] = time.split(":").map(Number);

    const dateCheck = new Date(Date.UTC(year, month - 1, day));

    if (
      dateCheck.getUTCFullYear() !== year ||
      dateCheck.getUTCMonth() !== month - 1 ||
      dateCheck.getUTCDate() !== day ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid interview date/time",
      });
    }

    // Validate interview type
    const cleanMeetingLink = String(meetingLink || "").trim();
    const cleanLocation = String(location || "").trim();

    if (cleanMeetingLink && cleanLocation) {
      return res.status(400).json({
        success: false,
        error: "Provide either a meeting link or an office location, not both",
      });
    }

    if (!cleanMeetingLink && !cleanLocation) {
      return res.status(400).json({
        success: false,
        error: "Meeting link or office location is required",
      });
    }

    // Validate online meeting URL
    if (cleanMeetingLink) {
      let validMeetingLink = false;

      try {
        const url = new URL(cleanMeetingLink);

        const host = url.hostname.toLowerCase();

        validMeetingLink =
          (url.protocol === "https:" || url.protocol === "http:") &&
          (host === "meet.google.com" ||
            host === "zoom.us" ||
            host.endsWith(".zoom.us") ||
            host === "teams.microsoft.com" ||
            host.endsWith(".teams.microsoft.com") ||
            host === "whereby.com" ||
            host.endsWith(".whereby.com"));
      } catch {
        validMeetingLink = false;
      }

      if (!validMeetingLink) {
        return res.status(400).json({
          success: false,
          error:
            "Please provide a valid Google Meet, Zoom, Teams or Whereby meeting link",
        });
      }
    }

    // Confirm that this job belongs to the logged-in employer
    const [jobs] = await promisePool.query(
      "SELECT id FROM jobs WHERE id = ? AND employer_id = ?",
      [jobId, user.id],
    );

    if (jobs.length === 0) {
      return res.status(403).json({
        success: false,
        error: "You cannot schedule an interview for this job",
      });
    }

    // Confirm that applicant applied for this job
    const [applications] = await promisePool.query(
      `SELECT id FROM applications
             WHERE job_id = ? AND user_id = ?`,
      [jobId, applicantId],
    );

    if (applications.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid application found for this applicant and job",
      });
    }

    // Save interview in database
    const [result] = await promisePool.query(
      `INSERT INTO interviews
                (
                    job_id,
                    applicant_id,
                    employer_id,
                    scheduled_date,
                    interview_time,
                    meeting_link,
                    location,
                    notes,
                    status
                )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        jobId,
        applicantId,
        user.id,
        date,
        time,
        cleanMeetingLink || null,
        cleanLocation || null,
        notes ? String(notes).trim() : null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Interview scheduled successfully",
      interviewId: result.insertId,
    });
  } catch (err) {
    console.error("Schedule interview error:", err);

    return res.status(err.message === "Unauthorized" ? 401 : 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 4. ADMIN / EMPLOYER: ACCEPT INTERVIEW
app.put("/api/interviews/accept/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Only Admin or Employer can accept
    if (user.role !== "admin" && user.role !== "employer") {
      return res.status(403).json({
        success: false,
        error: "Only admin or employer can accept interviews",
      });
    }

    let sql = `
            UPDATE interviews
            SET status = 'accepted'
            WHERE id = ?
              AND status = 'pending'
        `;

    const params = [req.params.id];

    // Employer can only accept their own interviews
    if (user.role === "employer") {
      sql += " AND employer_id = ?";
      params.push(user.id);
    }

    const [result] = await promisePool.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Interview not found or cannot be accepted",
      });
    }

    res.json({
      success: true,
      message: "Interview accepted successfully",
    });
  } catch (err) {
    console.error("Accept interview error:", err);
    res
      .status(err.message === "Unauthorized" ? 401 : 500)
      .json({ success: false, error: err.message });
  }
});

// 5. ADMIN / EMPLOYER: DECLINE INTERVIEW
app.put("/api/interviews/decline/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Only Admin or Employer can decline
    if (user.role !== "admin" && user.role !== "employer") {
      return res.status(403).json({
        success: false,
        error: "Only admin or employer can decline interviews",
      });
    }

    let sql = `
            UPDATE interviews
            SET status = 'declined'
            WHERE id = ?
              AND status = 'pending'
        `;

    const params = [req.params.id];

    // Employer can only decline their own interviews
    if (user.role === "employer") {
      sql += " AND employer_id = ?";
      params.push(user.id);
    }

    const [result] = await promisePool.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Interview not found or cannot be declined",
      });
    }

    res.json({
      success: true,
      message: "Interview declined successfully",
    });
  } catch (err) {
    console.error("Decline interview error:", err);
    res
      .status(err.message === "Unauthorized" ? 401 : 500)
      .json({ success: false, error: err.message });
  }
});

// ============= ANALYTICS TRACK VIEW API =============

app.post("/api/analytics/track-view", async (req, res) => {
  try {
    const { job_id } = req.body;

    if (job_id) {
      await promisePool.query(
        `
                UPDATE jobs
                SET views_count = views_count + 1
                WHERE id = ?
                `,
        [job_id],
      );
    }

    res.json({
      success: true,
    });
  } catch (err) {
    res.json({
      success: true,
    });
  }
});

// ============= SAVED JOBS API =============

app.post("/api/saved", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    const userId = user.id;

    const { job_id, title, company, location } = req.body;

    if (!job_id) {
      return res.status(400).json({
        error: "Job ID is required",
      });
    }

    const [existing] = await promisePool.query(
      `
            SELECT id
            FROM saved_jobs
            WHERE user_id = ? AND job_id = ?
            `,
      [userId, job_id],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Job already saved",
      });
    }

    await promisePool.query(
      `
            INSERT INTO saved_jobs
            (user_id, job_id, title, company, location)
            VALUES (?, ?, ?, ?, ?)
            `,
      [userId, job_id, title || "", company || "", location || ""],
    );

    res.json({
      success: true,
      message: "Job saved successfully!",
    });
  } catch (err) {
    console.error("Save error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= JOB ALERTS API =============

app.post("/api/alerts", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    const { keyword, location, type, salary_min, salary_max } = req.body;

    console.log(`📢 Creating alert for user ${userId}:`, {
      keyword,
      location,
      type,
    });

    await promisePool.query(`
            CREATE TABLE IF NOT EXISTS job_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                keyword VARCHAR(255),
                location VARCHAR(255),
                type VARCHAR(50),
                salary_min INT,
                salary_max INT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id)
            )
        `);

    const [result] = await promisePool.query(
      `
            INSERT INTO job_alerts
            (
                user_id,
                keyword,
                location,
                type,
                salary_min,
                salary_max
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
      [
        userId,
        keyword || null,
        location || null,
        type || null,
        salary_min || null,
        salary_max || null,
      ],
    );

    res.json({
      success: true,
      message: "Job alert created successfully!",
      alertId: result.insertId,
    });
  } catch (err) {
    console.error("Create alert error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    const [alerts] = await promisePool.query(
      `
            SELECT *
            FROM job_alerts
            WHERE user_id = ?
            ORDER BY created_at DESC
            `,
      [userId],
    );

    res.json(alerts);
  } catch (err) {
    console.error("Get alerts error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.delete("/api/alerts/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    await promisePool.query(
      `
            DELETE FROM job_alerts
            WHERE id = ? AND user_id = ?
            `,
      [req.params.id, userId],
    );

    res.json({
      success: true,
      message: "Alert deleted",
    });
  } catch (err) {
    console.error("Delete alert error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.put("/api/alerts/:id/toggle", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    await promisePool.query(
      `
            UPDATE job_alerts
            SET is_active = NOT is_active
            WHERE id = ? AND user_id = ?
            `,
      [req.params.id, userId],
    );

    res.json({
      success: true,
      message: "Alert toggled",
    });
  } catch (err) {
    console.error("Toggle alert error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= SAVED JOBS REMAINING ROUTES =============

app.delete("/api/saved/:jobId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    await promisePool.query(
      `
            DELETE FROM saved_jobs
            WHERE user_id = ? AND job_id = ?
            `,
      [userId, req.params.jobId],
    );

    res.json({
      success: true,
      message: "Job removed from saved",
    });
  } catch (err) {
    console.error("Unsave error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.get("/api/saved/check/:jobId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    const [rows] = await promisePool.query(
      `
            SELECT id
            FROM saved_jobs
            WHERE user_id = ? AND job_id = ?
            `,
      [userId, req.params.jobId],
    );

    res.json({
      isSaved: rows.length > 0,
    });
  } catch (err) {
    console.error("Check saved error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

app.get("/api/saved", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user.id;

    const sql = `
            SELECT
                sj.id AS saved_id,
                sj.saved_at,
                j.id,
                j.title,
                j.company,
                j.location,
                j.salary,
                j.type
            FROM saved_jobs sj
            LEFT JOIN jobs j ON sj.job_id = j.id
            WHERE sj.user_id = ?
            ORDER BY sj.saved_at DESC
        `;

    const [savedJobs] = await promisePool.query(sql, [userId]);

    res.json(savedJobs);
  } catch (err) {
    console.error("Get saved error:", err);

    const status = err.message === "Unauthorized" ? 401 : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= STATS API =============

app.get("/api/stats", async (req, res) => {
  try {
    const [jobsResult, usersResult, applicationsResult, savedResult] =
      await Promise.all([
        promisePool.query("SELECT COUNT(*) as count FROM jobs"),

        promisePool.query("SELECT COUNT(*) as count FROM users"),

        promisePool.query("SELECT COUNT(*) as count FROM applications"),

        promisePool.query("SELECT COUNT(*) as count FROM saved_jobs"),
      ]);

    res.json({
      jobs: jobsResult[0][0].count || 0,
      users: usersResult[0][0].count || 0,
      applications: applicationsResult[0][0].count || 0,
      savedJobs: savedResult[0][0].count || 0,
      averageRating: "0.0",
    });
  } catch (err) {
    console.error("Stats error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============= TEST API =============

app.get("/api/test", async (req, res) => {
  try {
    await promisePool.query("SELECT 1");

    res.json({
      message: "Backend is working!",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      message: "Backend is working!",
      db: "error",
      error: err.message,
    });
  }
});

// ============= APPLICATION CV UPLOAD CONFIGURATION =============

// CV files are stored in server/uploads/cv

const cvUploadDirectory = path.join(__dirname, "uploads", "cv");

if (!fs.existsSync(cvUploadDirectory)) {
  fs.mkdirSync(cvUploadDirectory, {
    recursive: true,
  });
}

const applicationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, cvUploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const safeFileName = `cv-${Date.now()}-${Math.round(Math.random() * 1000000000)}${extension}`;

    cb(null, safeFileName);
  },
});

const allowedCVExtensions = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

const allowedCVMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const applicationUpload = multer({
  storage: applicationStorage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const mimeType = file.mimetype;

    if (
      allowedCVExtensions.includes(extension) &&
      allowedCVMimeTypes.includes(mimeType)
    ) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Invalid CV file. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG",
      ),
    );
  },
});

// ============= SUBMIT JOB APPLICATION =============

app.post(
  "/api/applications",

  // 1. Authenticate user BEFORE CV upload
  async (req, res, next) => {
    try {
      req.applicationUser = await getAuthenticatedUser(req);
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }
  },

  // 2. Upload CV
  (req, res, next) => {
    applicationUpload.single("cv")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "CV file must not exceed 5MB"
            : err.message;

        return res.status(400).json({
          success: false,
          message,
        });
      }

      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      next();
    });
  },

  // 3. Submit application
  async (req, res) => {
    let uploadedFilePath = null;

    try {
      const user = req.applicationUser;

      if (!["applicant", "user"].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only applicants can submit job applications",
        });
      }

      if (req.file) {
        uploadedFilePath = req.file.path;
      }

      const { job_id, name, email, phone, cover_letter } = req.body;

      if (!job_id || !name || !email || !cover_letter) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }

        return res.status(400).json({
          success: false,
          message: "Job ID, name, email and cover letter are required",
        });
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }

        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      // Check whether job exists.

      const [jobs] = await promisePool.query(
        "SELECT id FROM jobs WHERE id = ?",
        [job_id],
      );

      if (jobs.length === 0) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }

        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      // Prevent duplicate applications for the same job.

      const [existingApplication] = await promisePool.query(
        `
                SELECT id
                FROM applications
                WHERE job_id = ? AND user_id = ?
                `,
        [job_id, user.id],
      );

      if (existingApplication.length > 0) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }

        return res.status(409).json({
          success: false,
          message: "You have already applied for this job",
        });
      }

      let cvPath = null;

      if (req.file) {
        cvPath = path
          .relative(__dirname, req.file.path)
          .split(path.sep)
          .join("/");
      }

      const [result] = await promisePool.query(
        `
                INSERT INTO applications
                (
                    job_id,
                    user_id,
                    name,
                    email,
                    phone,
                    cover_letter,
                    cv_path,
                    status,
                    applied_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
                `,
        [
          job_id,
          user.id,
          name.trim(),
          email.trim(),
          phone || null,
          cover_letter.trim(),
          cvPath,
        ],
      );

      console.log(`✅ Application submitted. ID: ${result.insertId}`);

      // Notify the employer if notification support is available.

      try {
        const [jobRows] = await promisePool.query(
          `
                    SELECT employer_id, title
                    FROM jobs
                    WHERE id = ?
                    `,
          [job_id],
        );

        if (jobRows.length > 0) {
          // Create real-time personal notification
          await notificationsModule.createNotification(
            jobRows[0].employer_id,
            "new_application",
            "New Job Application",
            `${name} applied for ${jobRows[0].title}`,
          );

          // Keep existing Web Push notification
          await sendPushToUser(jobRows[0].employer_id, {
            title: "New Job Application",
            body: `${name} applied for ${jobRows[0].title}`,
            url: "/employer-apps",
          });
        }
      } catch (notificationError) {
        console.error(
          "Application notification error:",
          notificationError.message,
        );
      }

      res.status(201).json({
        success: true,
        message: "Application submitted successfully!",
        data: {
          id: result.insertId,
          job_id,
          user_id: user.id,
          status: "pending",
          cv_path: cvPath,
        },
      });
    } catch (err) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (fileError) {
          console.error("CV cleanup error:", fileError.message);
        }
      }

      console.error("❌ Submit application error:", err);

      const status =
        err.message === "Unauthorized"
          ? 401
          : err.message === "User not found"
            ? 401
            : err.message === "Forbidden"
              ? 403
              : 500;

      res.status(status).json({
        success: false,
        message: err.message,
      });
    }
  },
);

// ============= ADMIN APPLICATIONS API =============

app.get("/api/applications", async (req, res) => {
  try {
    const user = await requireAdmin(req);

    const [applications] = await promisePool.query(`
            SELECT
                a.id,
                a.job_id,
                a.user_id,
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
    console.error("Error fetching applications:", err);

    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
          ? 403
          : 500;

    res.status(status).json({
      success: false,
      error: err.message,
    });
  }
});

// ============= ANALYTICS API =============

app.get("/api/analytics/jobs-by-type", async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `
            SELECT type, COUNT(*) as count
            FROM jobs
            GROUP BY type
            `,
    );

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/analytics/popular-jobs", async (req, res) => {
  try {
    const [rows] = await promisePool.query(`
            SELECT
                title,
                views_count as count
            FROM jobs
            ORDER BY views_count DESC
            LIMIT 5
        `);

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/analytics/applications-timeline", async (req, res) => {
  try {
    const [rows] = await promisePool.query(`
            SELECT
                DATE_FORMAT(applied_at, '%Y-%m-%d') as date,
                COUNT(*) as count
            FROM applications
            GROUP BY date
            ORDER BY date ASC
            LIMIT 30
        `);

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============= EMPLOYER APPLICATIONS API =============

app.get("/api/applications/employer/:employerId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only employers can access employer applications",
      });
    }

    const employerId = user.role === "admin" ? req.params.employerId : user.id;

    if (
      user.role !== "admin" &&
      Number(req.params.employerId) !== Number(user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "You cannot access another employer applications",
      });
    }

    const [applications] = await promisePool.query(
      `
            SELECT
                a.id,
                a.job_id,
                a.user_id,
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
            JOIN jobs j ON a.job_id = j.id
            WHERE j.employer_id = ?
            ORDER BY a.applied_at DESC
            `,
      [employerId],
    );

    res.json(applications);
  } catch (err) {
    console.error("Employer applications fetch error:", err);

    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
          ? 403
          : 500;

    res.status(status).json({
      success: false,
      error: err.message,
    });
  }
});

// ============= UPDATE APPLICATION STATUS =============

app.put("/api/applications/:id/status", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized",
      });
    }

    const { status } = req.body;

    console.log(
      `📝 Updating application ${req.params.id} status to: ${status}`,
    );

    if (!status) {
      return res.status(400).json({
        error: "Status is required",
      });
    }

    const validStatuses = ["pending", "reviewed", "accepted", "rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    // Verify application belongs to this employer.

    let applications;

    if (user.role === "admin") {
      [applications] = await promisePool.query(
        "SELECT id, user_id FROM applications WHERE id = ?",
        [req.params.id],
      );
    } else {
      [applications] = await promisePool.query(
        `
                SELECT a.id, a.user_id
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE a.id = ? AND j.employer_id = ?
                `,
        [req.params.id, user.id],
      );
    }

    if (applications.length === 0) {
      return res.status(404).json({
        error: "Application not found or not authorized",
      });
    }

    await promisePool.query(
      `
            UPDATE applications
            SET status = ?
            WHERE id = ?
            `,
      [status, req.params.id],
    );
    await notificationsModule.createNotification(
      applications[0].user_id,
      "application_status",
      "Application Status Updated",
      `Your application status has been updated to: ${status}`,
    );
    console.log(`✅ Application ${req.params.id} updated to: ${status}`);

    res.json({
      success: true,
      message: "Application status updated!",
      status: status,
    });
  } catch (err) {
    console.error("❌ Update application error:", err);

    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
          ? 403
          : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= DELETE APPLICATION =============

app.delete("/api/applications/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized",
      });
    }

    let applications;

    if (user.role === "admin") {
      [applications] = await promisePool.query(
        "SELECT id, cv_path FROM applications WHERE id = ?",
        [req.params.id],
      );
    } else {
      [applications] = await promisePool.query(
        `
                SELECT a.id, a.cv_path
                FROM applications a
                JOIN jobs j ON a.job_id = j.id
                WHERE a.id = ? AND j.employer_id = ?
                `,
        [req.params.id, user.id],
      );
    }

    if (applications.length === 0) {
      return res.status(404).json({
        error: "Application not found or not authorized",
      });
    }

    const application = applications[0];

    await promisePool.query(
      `
            DELETE FROM applications
            WHERE id = ?
            `,
      [req.params.id],
    );

    // Delete uploaded CV after successful database deletion.

    if (application.cv_path) {
      const normalizedPath = application.cv_path
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

      const fullPath = path.join(__dirname, normalizedPath);

      if (
        fullPath.startsWith(path.join(__dirname, "uploads", "cv")) &&
        fs.existsSync(fullPath)
      ) {
        fs.unlink(fullPath, (error) => {
          if (error) {
            console.error("CV file deletion error:", error.message);
          }
        });
      }
    }

    console.log(`✅ Application ${req.params.id} deleted`);

    res.json({
      success: true,
      message: "Application deleted successfully!",
    });
  } catch (err) {
    console.error("❌ Delete application error:", err);

    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
          ? 403
          : 500;

    res.status(status).json({
      error: err.message,
    });
  }
});

// ============= SOCKET.IO =============

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Connect Notifications Module to Socket.IO
notificationsModule.setSocketIO(io);

// Multiple connections per user.
const onlineUsers = new Map();

// ============= SOCKET.IO JWT AUTHENTICATION =============

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "jobportal_secret_key_2024",
    );

    const [users] = await promisePool.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [decoded.id],
    );

    if (users.length === 0) {
      return next(new Error("User not found"));
    }

    socket.user = users[0];

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);

    next(new Error("Invalid authentication token"));
  }
});

// ============= ONLINE USERS HELPERS =============

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

function broadcastOnlineUsers() {
  io.emit("online-users", getOnlineUserIds());
}

// ============= SOCKET CONNECTION =============

io.on("connection", (socket) => {
  const authenticatedUser = socket.user;
  const userId = String(authenticatedUser.id);

  console.log(`🟢 Socket connected: ${authenticatedUser.name} (${userId})`);

  // Automatically join authenticated user's room.
  socket.join(userId);

  // Support multiple tabs and devices.
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  // Broadcast updated online users.
  broadcastOnlineUsers();

  // Send current online users when Chat.jsx requests them.
  // This listener must exist only once.
  socket.on("get-online-users", () => {
    socket.emit("online-users", getOnlineUserIds());
  });

  // ============= SEND MESSAGE =============

  socket.on("send-message", async (data) => {
    try {
      const receiverId = Number(data?.receiverId);

      const message =
        typeof data?.message === "string" ? data.message.trim() : "";

      if (
        !Number.isInteger(receiverId) ||
        receiverId <= 0 ||
        receiverId === Number(userId)
      ) {
        return socket.emit("message-error", {
          message: "Invalid receiver",
        });
      }

      if (!message || message.length > 5000) {
        return socket.emit("message-error", {
          message: "Message must contain between 1 and 5000 characters",
        });
      }

      const [receiverUsers] = await promisePool.query(
        "SELECT id FROM users WHERE id = ?",
        [receiverId],
      );

      if (receiverUsers.length === 0) {
        return socket.emit("message-error", {
          message: "Receiver not found",
        });
      }

      // Sender is always taken from authenticated JWT.
      const senderId = Number(authenticatedUser.id);

      const [result] = await promisePool.query(
        `
                INSERT INTO messages
                (sender_id, receiver_id, message, is_read)
                VALUES (?, ?, ?, false)
                `,
        [senderId, receiverId, message],
      );

      const createdAt = new Date();

      const messagePayload = {
        id: result.insertId,

        sender_id: senderId,
        receiver_id: receiverId,

        senderId,
        receiverId,

        message,

        created_at: createdAt,
        createdAt,

        is_read: false,
        isRead: false,
      };

      // Notify receiver.
      io.to(String(receiverId)).emit("new-message", messagePayload);

      // Notify sender's other tabs/devices.
      io.to(String(senderId)).emit("new-message", messagePayload);

      // Calculate receiver unread count.
      const [unreadResult] = await promisePool.query(
        `
                SELECT COUNT(*) AS count
                FROM messages
                WHERE receiver_id = ?
                AND is_read = false
                `,
        [receiverId],
      );

      io.to(String(receiverId)).emit("unread-update", {
        userId: receiverId,
        count: Number(unreadResult[0].count),
      });

      socket.emit("message-sent", {
        success: true,
        messageId: result.insertId,
      });

      console.log(
        `📨 Message ${result.insertId}: ${senderId} -> ${receiverId}`,
      );
    } catch (error) {
      console.error("Send message error:", error);

      socket.emit("message-error", {
        message: "Failed to send message",
      });
    }
  });

  // ============= TYPING INDICATOR =============

  socket.on("typing", (data) => {
    const receiverId = Number(data?.receiverId);

    if (
      !Number.isInteger(receiverId) ||
      receiverId <= 0 ||
      receiverId === Number(userId)
    ) {
      return;
    }

    io.to(String(receiverId)).emit("user-typing", {
      userId: Number(userId),
    });
  });

  // ============= MARK MESSAGES AS READ =============

  socket.on("mark-read", async (data) => {
    try {
      const otherUserId = Number(data?.otherUserId);

      if (
        !Number.isInteger(otherUserId) ||
        otherUserId <= 0 ||
        otherUserId === Number(userId)
      ) {
        return;
      }

      const [result] = await promisePool.query(
        `
                UPDATE messages
                SET is_read = true
                WHERE sender_id = ?
                AND receiver_id = ?
                AND is_read = false
                `,
        [otherUserId, Number(userId)],
      );

      if (result.affectedRows > 0) {
        // Tell original sender that messages were read.
        io.to(String(otherUserId)).emit("read-update", {
          userId: Number(userId),
          readerId: Number(userId),
          senderId: otherUserId,
        });
      }

      // Refresh current user's unread count.
      const [unreadResult] = await promisePool.query(
        `
                SELECT COUNT(*) AS count
                FROM messages
                WHERE receiver_id = ?
                AND is_read = false
                `,
        [Number(userId)],
      );

      io.to(String(userId)).emit("unread-update", {
        userId: Number(userId),
        count: Number(unreadResult[0].count),
      });
    } catch (error) {
      console.error("Mark read error:", error);
    }
  });

  // ============= DISCONNECT =============

  socket.on("disconnect", (reason) => {
    const userSockets = onlineUsers.get(userId);

    if (userSockets) {
      userSockets.delete(socket.id);

      // User is offline only when all tabs/devices disconnect.
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);

        console.log(`🔴 User ${userId} is offline`);
      }
    }

    broadcastOnlineUsers();

    console.log(`Socket disconnected: ${userId} (${reason})`);
  });
});

// ============= OAUTH =============

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await promisePool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );

    done(null, users[0]);
  } catch (err) {
    done(err, null);
  }
});

const GoogleStrategy = require("passport-google-oauth20").Strategy;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.SERVER_URL || "http://localhost:5000"}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails[0].value;

        try {
          const [users] = await promisePool.query(
            "SELECT * FROM users WHERE email = ?",
            [email],
          );

          if (users.length > 0) {
            return done(null, users[0]);
          }

          const [result] = await promisePool.query(
            `
                        INSERT INTO users
                        (name, email, password, role)
                        VALUES (?, ?, ?, ?)
                        `,
            [profile.displayName, email, "google_oauth", "applicant"],
          );

          const [newUser] = await promisePool.query(
            "SELECT * FROM users WHERE id = ?",
            [result.insertId],
          );

          return done(null, newUser[0]);
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );

  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    }),
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/login",
    }),
    (req, res) => {
      const token = generateToken(req.user.id);

      const { password, ...userWithoutPassword } = req.user;

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

      const redirectUrl = `${clientUrl}/auth-success?token=${token}&user=${encodeURIComponent(
        JSON.stringify(userWithoutPassword),
      )}`;

      res.redirect(redirectUrl);
    },
  );

  console.log("🔑 Google OAuth: enabled");
}

// ============= GLOBAL ERROR HANDLER =============

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err.stack);

  res.status(500).json({
    error: "Something went wrong on the server!",
  });
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

  console.log(
    `🔔 Notifications API: http://localhost:${PORT}/api/notifications`,
  );

  console.log(`💬 Chat Socket.IO: ws://localhost:${PORT}`);

  console.log(`📨 Applications API: http://localhost:${PORT}/api/applications`);

  console.log(`📁 CV Upload Directory: ${cvUploadDirectory}`);
});
