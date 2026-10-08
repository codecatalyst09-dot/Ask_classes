const path = require('path');
const fs = require('fs');
const os = require('os');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn('sqlite3 module loading warning:', e.message);
}

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DB_PATH = isServerless 
  ? path.join(os.tmpdir(), 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');

let db = null;
if (sqlite3) {
  try {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('SQLite connection error:', err.message);
      }
    });
  } catch (err) {
    console.error('Failed to initialize sqlite3 database:', err.message);
  }
}

// Promise-based helper functions
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve({ changes: 0, lastID: 0 });
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize tables
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      phone TEXT,
      course_id TEXT DEFAULT 'c10',
      status TEXT DEFAULT 'active',
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await dbRun(`ALTER TABLE users ADD COLUMN course_id TEXT DEFAULT 'c10'`); } catch (e) {}
  try { await dbRun(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`); } catch (e) {}
  try { await dbRun(`ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1`); } catch (e) {}

  await dbRun(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      instructor TEXT NOT NULL,
      date TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      meeting_link TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  // Safe migration for existing databases
  try {
    await dbRun(`ALTER TABLE schedule ADD COLUMN meeting_link TEXT DEFAULT ''`);
  } catch (e) {
    // column already exists
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ SQLite Database Tables initialized successfully.');
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase
};
