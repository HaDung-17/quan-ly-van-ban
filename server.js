const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB Cloud
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoan307';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Đã kết nối MongoDB Cloud thành công'))
  .catch(err => console.error('Lỗi kết nối DB:', err));

// Schema Văn bản
const DocumentSchema = new mongoose.Schema({
  title: String,          // Tiêu đề văn bản
  docNumber: String,      // Số văn bản (VD: 390-NQ/ĐU)
  effectiveDate: String, // Ngày hiệu lực / Ngày ban hành
  issuer: String,         // Cơ quan ban hành
  summary: String,        // Nội dung tóm tắt / xem trước
  thumbnail: String,      // Link ảnh đại diện/xem trước
  fileUrl: String,        // Link tệp văn bản (PDF/Drive/Cloudinary)
  createdAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', DocumentSchema);

// API 1: Lấy danh sách văn bản (Tích hợp Tìm kiếm thông minh)
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

module.exports = app;
