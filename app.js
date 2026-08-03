let articles = [];

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchArticles();
});

// --- 인증 관리 ---
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const writeBtn = document.getElementById('writeBtn');

  if (token && user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (writeBtn) writeBtn.style.display = 'inline-block';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (writeBtn) writeBtn.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const idInput = document.getElementById('loginId').value;
  const pwInput = document.getElementById('loginPw').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: idInput, password: pwInput })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      alert('로그인되었습니다.');
      closeModal('loginModal');
      checkAuth();
      fetchArticles();
    } else {
      alert(data.message || '로그인에 실패했습니다.');
    }
  } catch (err) {
    alert('서버와 통신하는 중 오류가 발생했습니다.');
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  alert('로그아웃되었습니다.');
  checkAuth();
  fetchArticles();
}

// --- 게시글 CRUD ---
async function fetchArticles() {
  try {
    const res = await fetch('/api/articles');
    articles = await res.json();
    renderArticles(articles);
  } catch (err) {
    console.error('게시글 불러오기 실패:', err);
  }
}

function renderArticles(list) {
  const container = document.getElementById('articleList');
  if (!container) return;

  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<p class="no-data">등록된 게시글이 없습니다.</p>';
    return;
  }

  const token = localStorage.getItem('token');

  list.forEach(article => {
    const card = document.createElement('div');
    card.className = 'article-card';
    card.innerHTML = `
      <span class="category-tag">${escapeHtml(article.category)}</span>
      <h3>${escapeHtml(article.title)}</h3>
      <p class="summary">${escapeHtml(article.summary || article.content.substring(0, 100))}</p>
      <div class="meta">
        <span>${escapeHtml(article.author)}</span> | <span>${article.date}</span>
      </div>
      ${token ? `
        <div class="card-actions">
          <button onclick="editArticle(${article.id})">수정</button>
          <button onclick="deleteArticle(${article.id})">삭제</button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

async function saveArticle(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  if (!token) return alert('로그인이 필요합니다.');

  const id = document.getElementById('articleId').value;
  const category = document.getElementById('articleCategory').value;
  const title = document.getElementById('articleTitle').value;
  const content = document.getElementById('articleContent').value;

  const payload = { category, title, content };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/articles/${id}` : '/api/articles';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      closeModal('writeModal');
      fetchArticles();
    } else {
      alert(data.message || '저장에 실패했습니다.');
    }
  } catch (err) {
    alert('서버 통신 오류가 발생했습니다.');
  }
}

async function deleteArticle(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`/api/articles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (res.ok) {
      alert('삭제되었습니다.');
      fetchArticles();
    } else {
      alert(data.message || '삭제 실패');
    }
  } catch (err) {
    alert('서버 통신 오류가 발생했습니다.');
  }
}

function editArticle(id) {
  const article = articles.find(a => a.id === id);
  if (!article) return;

  document.getElementById('articleId').value = article.id;
  document.getElementById('articleCategory').value = article.category;
  document.getElementById('articleTitle').value = article.title;
  document.getElementById('articleContent').value = article.content;

  openModal('writeModal');
}

// 모달 제어
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
