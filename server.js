const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_CODE = "Secure@Code@2025";

app.use(session({
  secret: 'prosource_secret_key_2025',
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});
db.connect((err) => {
  if (err) console.error('❌ DB connection failed:', err);
  else console.log('✅ Connected to MySQL DB.');
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ---------------------- AUTH + HOME ----------------------

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/get-session', (req, res) => {
  if (req.session.admin) res.json({ loggedIn: true, email: req.session.admin.email, role: "admin" });
  else if (req.session.user) res.json({ loggedIn: true, email: req.session.user.email, role: "user" });
  else res.json({ loggedIn: false });
});

app.post('/admin-login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM admins WHERE email = ?', [email], async (err, results) => {
    if (err) return res.send('Internal error');
    if (!results.length) return res.send('❌ Admin not found.');
    const match = await bcrypt.compare(password, results[0].password);
    if (match) {
      req.session.admin = { email };
      return res.redirect('/');
    }
    res.send('❌ Incorrect password.');
  });
});

app.get('/admin-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register-admin.html'));
});

app.post('/register-admin', async (req, res) => {
  const { email, password, accessCode } = req.body;
  if (accessCode !== ADMIN_SECRET_CODE) return res.status(403).send('❌ Invalid access code.');
  db.query('SELECT * FROM admins WHERE email = ?', [email], async (err, results) => {
    if (err) return res.send('❌ DB error, check logs.');
    if (results.length > 0) return res.send('⚠️ Admin already exists.');
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO admins (email, password) VALUES (?, ?)', [email, hash], (err) => {
      if (err) return res.send('❌ Admin creation failed.');
      res.send('<h3>✅ Admin registered! <a href="/admin-login.html">Login</a></h3>');
    });
  });
});

app.post('/user-login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.send('Internal error');
    if (!results.length) return res.send('❌ User not found.');
    const match = await bcrypt.compare(password, results[0].password);
    if (match) {
      req.session.user = { email };
      return res.redirect('/');
    }
    res.send('❌ Incorrect password.');
  });
});

app.post('/user-register', async (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.send('Try again later.');
    if (results.length > 0) return res.send('⚠️ User already exists.');
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], (err) => {
      if (err) return res.send('❌ User creation failed.');
      req.session.user = { email };
      res.redirect('/');
    });
  });
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ---------------------- PASSWORD RESET ----------------------

app.get('/user-forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'user-forgot-password.html'));
});
app.post('/user-forgot-password', (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  req.session.otp = otp;
  req.session.otpEmail = email;
  transporter.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: 'User OTP for Password Reset',
    text: `Your OTP is: ${otp}`
  }, (err) => {
    if (err) return res.send('❌ Failed to send OTP.');
    res.redirect('/reset-password.html');
  });
});
app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});
app.post('/verify-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (req.session.otp !== otp || req.session.otpEmail !== email) return res.send('❌ Invalid OTP or session expired.');
  const hash = await bcrypt.hash(newPassword, 10);
  db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email], (err) => {
    if (err) return res.send('❌ Reset failed.');
    delete req.session.otp;
    delete req.session.otpEmail;
    res.send('✅ Password reset successful! <a href="/user-login.html">Login</a>');
  });
});

app.get('/admin-forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-forgot-password.html'));
});
app.post('/admin-forgot-password', (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  req.session.adminOtp = otp;
  req.session.adminOtpEmail = email;
  transporter.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Admin OTP for Password Reset',
    text: `Your admin OTP is: ${otp}`
  }, (err) => {
    if (err) return res.send('❌ Failed to send OTP.');
    res.redirect('/admin-reset-password.html');
  });
});
app.get('/admin-reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-reset-password.html'));
});
app.post('/admin-verify-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (req.session.adminOtp !== otp || req.session.adminOtpEmail !== email) return res.send('❌ Invalid OTP or session expired.');
  const hash = await bcrypt.hash(newPassword, 10);
  db.query('UPDATE admins SET password = ? WHERE email = ?', [hash, email], (err) => {
    if (err) return res.send('❌ Reset failed.');
    delete req.session.adminOtp;
    delete req.session.adminOtpEmail;
    res.send('✅ Admin password reset! <a href="/admin-login.html">Login</a>');
  });
});

// ---------------------- ADMIN TOOLS ----------------------

// ✅ Edit Homepage
app.get('/edit-homepage.html', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied.');
  res.sendFile(path.join(__dirname, 'admin-tools/edit-homepage.html'));
});
app.post('/edit-homepage.html', (req, res) => {
  const { title, subtitle, button_text } = req.body;
  db.query('SELECT COUNT(*) as count FROM homepage_content', (err, results) => {
    if (err) return res.send('❌ Database error.');
    const count = results[0].count;
    if (count === 0) {
      db.query('INSERT INTO homepage_content (title, subtitle, button_text) VALUES (?, ?, ?)', [title, subtitle, button_text], (err) => {
        if (err) return res.send('❌ Insert failed.');
        res.redirect('/edit-homepage.html');
      });
    } else {
      db.query('UPDATE homepage_content SET title = ?, subtitle = ?, button_text = ? LIMIT 1', [title, subtitle, button_text], (err) => {
        if (err) return res.send('❌ Update failed.');
        res.redirect('/edit-homepage.html');
      });
    }
  });
});

// ✅ Manage Services
app.get('/edit-services.html', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied.');
  res.sendFile(path.join(__dirname, 'admin-tools/edit-services.html'));
});
app.post('/add-service', (req, res) => {
  const { title, description, image_url, page_url } = req.body;
  db.query('INSERT INTO services (title, description, image_url, page_url) VALUES (?, ?, ?, ?)', [title, description, image_url, page_url], (err) => {
    if (err) return res.send('❌ Failed to add service.');
    res.redirect('/edit-services.html');
  });
});

// ✅ Daily Updates
app.get('/daily-updates.html', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied.');
  res.sendFile(path.join(__dirname, 'admin-tools/daily-updates.html'));
});
app.post('/add-daily-update', (req, res) => {
  const { date, update_text } = req.body;
  db.query('INSERT INTO daily_updates (date, update_text) VALUES (?, ?)', [date, update_text], (err) => {
    if (err) return res.send('❌ Failed to insert update.');
    res.redirect('/daily-updates.html');
  });
});

// ✅ View Users
app.get('/view-users.html', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied.');
  res.sendFile(path.join(__dirname, 'admin-tools/view-users.html'));
});
app.get('/api/users', (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: 'Access Denied' });
  db.query('SELECT id, email, created_at FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(results);
  });
});

// ---------------------- START SERVER ----------------------

app.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});
