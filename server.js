const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// KẾT NỐI MONGODB
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:admin123@cluster0.mongodb.net/vanban?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log('Đã kết nối MongoDB thành công!'))
    .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// SCHEMA VĂN BẢN
const DocumentSchema = new mongoose.Schema({
    title: String,
    docNumber: String,
    effectiveDate: String,
    level1: String,
    level2: String,
    level3: String,
    thumbnail: String,
    fileUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', DocumentSchema);

// API LẤY DANH SÁCH VĂN BẢN
app.get('/api/documents', async (req, res) => {
    try {
        const { q, level1, level2, level3 } = req.query;
        let filter = {};

        if (q) {
            filter.$or = [
                { title: { $regex: q, $options: 'i' } },
                { docNumber: { $regex: q, $options: 'i' } }
            ];
        } else {
            if (level1) filter.level1 = level1;
            if (level2) filter.level2 = level2;
            if (level3) filter.level3 = level3;
        }

        // Lấy danh sách văn bản mới nhất trước
        const docs = await Document.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: docs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
});

// ROUTE TRANG CHỦ
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));