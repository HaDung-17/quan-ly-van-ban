const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(process.cwd(), 'public')));

const MONGODB_URI = process.env.MONGODB_URI;

app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1 && MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.error('Lỗi DB:', err);
    }
  }
  next();
});

// SCHEMAS
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const DocumentSchema = new mongoose.Schema({
  level1: String, // BQP, QK, SD
  level2: String, // Tab cấp 2 (VD: BTM_QK, PTM, PCT...)
  level3: String, // Tab cấp 3 (Nghị quyết, Quyết định...)
  title: String,
  docNumber: String,
  effectiveDate: String,
  issuer: String,
  summary: String,
  thumbnail: String,
  fileUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const AuditLogSchema = new mongoose.Schema({
  username: String,
  fullName: String,
  ip: String,
  country: String,
  countryCode: String,
  locationDetail: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

async function initDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        fullName: 'Quản trị viên Hệ thống',
        password: '3072026',
        role: 'admin'
      });
    }
  } catch (e) {}
}

app.post('/api/auth/register', async (req, res) => {
  try {
    await initDefaultAdmin();
    const { username, fullName, password } = req.body;
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.json({ success: false, message: 'Tên đăng nhập đã tồn tại!' });

    const newUser = new User({ username: username.toLowerCase(), fullName, password, role: 'user' });
    await newUser.save();
    res.json({ success: true, message: 'Đăng ký thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await initDefaultAdmin();
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase(), password });
    if (!user) return res.json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác!' });

    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();

    let country = 'Việt Nam', countryCode = 'VN', locationDetail = 'Việt Nam';

    try {
      const geoRes = await new Promise((resolve) => {
        http.get(`http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,regionName,city,district`, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({}); } });
        }).on('error', () => resolve({}));
      });

      if (geoRes && geoRes.status === 'success') {
        country = geoRes.country || 'Việt Nam';
        countryCode = geoRes.countryCode || 'VN';
        const parts = [];
        if (geoRes.district) parts.push(geoRes.district);
        if (geoRes.city && geoRes.city !== geoRes.district) parts.push(geoRes.city);
        if (geoRes.regionName && geoRes.regionName !== geoRes.city) parts.push(geoRes.regionName);
        if (geoRes.country) parts.push(geoRes.country);
        locationDetail = parts.length > 0 ? parts.join(', ') : 'Việt Nam';
      }
    } catch (e) {}

    await AuditLog.create({
      username: user.username,
      fullName: user.fullName,
      ip: clientIp,
      country, countryCode, locationDetail
    });

    res.json({
      success: true,
      user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, oldPass, newPass } = req.body;
    const user = await User.findById(userId);
    if (!user || user.password !== oldPass) {
      return res.json({ success: false, message: 'Mật khẩu cũ không chính xác!' });
    }
    user.password = newPass;
    await user.save();
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const { level1, level2, level3, q } = req.query;
    let query = {};
    if (level1) query.level1 = level1;
    if (level2) query.level2 = level2;
    if (level3) query.level3 = level3;

    if (q) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { title: regex },
        { docNumber: regex },
        { effectiveDate: regex },
        { issuer: regex },
        { summary: regex }
      ];
    }

    const docs = await Document.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const newDoc = new Document(req.body);
    await newDoc.save();
    res.json({ success: true, data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  try {
    const updatedDoc = await Document.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updatedDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa!' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/admin/reset-user-password', async (req, res) => {
  try {
    const { userId, newPass } = req.body;
    await User.findByIdAndUpdate(userId, { password: newPass });
    res.json({ success: true, message: 'Cập nhật mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/admin/make-admin', async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, { role: 'admin' });
    res.json({ success: true, message: 'Đã chỉ định Admin thành công!' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

module.exports = app;
