const bcrypt = require('bcrypt');

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

async function verifyPassword(password) {
  if (!ADMIN_PASSWORD_HASH) return false;
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/admin/login.html');
}

module.exports = { verifyPassword, requireAuth };
