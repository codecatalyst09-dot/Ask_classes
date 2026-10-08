const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const os = require('os');
const https = require('https');
const localtunnel = require('localtunnel');
const { dbRun, dbGet, dbAll, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'ask_classes_secure_jwt_secret_key_2026';
const TUNNEL_FILE = path.join(__dirname, 'active_tunnel.json');
let activeTunnel = null;
let publicIPCache = '';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function fetchPublicIP() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.ip || '');
        } catch (e) {
          resolve('');
        }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(4000, () => {
      req.destroy();
      resolve('');
    });
  });
}

async function initGlobalTunnel(port) {
  try {
    if (activeTunnel) {
      try { activeTunnel.close(); } catch (e) {}
      activeTunnel = null;
    }
    const publicIP = await fetchPublicIP();
    if (publicIP) publicIPCache = publicIP;

    const subdomain = `askclasses-${Math.floor(1000 + Math.random() * 9000)}`;
    const tunnel = await localtunnel({ port, subdomain });
    activeTunnel = tunnel;

    const tunnelInfo = {
      url: tunnel.url,
      publicIP: publicIPCache,
      localIP: getLocalIP(),
      port: port,
      startedAt: new Date().toISOString()
    };
    fs.writeFileSync(TUNNEL_FILE, JSON.stringify(tunnelInfo, null, 2));

    tunnel.on('close', () => {
      console.log('⚠️ Global Tunnel was closed.');
      try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
      activeTunnel = null;
    });

    tunnel.on('error', (err) => {
      console.error('⚠️ Global Tunnel error:', err.message);
    });

    return tunnelInfo;
  } catch (err) {
    console.warn('⚠️ Global tunnel auto-start notice:', err.message);
    return null;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage for File Uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.pdf';
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// JWT Authentication Helpers
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // ignore expired/invalid token in optional auth
    }
  }
  next();
}

// --- SEED DEFAULT DATA ---
async function seedDefaultData() {
  // 1. Seed Default Admin
  const adminExists = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@askclasses.com']);
  if (!adminExists) {
    const hashedAdminPass = await bcrypt.hash('admin123', 10);
    await dbRun(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      ['Admin Principal', 'admin@askclasses.com', hashedAdminPass, 'admin', '+91 9876543210']
    );
    console.log('👤 Default Admin account created: admin@askclasses.com / admin123');
  }

  // 2. Seed Default Student
  const studentExists = await dbGet('SELECT * FROM users WHERE email = ?', ['student@askclasses.com']);
  if (!studentExists) {
    const hashedStudentPass = await bcrypt.hash('student123', 10);
    await dbRun(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      ['Anushka Singh', 'student@askclasses.com', hashedStudentPass, 'student', '+91 9123456780']
    );
    console.log('🎓 Default Student account created: student@askclasses.com / student123');
  }

  // 3. Seed Courses
  const coursesCount = await dbGet('SELECT COUNT(*) as count FROM courses');
  if (coursesCount.count === 0) {
    await dbRun(
      'INSERT INTO courses (id, name, category, description) VALUES (?, ?, ?, ?)',
      ['c9', 'Class 9', 'class9', 'Foundation & Revision Pack — Maths, Science & English']
    );
    await dbRun(
      'INSERT INTO courses (id, name, category, description) VALUES (?, ?, ?, ?)',
      ['c10', 'Class 10', 'class10', 'Board Preparation Pack — NCERT Syllabus']
    );
    console.log('📚 Default courses seeded.');
  }

  // 4. Seed initial Assignments if empty
  const assignCount = await dbGet('SELECT COUNT(*) as count FROM assignments');
  if (assignCount.count === 0) {
    await dbRun(
      'INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?)',
      ['a_1', 'c10', 'Mathematics: Quadratic Equations & Polynomials Worksheet', 'Solve all 15 questions from Section B & C. Submit before the live doubt session.', '2026-09-10']
    );
    await dbRun(
      'INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?)',
      ['a_2', 'c9', 'Science: Force and Laws of Motion Problem Set', 'Complete numerical problems 1 through 10 from Chapter 9 NCERT.', '2026-09-12']
    );
    console.log('📝 Sample assignments seeded.');
  }

  // 5. Seed initial Live Class Schedule if empty
  const schedCount = await dbGet('SELECT COUNT(*) as count FROM schedule');
  if (schedCount.count === 0) {
    const today = new Date().toISOString().split('T')[0];
    await dbRun(
      'INSERT INTO schedule (id, course_id, title, instructor, date, time_start, time_end, status, meeting_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['s_1', 'c10', 'Live Doubt Clearing & PYQ Solving', 'Dr. Rahul Sharma', today, '17:00', '18:30', 'live', 'https://meet.google.com/ask-live-demo']
    );
    await dbRun(
      'INSERT INTO schedule (id, course_id, title, instructor, date, time_start, time_end, status, meeting_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['s_2', 'c9', 'Physics Mechanics Masterclass', 'Prof. Priya Verma', today, '18:45', '20:00', 'upcoming', 'https://meet.google.com/ask-live-demo']
    );
    console.log('📅 Sample live schedules seeded with meeting links.');
  }

  // 6. Seed initial Study Materials if empty
  const matCount = await dbGet('SELECT COUNT(*) as count FROM materials');
  if (matCount.count === 0) {
    await dbRun(
      'INSERT INTO materials (id, course_id, title, description, file_name, file_path) VALUES (?, ?, ?, ?, ?, ?)',
      ['m_1', 'c10', 'Class 10 Complete Science Formula & Mindmap Sheet', 'Comprehensive cheat sheet covering Physics formulas, Chemical reactions, and Bio diagrams.', 'Class10_Science_Formula_Sheet.pdf', '']
    );
    await dbRun(
      'INSERT INTO materials (id, course_id, title, description, file_name, file_path) VALUES (?, ?, ?, ?, ?, ?)',
      ['m_2', 'c9', 'Class 9 Mathematics NCERT Solutions & Important Theorem Guide', 'Step-by-step proofs for Circles, Triangles, and Quadrilaterals.', 'Class9_Maths_Important_Theorems.pdf', '']
    );
    console.log('📚 Sample study materials seeded.');
  }
}

