const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});
const promisePool = pool.promise();

module.exports = (passport) => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length > 0) {
            return done(null, users[0]);
        }
        
        const [result] = await promisePool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, 'google_oauth', 'user']
        );
        
        const [newUser] = await promisePool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return done(null, newUser[0]);
    }));
};