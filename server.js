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

// Middleware
app.use(session({
  secret: 'prosource_secret_key_2025',
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MySQL DB connection
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

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// -------------------- ROUTES ----------------------

// Homepage
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/get-session', (req, res) => {
  if (req.session.admin) res.json({ loggedIn: true, email: req.session.admin.email, role: "admin" });
  else if (req.session.user) res.json({ loggedIn: true, email: req.session.user.email, role: "user" });
  else res.json({ loggedIn: false });
});

// Admin Auth
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

// User Auth
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

// Logout
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// Forgot Password (User)
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
  if (req.session.otp !== otp || req.session.otpEmail !== email) {
    return res.send('❌ Invalid OTP or session expired.');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email], (err) => {
    if (err) return res.send('❌ Reset failed.');
    delete req.session.otp;
    delete req.session.otpEmail;
    res.send('✅ Password reset successful! <a href="/user-login.html">Login</a>');
  });
});

// Forgot Password (Admin)
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
  if (req.session.adminOtp !== otp || req.session.adminOtpEmail !== email) {
    return res.send('❌ Invalid OTP or session expired.');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  db.query('UPDATE admins SET password = ? WHERE email = ?', [hash, email], (err) => {
    if (err) return res.send('❌ Reset failed.');
    delete req.session.adminOtp;
    delete req.session.adminOtpEmail;
    res.send('✅ Admin password reset! <a href="/admin-login.html">Login</a>');
  });
});

// Admin Homepage Editor
app.get('/admin-edit-homepage', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied. Admins only.');
  db.query('SELECT * FROM homepage_content LIMIT 1', (err, results) => {
    if (err) return res.send('❌ Failed to fetch homepage content.');
    const data = results[0] || { title: '', subtitle: '', button_text: '' };
    res.send(`
      <h2>Edit Homepage Content</h2>
      <form method="POST" action="/admin-edit-homepage" style="max-width:500px;margin:auto;">
        <input name="title" value="${data.title}" required />
        <input name="subtitle" value="${data.subtitle}" required />
        <input name="button_text" value="${data.button_text}" required />
        <button type="submit">Update</button>
      </form>
    `);
  });
});

app.post('/admin-edit-homepage', (req, res) => {
  const { title, subtitle, button_text } = req.body;
  db.query('SELECT COUNT(*) as count FROM homepage_content', (err, results) => {
    if (err) return res.send('❌ Database error.');
    const count = results[0].count;
    if (count === 0) {
      db.query('INSERT INTO homepage_content (title, subtitle, button_text) VALUES (?, ?, ?)', [title, subtitle, button_text], (err) => {
        if (err) return res.send('❌ Failed to insert.');
        res.send('✅ Homepage content added. <a href="/admin-dashboard.html">Back</a>');
      });
    } else {
      db.query('UPDATE homepage_content SET title = ?, subtitle = ?, button_text = ? LIMIT 1', [title, subtitle, button_text], (err) => {
        if (err) return res.send('❌ Update failed.');
        res.send('✅ Homepage updated. <a href="/admin-dashboard.html">Back</a>');
      });
    }
  });
});

// ------------------ ✅ NEW ADMIN TOOLS ------------------

// View Users
app.get('/admin-view-users', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied. Admins only.');
  db.query('SELECT * FROM users', (err, results) => {
    if (err) return res.send('❌ Failed to fetch users.');
    let html = `
      <html><head><link rel="stylesheet" href="main.css"><title>View Users</title></head><body class="funky-body">
      <h2 class="funky-heading">Registered Users</h2>
      <table class="funky-table"><tr><th>Email</th><th>Registered On</th></tr>
    `;
    results.forEach(user => {
      html += `<tr><td>${user.email}</td><td>${user.created_at || '—'}</td></tr>`;
    });
    html += '</table><br><a href="/admin-dashboard.html" class="funky-back-btn">⬅ Back</a></body></html>';
    res.send(html);
  });
});

// Daily Updates
app.get('/admin-daily-updates', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied. Admins only.');
  res.sendFile(path.join(__dirname, 'admin-daily-updates.html'));
});

app.post('/admin-daily-updates', (req, res) => {
  const { date, update_text } = req.body;
  db.query('INSERT INTO daily_updates (date, update_text) VALUES (?, ?)', [date, update_text], (err) => {
    if (err) return res.send('❌ Failed to add update.');
    res.send('✅ Update added successfully. <a href="/admin-dashboard.html">Back</a>');
  });
});

// Manage Services
app.get('/admin-manage-services', (req, res) => {
  if (!req.session.admin) return res.send('❌ Access Denied. Admins only.');
  res.sendFile(path.join(__dirname, 'admin-manage-services.html'));
});

app.post('/admin-add-service', (req, res) => {
  const { title, description, page_url, image_url } = req.body;
  db.query('INSERT INTO services (title, description, page_url, image_url) VALUES (?, ?, ?, ?)', [title, description, page_url, image_url], (err) => {
    if (err) return res.send('❌ Failed to add service.');
    res.redirect('/admin-manage-services');
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});
