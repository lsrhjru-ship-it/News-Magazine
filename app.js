/* ===== App State ===== */
// 처음에 로컬스토리지에 저장된 데이터가 없으면 빈 배열([])로 시작합니다.
let articles = JSON.parse(localStorage.getItem('articles')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;

/* ===== DOM Loaded Initialization ===== */
document.addEventListener('DOMContentLoaded', () => {
  renderHeaderUserUI();
  renderArticles();
  setupEventListeners();
});

/* ===== Global Functions (HTML onclick 바인딩용) ===== */

// 1. 모달 제어 함수
window.openLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('active');
};

window.closeLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('active');
};

window.openWriteModal = function (articleId = null) {
  const modal = document.getElementById('writeModal');
  const title = document.getElementById('writeModalTitle');
  const form = document.getElementById('articleForm');

  editingArticleId = articleId;

  if (articleId) {
    const article = articles.find(a => a.id === articleId);
    if (article) {
      if (title) title.textContent = '기사 수정';
      document.getElementById('inputTitle').value = article.title;
      document.getElementById('selectCategory').value = article.category;
      document.getElementById('inputExcerpt').value = article.excerpt || '';
      document.getElementById('textContent').value = article.content;
      document.getElementById('inputImageUrl').value = article.image || '';
    }
  } else {
    if (title) title.textContent = '새 기사 작성';
    if (form) form.reset();
  }

  if (modal) modal.classList.add('active');
};

window.closeWriteModal = function () {
  const modal = document.getElementById('writeModal');
  if (modal) modal.classList.remove('active');
  editingArticleId = null;
};

window.openDetailModal = function (articleId) {
  const article = articles.find(a => a.id === articleId);
  if (!article) return;

  article.views = (article.views || 0) + 1;
  localStorage.setItem('articles', JSON.stringify(articles));
  renderArticles();

  const modal = document.getElementById('detailModal');
  const body = document.getElementById('detailModalBody');

  if (body) {
    body.innerHTML = `
      ${article.image ? `<img src="${article.image}" class="detail-hero-img" alt="${article.title}">` : ''}
      <div class="detail-body">
        <div class="detail-category">
          <span class="badge badge-${article.category}">${article.category}</span>
        </div>
        <h2 class="detail-title">${article.title}</h2>
        <div class="detail-meta">
          <span>작성자: <strong>${article.author}</strong></span>
          <span>•</span>
          <span>${article.date}</span>
          <span>•</span>
          <span>조회수 ${article.views}</span>
        </div>
        <div class="detail-content">${article.content}</div>
      </div>
    `;
  }

  if (modal) modal.classList.add('active');
};

window.closeDetailModal = function () {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('active');
};

// 2. 기사 삭제 및 수정
window.deleteArticle = function (id, event) {
  if (event) event.stopPropagation();
  if (!confirm('정말 이 기사를 삭제하시겠습니까?')) return;

  articles = articles.filter(a => a.id !== id);
  localStorage.setItem('articles', JSON.stringify(articles));
  renderArticles();
  showToast('기사가 삭제되었습니다.', 'info');
};

window.editArticle = function (id, event) {
  if (event) event.stopPropagation();
  window.openWriteModal(id);
};

// 3. 카테고리 변경
window.setCategory = function (category) {
  currentCategory = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderArticles();
};

/* ===== UI Render Functions ===== */
function renderHeaderUserUI() {
  const container = document.getElementById('userAuthContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="user-badge">
        <span class="user-avatar">👤</span>
        <span class="user-name">${currentUser.name}</span>
      </div>
      <button class="btn btn-ghost" onclick="logout()">로그아웃</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-ghost" onclick="openLoginModal()">로그인</button>
    `;
  }
}

function renderArticles() {
  const grid = document.getElementById('articlesGrid');
  if (!grid) return;

  let filtered = articles;

  if (currentCategory !== '전체') {
    filtered = filtered.filter(a => a.category === currentCategory);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q)
    );
  }

  // 데이터가 없을 때 표시될 UI
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <div class="empty-title">작성된 기사가 없습니다</div>
        <div class="empty-desc">우측 상단의 '기사 작성' 버튼을 눌러 첫 기사를 올려보세요!</div>
        <button class="btn btn-gold" onclick="openWriteModal()">기사 작성하기</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(article => `
    <div class="article-card fade-in-up" onclick="openDetailModal(${article.id})">
      <div class="article-card-img-container">
        ${article.image 
          ? `<img src="${article.image}" class="article-card-img" alt="${article.title}">`
          : `<div class="article-card-img-placeholder">📰</div>`
        }
      </div>
      <div class="article-card-body">
        <span class="badge badge-${article.category}">${article.category}</span>
        <h3 class="article-card-title">${article.title}</h3>
        <p class="article-card-excerpt">${article.excerpt || article.content.substring(0, 60)}...</p>
        <div class="article-card-meta">
          <div class="article-card-meta-left">
            <span>${article.author}</span>
            <span class="meta-dot"></span>
            <span>${article.date}</span>
          </div>
          <div class="article-card-actions">
            <button class="action-btn edit" onclick="editArticle(${article.id}, event)" title="수정">✏️</button>
            <button class="action-btn delete" onclick="deleteArticle(${article.id}, event)" title="삭제">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ===== Event Listeners Setup ===== */
function setupEventListeners() {
  // 검색 입력
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderArticles();
    });
  }

  // 로그인 폼
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      if (!username) return;

      currentUser = { name: username };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      renderHeaderUserUI();
      closeLoginModal();
      showToast(`${username}님 환영합니다!`, 'success');
    });
  }

  // 기사 작성/수정 폼
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('inputTitle').value;
      const category = document.getElementById('selectCategory').value;
      const excerpt = document.getElementById('inputExcerpt').value;
      const content = document.getElementById('textContent').value;
      const image = document.getElementById('inputImageUrl').value;

      if (editingArticleId) {
        // 수정
        articles = articles.map(a => {
          if (a.id === editingArticleId) {
            return { ...a, title, category, excerpt, content, image };
          }
          return a;
        });
        showToast('기사가 수정되었습니다.', 'success');
      } else {
        // 새로 작성
        const newArticle = {
          id: Date.now(),
          title,
          category,
          excerpt,
          content,
          image,
          author: currentUser ? currentUser.name : '익명',
          date: new Date().toISOString().split('T')[0],
          views: 0
        };
        articles.unshift(newArticle);
        showToast('새 기사가 등록되었습니다.', 'success');
      }

      localStorage.setItem('articles', JSON.stringify(articles));
      renderArticles();
      closeWriteModal();
    });
  }
}

// 로그아웃
window.logout = function () {
  currentUser = null;
  localStorage.removeItem('currentUser');
  renderHeaderUserUI();
  showToast('로그아웃 되었습니다.', 'info');
};

// 토스트 메시지
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
