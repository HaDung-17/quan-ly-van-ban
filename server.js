const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

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

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Lỗi ghi file ${filePath}:`, error);
        return false;
    }
};

// API Đăng ký
app.post('/api/register', (req, res) => {
    const { username, password, fullname } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    const users = readJsonFile(USERS_FILE);
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại.' });
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;

    const newUser = {
        id: Date.now().toString(),
        username,
        password,
        fullname: fullname || username,
        role: users.length === 0 ? 'admin' : 'user',
        ip: clientIp,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);
    res.json({ message: 'Đăng ký thành công!', user: newUser });
});

// API Đăng nhập
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        if (user.blocked) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
        user.lastIp = clientIp;
        writeJsonFile(USERS_FILE, users);
        res.json({ message: 'Đăng nhập thành công', user });
    } else {
        res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }
});

// API Lấy danh sách thành viên
app.get('/api/admin/users', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(readJsonFile(USERS_FILE));
});

// API Thay đổi quyền Admin / User
app.post('/api/admin/change-role', (req, res) => {
    const { userId, newRole } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    user.role = newRole;
    writeJsonFile(USERS_FILE, users);
    res.json({ message: `Đã cập nhật quyền thành ${newRole}` });
});

// API Admin Đặt lại mật khẩu cho thành viên
app.post('/api/admin/reset-password', (req, res) => {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.trim() === '') {
        return res.status(400).json({ message: 'Mật khẩu mới không được để trống.' });
    }

    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    user.password = newPassword;
    writeJsonFile(USERS_FILE, users);
    res.json({ message: `Đã đặt lại mật khẩu thành công cho tài khoản: ${user.username}` });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Sư đoàn 307 đang chạy tại cổng: ${PORT}`);
});
