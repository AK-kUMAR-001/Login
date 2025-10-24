

import * as dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import path from 'path';
import sgMail from '@sendgrid/mail';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Pool } from 'pg';
import cors from 'cors';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());
app.use(express.static('frontend'));

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Login route
app.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const trimmedEmail = email.trim();

    try {
        const result = await db.query('SELECT id, email, password_hash FROM users WHERE email = $1', [trimmedEmail]);
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

app.post('/signup', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        console.log(`Attempting to sign up user: ${email}`);
        if (!email || !password) {
            console.log('Signup failed: Email and password are required.');
            return res.status(400).send('Email and password are required.');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id', [email, hashedPassword]);
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
    const result = await db.query('SELECT id, email FROM users');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});

// Send Reset Code route
app.post('/send-reset-code', async (req: Request, res: Response) => {
  const { email } = req.body;
  console.log(`Received request to send reset code for email: ${email}`); // Log the incoming email

  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

  if (user.rows.length === 0) {
    console.log(`User not found for email: ${email}`); // Log if user not found
    return res.status(404).send('User not found');
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiration

  console.log(`Generated reset code: ${resetCode}, expires at: ${expiresAt}`); // Log generated code and expiry

  try {
    await db.query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3',
      [resetCode, expiresAt, email]
    );
    console.log(`Database updated with reset token for email: ${email}`); // Log successful DB update
  } catch (dbError) {
    console.error(`Error updating database for email ${email}:`, dbError); // Log DB errors
    return res.status(500).send('Error updating database');
  }

  const msg = {
    to: email,
    from: process.env.EMAIL_USER, // Use your verified sender email from SendGrid
    subject: 'Password Reset Code',
    text: `Your reset code is: ${resetCode}`,
  };

  console.log(`Attempting to send email via SendGrid to: ${email} from: ${process.env.EMAIL_USER}`); // Log SendGrid attempt

  try {
    await sgMail.send(msg);
    console.log(`Reset code email sent successfully via SendGrid to: ${email}`); // Log successful email send
    res.status(200).send('Reset code sent');
  } catch (emailError) {
    console.error(`Error sending reset code email via SendGrid to ${email}:`, emailError); // Log email sending errors
    res.status(500).send('Error sending reset code');
  }
});

// Reset Password with Code route
app.post('/reset-password-with-code', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;
    const trimmedEmail = email.trim();

    try {
        const userResult = await db.query(
            'SELECT id, password_reset_token, password_reset_expires FROM users WHERE email = $1',
            [trimmedEmail]
        );
        const user = userResult.rows[0];

        if (!user || user.password_reset_token !== resetCode || new Date() > new Date(user.password_reset_expires)) {
            return res.status(400).send('Invalid or expired reset code.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
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
  console.log(`Server running on port ${PORT}`);
});