// ==========================================
//                 REST APIS
// ==========================================

// --- AUTH APIS WITH ACCESS CONTROL ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, courseId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (existingUser) {
      if (existingUser.role === 'admin') {
        return res.status(400).json({ success: false, message: 'Admin account cannot be registered here' });
      }
      // If student was pre-created by admin and is registering/activating password
      const hashedPassword = await bcrypt.hash(password, 10);
      await dbRun(
        'UPDATE users SET name = ?, password = ?, phone = ?, course_id = ?, is_approved = 1, status = "active" WHERE id = ?',
        [name.trim(), hashedPassword, phone ? phone.trim() : existingUser.phone, courseId || existingUser.course_id || 'c10', existingUser.id]
      );

      const updatedUser = {
        id: existingUser.id,
        name: name.trim(),
        email: normalizedEmail,
        role: 'student',
        courseId: courseId || existingUser.course_id || 'c10',
        phone: phone || existingUser.phone || ''
      };

      const token = generateToken(updatedUser);
      return res.status(200).json({
        success: true,
        message: 'Account activated successfully! Welcome to Ask Classes.',
        user: updatedUser,
        token
      });
    }

    // Allow open student enrollment so anyone anywhere can join classes!
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role, phone, course_id, status, is_approved) VALUES (?, ?, ?, "student", ?, ?, "active", 1)',
      [name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : '', courseId || 'c10']
    );

    const newUser = {
      id: result.lastID,
      name: name.trim(),
      email: normalizedEmail,
      role: 'student',
      courseId: courseId || 'c10',
      phone: phone ? phone.trim() : ''
    };

    const token = generateToken(newUser);
    return res.status(201).json({
      success: true,
      message: '🎉 Welcome to Ask Classes! Account created successfully. You can now access all classes and materials from anywhere.',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and password are required' });
    }

    const query = email.trim().toLowerCase();
    let user = await dbGet('SELECT * FROM users WHERE email = ?', [query]);
    if (!user && query === 'admin') {
      user = await dbGet('SELECT * FROM users WHERE role = ? LIMIT 1', ['admin']);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not enrolled or found.' });
    }

    if (user.role === 'student' && user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your student access has been suspended by the tuition administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please check and try again.' });
    }

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      courseId: user.course_id || 'c10',
      phone: user.phone
    };

    const token = generateToken(userProfile);
    res.json({
      success: true,
      message: 'Logged in successfully!',
      user: userProfile,
      token
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, role, phone, course_id as courseId, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- ADMIN STUDENT MANAGEMENT APIS ---
app.get('/api/admin/students', async (req, res) => {
  try {
    const students = await dbAll(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.course_id as courseId, u.status, u.is_approved as isApproved, u.created_at,
             c.name as courseName
      FROM users u
      LEFT JOIN courses c ON u.course_id = c.id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/students', async (req, res) => {
  try {
    const { name, email, password, courseId, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Student name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists in the database' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role, phone, course_id, status, is_approved) VALUES (?, ?, ?, "student", ?, ?, "active", 1)',
      [name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : '', courseId || 'c10']
    );

    const created = await dbGet('SELECT id, name, email, phone, course_id as courseId, status, created_at FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Student enrolled successfully!', student: created });
  } catch (err) {
    console.error('Add Student Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, courseId, phone, status } = req.body;

    const existing = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    let hashedPassword = existing.password;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await dbRun(
      'UPDATE users SET name = ?, email = ?, password = ?, phone = ?, course_id = ?, status = ? WHERE id = ?',
      [
        name ? name.trim() : existing.name,
        email ? email.trim().toLowerCase() : existing.email,
        hashedPassword,
        phone !== undefined ? phone : existing.phone,
        courseId || existing.course_id || 'c10',
        status || existing.status || 'active',
        id
      ]
    );

    res.json({ success: true, message: 'Student updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM users WHERE id = ? AND role = "student"', [id]);
    res.json({ success: true, message: 'Student enrollment and access revoked successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- COURSES APIS ---
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await dbAll('SELECT * FROM courses ORDER BY id ASC');
    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/courses', authMiddleware, async (req, res) => {
  try {
    const { id, name, category, description } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Course ID and Name are required' });
    }
    await dbRun(
      'INSERT INTO courses (id, name, category, description) VALUES (?, ?, ?, ?)',
      [id, name, category || 'general', description || '']
    );
    res.json({ success: true, message: 'Course created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- ASSIGNMENTS APIS ---
app.get('/api/assignments', async (req, res) => {
  try {
    const { courseId } = req.query;
    let sql = `
      SELECT a.id, a.course_id as courseId, a.title, a.description, a.due_date as dueDate, a.created_at,
             c.name as courseName, c.category as courseCategory
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
    `;
    const params = [];
    if (courseId) {
      sql += ' WHERE a.course_id = ?';
      params.push(courseId);
    }
    sql += ' ORDER BY a.created_at DESC';

    const assignments = await dbAll(sql, params);
    res.json({ success: true, assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const { id, courseId, title, description, dueDate } = req.body;
    if (!courseId || !title || !dueDate) {
      return res.status(400).json({ success: false, message: 'Course, title, and due date are required' });
    }
    const assignId = id || 'a_' + Date.now();
    await dbRun(
      'INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?)',
      [assignId, courseId, title, description || '', dueDate]
    );

    const created = await dbGet('SELECT * FROM assignments WHERE id = ?', [assignId]);
    res.status(201).json({ success: true, message: 'Assignment created successfully', assignment: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, title, description, dueDate } = req.body;
    await dbRun(
      'UPDATE assignments SET course_id = ?, title = ?, description = ?, due_date = ? WHERE id = ?',
      [courseId, title, description, dueDate, id]
    );
    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM assignments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- SCHEDULE & LIVE CLASSES APIS ---
app.get('/api/schedule', async (req, res) => {
  try {
    const { courseId, status } = req.query;
    let sql = `
      SELECT s.id, s.course_id as courseId, s.title, s.instructor, s.date, s.time_start as timeStart, s.time_end as timeEnd, s.status, s.meeting_link as meetingLink, s.meeting_link, s.created_at,
             c.name as courseName, c.category as courseCategory
      FROM schedule s
      LEFT JOIN courses c ON s.course_id = c.id
    `;
    const conditions = [];
    const params = [];
    if (courseId) {
      conditions.push('s.course_id = ?');
      params.push(courseId);
    }
    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.date ASC, s.time_start ASC';

    const schedule = await dbAll(sql, params);
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedule', async (req, res) => {
  try {
    const { id, courseId, title, instructor, date, timeStart, timeEnd, status, meetingLink, meeting_link } = req.body;
    if (!courseId || !title || !instructor || !date || !timeStart || !timeEnd) {
      return res.status(400).json({ success: false, message: 'All schedule details are required' });
    }
    const finalLink = meetingLink || meeting_link || 'https://meet.google.com/ask-live-class';
    const schedId = id || 's_' + Date.now();
    await dbRun(
      'INSERT INTO schedule (id, course_id, title, instructor, date, time_start, time_end, status, meeting_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [schedId, courseId, title, instructor, date, timeStart, timeEnd, status || 'upcoming', finalLink]
    );

    const created = await dbGet('SELECT * FROM schedule WHERE id = ?', [schedId]);
    res.status(201).json({ success: true, message: 'Class scheduled successfully', schedule: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, title, instructor, date, timeStart, timeEnd, status, meetingLink, meeting_link } = req.body;
    const finalLink = meetingLink || meeting_link || 'https://meet.google.com/ask-live-class';
    await dbRun(
      'UPDATE schedule SET course_id = ?, title = ?, instructor = ?, date = ?, time_start = ?, time_end = ?, status = ?, meeting_link = ? WHERE id = ?',
      [courseId, title, instructor, date, timeStart, timeEnd, status, finalLink, id]
    );
    res.json({ success: true, message: 'Class schedule updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM schedule WHERE id = ?', [id]);
    res.json({ success: true, message: 'Class schedule deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- STUDY MATERIALS APIS ---
app.get('/api/materials', async (req, res) => {
  try {
    const { courseId } = req.query;
    let sql = `
      SELECT m.id, m.course_id as courseId, m.title, m.description, m.file_name as fileName, m.file_path as filePath, m.created_at,
             c.name as courseName, c.category as courseCategory
      FROM materials m
      LEFT JOIN courses c ON m.course_id = c.id
    `;
    const params = [];
    if (courseId) {
      sql += ' WHERE m.course_id = ?';
      params.push(courseId);
    }
    sql += ' ORDER BY m.created_at DESC';

    const materials = await dbAll(sql, params);
    res.json({ success: true, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/materials', upload.single('file'), async (req, res) => {
  try {
    const { id, courseId, title, description } = req.body;
    if (!courseId || !title) {
      return res.status(400).json({ success: false, message: 'Course and title are required' });
    }

    const matId = id || 'm_' + Date.now();
    let fileName = req.file ? req.file.originalname : (req.body.fileName || `${title.replace(/\s+/g, '_')}.pdf`);
    let filePath = req.file ? `/uploads/${req.file.filename}` : '';

    await dbRun(
      'INSERT INTO materials (id, course_id, title, description, file_name, file_path) VALUES (?, ?, ?, ?, ?, ?)',
      [matId, courseId, title, description || '', fileName, filePath]
    );

    const created = await dbGet('SELECT * FROM materials WHERE id = ?', [matId]);
    res.status(201).json({ success: true, message: 'Study notes uploaded successfully', material: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/materials/:id', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, title, description } = req.body;

    const existing = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    let fileName = req.file ? req.file.originalname : (req.body.fileName || existing.file_name);
    let filePath = req.file ? `/uploads/${req.file.filename}` : existing.file_path;

    await dbRun(
      'UPDATE materials SET course_id = ?, title = ?, description = ?, file_name = ?, file_path = ? WHERE id = ?',
      [courseId, title, description, fileName, filePath, id]
    );

    res.json({ success: true, message: 'Study material updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);
    if (existing && existing.file_path) {
      const fullPath = path.join(__dirname, existing.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    await dbRun('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ success: true, message: 'Study material deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Download Material
app.get('/api/materials/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const material = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);
    if (!material) {
      return res.status(404).send('Material not found');
    }

    if (material.file_path) {
      const absoluteFilePath = path.join(__dirname, material.file_path);
      if (fs.existsSync(absoluteFilePath)) {
        return res.download(absoluteFilePath, material.file_name);
      }
    }

    // Generate lightweight mock PDF / text download if uploaded as mock
    const content = `Ask Classes Study Material\n=================================\n\nTitle: ${material.title}\nDescription: ${material.description}\nGenerated on: ${new Date().toLocaleString()}\n\nWelcome to Ask Classes - Raising Excellence.`;
    res.setHeader('Content-disposition', `attachment; filename="${material.file_name.endsWith('.pdf') ? material.file_name : material.file_name + '.txt'}"`);
    res.setHeader('Content-type', 'text/plain');
    res.send(content);
  } catch (err) {
    res.status(500).send('Error downloading file');
  }
});

// --- INQUIRIES & CHAT SUPPORT ---
app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    await dbRun(
      'INSERT INTO inquiries (name, email, message) VALUES (?, ?, ?)',
      [name || 'Anonymous Student', email || '', message || '']
    );
    res.json({ success: true, message: 'Inquiry received. Our support team will reach out to you shortly!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- DASHBOARD AGGREGATED STATS ---
app.get('/api/stats', async (req, res) => {
  try {
    const assignCount = await dbGet('SELECT COUNT(*) as count FROM assignments');
    const schedCount = await dbGet('SELECT COUNT(*) as count FROM schedule');
    const liveCount = await dbGet("SELECT COUNT(*) as count FROM schedule WHERE status = 'live'");
    const matCount = await dbGet('SELECT COUNT(*) as count FROM materials');
    const studentCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const courseCount = await dbGet('SELECT COUNT(*) as count FROM courses');

    res.json({
      success: true,
      stats: {
        assignments: assignCount.count,
        schedule: schedCount.count,
        liveClasses: liveCount.count,
        materials: matCount.count,
        students: studentCount.count,
        courses: courseCount.count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- RESET SYSTEM DATA (For Admin Testing) ---
app.post('/api/admin/reset', async (req, res) => {
  try {
    await dbRun('DELETE FROM assignments');
    await dbRun('DELETE FROM schedule');
    await dbRun('DELETE FROM materials');
    res.json({ success: true, message: 'All assignments, classes, and materials have been cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- NETWORK STATUS & WORLDWIDE ACCESS APIS ---
app.get('/api/network-status', async (req, res) => {
  const localIP = getLocalIP();
  let tunnelUrl = null;
  let publicIP = publicIPCache;

  if (activeTunnel && activeTunnel.url) {
    tunnelUrl = activeTunnel.url;
  } else if (fs.existsSync(TUNNEL_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(TUNNEL_FILE, 'utf8'));
      tunnelUrl = data.url;
      if (!publicIP) publicIP = data.publicIP;
    } catch (e) {}
  }

  res.json({
    success: true,
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    lanUrl: `http://${localIP}:${PORT}`,
    publicUrl: tunnelUrl,
    publicIP: publicIP || '',
    isTunnelActive: !!tunnelUrl
  });
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const info = await initGlobalTunnel(PORT);
    res.json({
      success: true,
      message: 'Global tunnel started successfully! Anyone worldwide can join now.',
      info
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/tunnel/stop', async (req, res) => {
  try {
    if (activeTunnel) {
      activeTunnel.close();
      activeTunnel = null;
    }
    try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
    res.json({ success: true, message: 'Global tunnel stopped.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server and Initialize DB
async function startServer() {
  await initDatabase();
  await seedDefaultData();
  const localIP = getLocalIP();

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n====================================================================`);
    console.log(`🚀 Ask Classes Platform Running on all Network Interfaces!`);
    console.log(`====================================================================`);
    console.log(`💻 Local Computer:     http://localhost:${PORT}`);
    console.log(`📱 Local WiFi (LAN):   http://${localIP}:${PORT}`);

    // Auto-initialize global tunnel so students outside WiFi can connect immediately
    console.log(`⏳ Launching Worldwide Public Gateway...`);
    const tunnelInfo = await initGlobalTunnel(PORT);
    if (tunnelInfo && tunnelInfo.url) {
      console.log(`🌐 Worldwide Public:   ${tunnelInfo.url}`);
      console.log(`   👉 Anyone anywhere on 4G/5G/any WiFi can join with this link!`);
      if (tunnelInfo.publicIP) {
        console.log(`   🔑 Tunnel Password (if prompted): ${tunnelInfo.publicIP}`);
      }
    } else {
      console.log(`🌐 Global Access:      Run 'npm run tunnel' to generate public link.`);
    }
    console.log(`====================================================================\n`);
  });
}

startServer();
