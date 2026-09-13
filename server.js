const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const DOCUMENTS_FILE = path.join(__dirname, 'data', 'documents.json');

const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        return [];
    }
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        return false;
    }
};

// API Đăng ký
app.post('/api/register', (req, res) => {
    const { username, password, fullname } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Thiếu thông tin.' });

    const users = readJsonFile(USERS_FILE);
    if (users.find(u => u.username === username)) return res.status(400).json({ message: 'Tài khoản đã tồn tại.' });

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;

    const newUser = {
        id: Date.now().toString(),
        username,
        password,
        fullname: fullname || username,
        role: users.length === 0 ? 'admin' : 'user',
        ip: clientIp,
        lastIp: clientIp,
        location: 'Chưa xác định',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);
    res.json({ message: 'Đăng ký thành công!', user: newUser });
});

// API Đăng nhập (Ghi nhận thời gian và IP/vị trí từng đăng nhập)
app.post('/api/login', async (req, res) => {
    const { username, password, lat, lon } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        if (user.blocked) return res.status(403).json({ message: 'Tài khoản bị khóa.' });

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
        user.lastIp = clientIp;
        user.lastLoginAt = new Date().toISOString();

        if (lat && lon) {
            user.location = `GPS: ${lat}, ${lon} (https://maps.google.com/?q=${lat},${lon})`;
        } else {
            try {
                const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,regionName,city`);
                const geoData = await geoRes.json();
                if (geoData.status === 'success') {
                    user.location = `${geoData.city}, ${geoData.regionName}, ${geoData.country}`;
                } else {
                    user.location = 'IP Nội bộ/Không xác định';
                }
            } catch (e) {
                user.location = 'Lỗi định vị IP';
            }
        }

        writeJsonFile(USERS_FILE, users);
        res.json({ message: 'Đăng nhập thành công', user });
    } else {
        res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu.' });
    }
});

// API Admin lấy TOÀN BỘ danh sách thành viên (cả đang hoạt động lẫn đã từng đăng nhập)
app.get('/api/admin/users', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(readJsonFile(USERS_FILE));
});

// API Admin đổi quyền
app.post('/api/admin/change-role', (req, res) => {
    const { userId, newRole } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.id === userId);
    if (user) {
        user.role = newRole;
        writeJsonFile(USERS_FILE, users);
        res.json({ message: 'Đã cập nhật quyền.' });
    } else {
        res.status(404).json({ message: 'Không tìm thấy user.' });
    }
});

// API Admin reset password
app.post('/api/admin/reset-password', (req, res) => {
    const { userId, newPassword } = req.body;
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.id === userId);
    if (user) {
        user.password = newPassword;
        writeJsonFile(USERS_FILE, users);
        res.json({ message: 'Đã đổi mật khẩu.' });
    } else {
        res.status(404).json({ message: 'Không tìm thấy user.' });
    }
});

// API Văn bản
app.get('/api/documents', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(readJsonFile(DOCUMENTS_FILE));
});

app.post('/api/documents', (req, res) => {
    const { title, docNumber, category, subCategory, link } = req.body;
    if (!title || !docNumber) return res.status(400).json({ message: 'Thiếu thông tin văn bản.' });

    const docs = readJsonFile(DOCUMENTS_FILE);
    const newDoc = {
        id: Date.now().toString(),
        title,
        docNumber,
        category: category || 'Chung',
        subCategory: subCategory || '',
        link: link || '#',
        createdAt: new Date().toISOString()
    };

    docs.push(newDoc);
    writeJsonFile(DOCUMENTS_FILE, docs);
    res.json({ message: 'Thêm văn bản thành công!', doc: newDoc });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Sư đoàn 307 đang chạy tại cổng: ${PORT}`);
});
