require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── DB 초기화 ────────────────────────────────────────────────────────────────
initDB();

// ─── 미들웨어 ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 정적 파일 ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API 라우터 ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));

// ─── 에러 핸들러 ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: `파일 크기가 너무 큽니다. 최대 ${process.env.MAX_FILE_SIZE_MB || 5}MB`,
    });
  }
  res.status(500).json({ message: err.message || '서버 오류가 발생했습니다.' });
});

// ─── SPA 폴백 ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 서버 시작 ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║    📰  뉴스매거진 서버 실행 중       ║');
  console.log(`  ║    👉  http://localhost:${PORT}          ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
