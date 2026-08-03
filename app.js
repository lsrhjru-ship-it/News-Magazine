// ==========================================
// 🔗 백엔드 서버 주소 설정
// ==========================================
const API_BASE_URL = 'https://se-eaib.onrender.com';

let articles = [];

// 페이지 로드 시 초기화 및 데이터 불러오기
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchArticles();

  // 폼 이벤트 바인딩
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const articleForm = document.getElementById('articleForm');
  if (articleForm) articleForm.addEventListener('submit', saveArticle);
});

// --- 인증 관리 ---
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const loginBtn = document.getElementById('loginBtn');
  const userArea = document.getElementById('userArea');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const writeBtn = document.getElementById('writeBtn');

  if (token && user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userArea) {
      userArea.style.display = 'flex';
      if (userNameDisplay) userNameDisplay.textContent = user.username || user.name || '관리자';
    }
    if (writeBtn) writeBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userArea) userArea.style.display = 'none';
    if (writeBtn) writeBtn.style.display = 'none';
  }
}

// 로그인 처리
async function handleLogin(e) {
  e.preventDefault();
  const idInput = document.getElementById('loginId').value;
  const pwInput = document.getElementById('loginPw').value;
  const loginError = document.getElementById('loginError');

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: idInput, password: pwInput })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      alert('로그인되었습니다.');
      closeLoginModal();
      checkAuth();
      fetchArticles();
    } else {
      if (loginError) {
        loginError.style.display = 'block';
        loginError.textContent = data.message || '로그인에 실패했습니다.';
      } else {
        alert(data.message || '로그인에 실패했습니다.');
      }
    }
  } catch (err) {
    alert('서버와 통신하는 중 오류가 발생했습니다.');
  }
}

// 로그아웃 처리
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  alert('로그아웃되었습니다.');
  checkAuth();
  fetchArticles();
}

// --- 게시글 CRUD ---

// 게시글 목록 불러오기
async function fetchArticles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/articles`);
    articles = await res.json();
    renderArticles(articles);
  } catch (err) {
    console.error('게시글 불러오기 실패:', err);
  }
}

// 게시글 렌더링
function renderArticles(list) {
  const container = document.getElementById('articlesGrid');
  if (!container) return;

  container.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
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
      <p class="summary">${escapeHtml(article.summary || (article.content ? article.content.substring(0, 100) : ''))}</p>
      <div class="meta">
        <span>${escapeHtml(article.author || '익명')}</span> | <span>${article.created_at || article.date || ''}</span>
      </div>
      ${token ? `
        <div class="card-actions" style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="editArticle(${article.id})">수정</button>
          <button class="btn btn-ghost" onclick="deleteArticle(${article.id})">삭제</button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

// 게시글 작성 및 수정 저장
async function saveArticle(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  if (!token) return alert('로그인이 필요합니다.');

  const idElement = document.getElementById('articleId');
  const id = idElement ? idElement.value : '';
  const category = document.getElementById('artCategory').value;
  const title = document.getElementById('artTitle').value;
  const author = document.getElementById('artAuthor').value;
  const content = document.getElementById('artContent').value;

  const payload = { category, title, author, content };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE_URL}/api/articles/${id}` : `${API_BASE_URL}/api/articles`;

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
      alert(data.message || '성공적으로 저장되었습니다.');
      closeWriteModal();
      fetchArticles();
    } else {
      alert(data.message || '저장에 실패했습니다.');
    }
  } catch (err) {
    alert('서버 통신 오류가 발생했습니다.');
  }
}

// 게시글 삭제
async function deleteArticle(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_BASE_URL}/api/articles/${id}`, {
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

// 게시글 수정 폼 채우기
function editArticle(id) {
  const article = articles.find(a => a.id === id);
  if (!article) return;

  let idElement = document.getElementById('articleId');
  if (!idElement) {
    idElement = document.createElement('input');
    idElement.type = 'hidden';
    idElement.id = 'articleId';
    document.getElementById('articleForm').appendChild(idElement);
  }
  
  idElement.value = article.id;
  document.getElementById('artCategory').value = article.category;
  document.getElementById('artTitle').value = article.title;
  if (document.getElementById('artAuthor')) {
    document.getElementById('artAuthor').value = article.author || '';
  }
  document.getElementById('artContent').value = article.content;

  openWriteModal();
}

// --- 모달 제어 함수 ---
function openLoginModal() {
  openModal('loginModal');
}

function closeLoginModal() {
  closeModal('loginModal');
  const loginError = document.getElementById('loginError');
  if (loginError) loginError.style.display = 'none';
}

function openWriteModal() {
  openModal('writeModal');
}

function closeWriteModal() {
  closeModal('writeModal');
  const articleForm = document.getElementById('articleForm');
  if (articleForm) articleForm.reset();
  const idElement = document.getElementById('articleId');
  if (idElement) idElement.value = '';
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// XSS 방지용 HTML 문자열 이스케이프
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
