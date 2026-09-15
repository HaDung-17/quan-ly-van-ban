const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

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

const DocumentSchema = new mongoose.Schema({
  title: String,
  docNumber: String,
  effectiveDate: String,
  issuer: String,
  summary: String,
  thumbnail: String,
  fileUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'admin_password' },
  value: String
});

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

// API Xác thực Admin (Ưu tiên kiểm tra mật khẩu tĩnh trước)
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { password } = req.body;
    let customPass = '3072026';
    
    try {
      const config = await Config.findOne({ key: 'admin_password' });
      if (config && config.value) customPass = config.value;
    } catch (e) {}

    if (password === customPass || password === '3072026') {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Mật khẩu sai' });
    }
  } catch (err) {
    res.json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// API Đổi Mật Khẩu Admin
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPass, newPass } = req.body;
    let config = await Config.findOne({ key: 'admin_password' });
    const validPass = config ? config.value : '3072026';

    if (currentPass !== validPass && currentPass !== '3072026') {
      return res.json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    if (!config) {
      config = new Config({ key: 'admin_password', value: newPass });
    } else {
      config.value = newPass;
    }
    await config.save();
    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API Lấy danh sách văn bản
app.get('/api/documents', async (req, res) => {
  try {
    const { q, category } = req.query;
    let query = {};
    
    if (category) query.issuer = category;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      query.$or = [
        { title: searchRegex },
        { docNumber: searchRegex },
        { effectiveDate: searchRegex },
        { issuer: searchRegex },
        { summary: searchRegex }
      ];
    }

    const docs = await Document.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// API Đăng văn bản
app.post('/api/documents', async (req, res) => {
  try {
    const newDoc = new Document(req.body);
    await newDoc.save();
    res.json({ success: true, data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API Sửa văn bản
app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDoc = await Document.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: updatedDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API Xóa văn bản
app.delete('/api/documents/:id', async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa văn bản' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
