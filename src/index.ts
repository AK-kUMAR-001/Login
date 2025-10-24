

import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import path from 'path';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
console.log('DATABASE_URL:', process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
});

    await pool.query('SELECT 1;');
    console.log('Database connected successfully.');

app.use(express.json());
app.use(express.static('frontend'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const trimmedEmail = email.trim();

    try {
        const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [trimmedEmail]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).send('Invalid credentials');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).send('Invalid credentials');
        }

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error');
    }
});

app.post('/signup-temp', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Attempting to sign up user: ${email}`);
        if (!email || !password) {
            console.log('Signup failed: Email and password are required.');
            return res.status(400).send('Email and password are required.');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id', [email, hashedPassword]);
        console.log(`User ${email} signed up successfully. User ID: ${result.rows[0].id}`);
        res.status(201).send(`User ${email} signed up successfully.`);
    } catch (error) {
        console.error('Error signing up user:', error);
        res.status(500).send('Error signing up user.');
    }
});

// Temporary route to view all users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM users');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});

// Send Reset Code route
app.post('/send-reset-code', async (req, res) => {
    const { email } = req.body;
    const trimmedEmail = email.trim();

    try {
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
        const user = userResult.rows[0];

        if (user) {
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
            const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

            await pool.query(
                'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
                [resetCode, expiryTime, user.id]
            );

            // Send email with Nodemailer
            const transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: trimmedEmail,
                subject: 'Password Reset Code',
                text: `Your password reset code is: ${resetCode}. This code will expire in 10 minutes.`,
            };

            await transporter.sendMail(mailOptions);
            console.log(`Password reset code sent to ${trimmedEmail}`);
        }

        // Always send a generic success message to prevent email enumeration
        res.status(200).send('If an account exists, a code has been sent.');

    } catch (error) {
        console.error('Error sending reset code:', error);
        res.status(500).send('Error sending reset code.');
    }
});

// Reset Password with Code route
app.post('/reset-password-with-code', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;
    const trimmedEmail = email.trim();

    try {
        const userResult = await pool.query(
            'SELECT id, password_reset_token, password_reset_expires FROM users WHERE email = $1',
            [trimmedEmail]
        );
        const user = userResult.rows[0];

        if (!user || user.password_reset_token !== resetCode || new Date() > new Date(user.password_reset_expires)) {
            return res.status(400).send('Invalid or expired reset code.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.status(200).send('Password has been reset successfully.');

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).send('Error resetting password.');
    }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});