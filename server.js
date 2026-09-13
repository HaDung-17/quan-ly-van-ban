const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Cấu hình middleware để đọc dữ liệu JSON và phục vụ file tĩnh
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Các đường dẫn tới file dữ liệu JSON
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const DOCUMENTS_FILE = path.join(__dirname, 'data', 'documents.json');

// Hàm bổ trợ đọc file JSON an toàn
const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error(`Lỗi đọc file ${filePath}:`, error);
        return [];
    }
};

// Hàm bổ trợ ghi file JSON an toàn
const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Lỗi ghi file ${filePath}:`, error);
        return false;
    }
};

// API lấy danh sách người dùng (Cache-busting enabled)
app.get('/api/admin/users', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const users = readJsonFile(USERS_FILE);
    res.json(users);
});

// API Đăng nhập / Đăng ký cơ bản
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        if (user.blocked) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa.' });
        }
        res.json({ message: 'Đăng nhập thành công', user });
    } else {
        res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }
});

// Cấu hình Cổng và IP để Render có thể kết nối ra mạng ngoài
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Sư đoàn 307 đang chạy tại cổng: ${PORT}`);
});