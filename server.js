const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB Cloud
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware tự động kết nối DB trước mỗi request
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    if (MONGODB_URI) {
      try {
        await mongoose.connect(MONGODB_URI);
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi kết nối CSDL: ' + err.message });
      }
    }
  }
  next();
});

// Schema Văn bản
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

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);

// API 1: Lấy danh sách văn bản (Tìm kiếm)
app.get('/api/documents', async (req, res) => {
  try {
    const { q } = req.query;
    let query = {};
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      query = {
        $or: [
          { title: searchRegex },
          { docNumber: searchRegex },
          { effectiveDate: searchRegex },
          { issuer: searchRegex },
          { summary: searchRegex }
        ]
      };
    }
    const docs = await Document.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API 2: Đăng văn bản mới
app.post('/api/documents', async (req, res) => {
  try {
    const newDoc = new Document(req.body);
    await newDoc.save();
    res.json({ success: true, data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API 3: Chỉnh sửa văn bản (Admin)
app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDoc = await Document.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: updatedDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API 4: Xóa văn bản (Admin)
app.delete('/api/documents/:id', async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa văn bản' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Trả về file index.html cho giao diện
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
