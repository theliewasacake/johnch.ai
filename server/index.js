require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { verifyPassword, requireAuth } = require('./auth');
const editorRoutes = require('./editor');
const uploadRoutes = require('./upload');
const configRoutes = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (nginx/Traefik) for secure cookies
app.set('trust proxy', 1);

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Serve static public files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Login endpoint
app.post('/admin/login', express.json(), async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const valid = await verifyPassword(password);
  if (valid) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Admin static files (behind auth, except login page)
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'login.html'));
});

// All other admin routes require auth
app.use('/admin', requireAuth);
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/admin', editorRoutes);
app.use('/admin', uploadRoutes);
app.use('/admin', configRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin/`);
});
