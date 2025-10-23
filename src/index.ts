

import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
console.log('DATABASE_URL:', process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

console.log('Attempting to create users table...');
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
  )
`).then(() => {
  console.log('Users table created or already exists.');
}).catch(err => console.error('Error creating users table:', err));

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});