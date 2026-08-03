require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// SQLite 데이터베이스 연결
const db = new Database(path.join(__dirname, 'blog.db'));

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    date TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL
  );
`);

// users 테이블에 role 칼럼이 없는 경우를 대비한 자동 추가
try {
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin';`);
} catch (e) {
  // 칼럼이 이미 존재하면 무시
}

// 기본 관리자 계정 생성 및 권한 보장
const initAdmin = async () => {
  const adminUser = process.env.ADMIN_USERNAME || 'lsrhjru';
  const adminPass = process.env.ADMIN_PASSWORD || 'lsr37733*';
  const adminName = process.env.ADMIN_NAME || '관리자';

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUser);
  if (!row) {
    const hashedPassword = await bcrypt.hash(adminPass, 10);
    db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run(adminUser, hashedPassword, adminName, 'admin');
    console.log('✅ 관리자 계정이 새로 생성되었습니다.');
  } else {
    db.prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', adminUser);
    console.log('✅ 관리자 계정 권한이 보장되었습니다.');
  }
};
initAdmin();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// JWT 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: '인증 토큰이 없습니다.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
    req.user = user;
    next();
  });
};

// --- API 라우트 ---

// 1. 로그인 (JWT 토큰 내부 + 응답값 모두에 관리자 권한 포함)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // app.js가 요구할 수 있는 모든 형태의 권한 객체 구성
    const authPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: 'admin',
      isAdmin: true,
      admin: true,
      is_admin: 1,
      type: 'admin'
    };

    // 🔑 JWT 토큰 내부에도 권한 정보를 완전히 채워서 발급
    const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '12h' });

    // HTTP 응답 바디에도 전파
    res.json({
      token,
      user: authPayload,
      ...authPayload
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 2. 게시글 목록 조회
app.get('/api/articles', (req, res) => {
  try {
    const articles = db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ message: '게시글 목록을 불러오지 못했습니다.' });
  }
});

// 3. 게시글 상세 조회
app.get('/api/articles/:id', (req, res) => {
  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ message: '게시글을 불러오지 못했습니다.' });
  }
});

// 4. 게시글 작성
app.post('/api/articles', authenticateToken, (req, res) => {
  const { category, title, content, summary } = req.body;
  const author = req.user.name || '관리자';
  const date = new Date().toISOString().split('T')[0];

  try {
    const result = db.prepare(
      'INSERT INTO articles (category, title, author, date, summary, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(category, title, author, date, summary || '', content);

    res.status(201).json({ id: result.lastInsertRowid, message: '게시글이 등록되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '게시글 등록에 실패했습니다.' });
  }
});

// 5. 게시글 수정
app.put('/api/articles/:id', authenticateToken, (req, res) => {
  const { category, title, content, summary } = req.body;
  try {
    const result = db.prepare(
      'UPDATE articles SET category = ?, title = ?, content = ?, summary = ? WHERE id = ?'
    ).run(category, title, content, summary || '', req.params.id);

    if (result.changes === 0) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
    res.json({ message: '게시글이 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '게시글 수정에 실패했습니다.' });
  }
});

// 6. 게시글 삭제
app.delete('/api/articles/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
    res.json({ message: '게시글이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '게시글 삭제에 실패했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 서버가 실행되었습니다: http://localhost:${PORT}`);
});
