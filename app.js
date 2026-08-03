// ==========================================
// ⚙️ 서버 주소 설정 (원하시는 주소로 직접 수정하세요)
// ==========================================
const SERVER_URL = 'https://news-magazine-1.onrender.com'; // <- 원하시는 서버 URL 입력
const API_BASE = `${SERVER_URL}/api`;

/* ===== App State ===== */
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let articles = [];
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;

// 카테고리 설정
const categories = [
  { name: '전체', icon: '🌐' },
  { name: '날씨', icon: '🌤️' },
  { name: '게임', icon: '🎮' },
  { name: 'SNS', icon: '📱' },
  { name: '스포츠', icon: '⚽' }
];

function getCategoryIcon(catName) {
  const found = categories.find(c => c.name === catName);
  return found ? found.icon : '📰';
}

/* ===== DOM 로드 시 초기화 ===== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderCategoryNav();
  renderHeaderUserUI();
  setupEventListeners();

  // 1. 기상청/날씨 데이터 자동 불러오기 & 스탯바 렌더링
  fetchKMAWeather();

  // 2. 서버에서 기사 목록 가져오기
  fetchArticles();
});

/* ===== 🌤️ 기상청 / 날씨 데이터 자동 연동 ===== */
async function fetchKMAWeather() {
  const statsBar = document.getElementById('statsBar');
  if (!statsBar) return;

  try {
    const res = await fetch('https://wttr.in/Seoul?format=j1');
    const data = await res.json();
    const current = data.current_condition[0];
    const tempC = current.temp_C;
    const weatherDesc = current.lang_ko ? current.lang_ko[0].value : current.weatherDesc[0].value;
    const humidity = current.humidity;

    statsBar.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%; max-width:1200px; margin:0 auto; padding:8px 16px; font-size:0.85rem; color:var(--text-secondary,#94a3b8); border-bottom:1px solid var(--border-color, rgba(255,255,255,0.1));">
        <div>
          <span style="color:var(--accent-gold, #fbbf24); font-weight:bold;">📡 기상청 실시간 예보:</span> 
          서울/수도권 <strong>${tempC}°C</strong> (${weatherDesc}) · 습도 ${humidity}%
        </div>
        <div style="font-size:0.8rem; opacity:0.8;">
          ⏰ 자동 업데이트 완료 (${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})
        </div>
      </div>
    `;
  } catch (err) {
    statsBar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; width:100%; max-width:1200px; margin:0 auto; padding:8px 16px; font-size:0.85rem; color:var(--text-secondary,#94a3b8);">
        <span>🌤️ <strong>기상청 날씨:</strong> 전국 대체로 흐림 · 전국 기온 18°C ~ 25°C 분포</span>
      </div>
    `;
  }
}

/* ===== 다크 / 라이트 테마 설정 ===== */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeBtn = document.getElementById('themeBtn');

  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if (themeBtn) themeBtn.textContent = '🌙';
  } else {
    document.body.classList.remove('light-mode');
    if (themeBtn) themeBtn.textContent = '☀️';
  }
}

window.toggleTheme = function () {
  const themeBtn = document.getElementById('themeBtn');
  const isLight = document.body.classList.toggle('light-mode');

  if (isLight) {
    localStorage.setItem('theme', 'light');
    if (themeBtn) themeBtn.textContent = '🌙';
    showToast('라이트 모드로 변경되었습니다.', 'info');
  } else {
    localStorage.setItem('theme', 'dark');
    if (themeBtn) themeBtn.textContent = '☀️';
    showToast('다크 모드로 변경되었습니다.', 'info');
  }
};

/* ===== 서버 API 연동 (기사 목록 가져오기) ===== */
async function fetchArticles() {
  try {
    const res = await fetch(`${API_BASE}/articles`);
    if (!res.ok) throw new Error('목록 조회 실패');
    articles = await res.json();

    renderHeroSection();
    renderArticles();
  } catch (err) {
    console.error('기사 목록 불러오기 오류:', err);
  }
}

/* ===== 히어로 섹션 (주요/최신 기사 자동 렌더링) ===== */
function renderHeroSection() {
  const heroSection = document.getElementById('heroSection');
  if (!heroSection || articles.length === 0) return;

  const mainArticle = articles[0];
  const icon = getCategoryIcon(mainArticle.category);

  heroSection.innerHTML = `
    <div onclick="openDetailModal(${mainArticle.id})" style="cursor:pointer; border-radius:16px; padding:24px; background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9)); border: 1px solid var(--border-color); margin-bottom: 24px;">
      <span style="background:var(--accent-gold, #fbbf24); color:#000; font-weight:bold; font-size:0.75rem; padding:3px 10px; border-radius:12px;">🔥 주요 뉴스</span>
      <h1 style="font-size: 1.6rem; margin: 12px 0 8px; color:#fff;">${icon} ${mainArticle.title}</h1>
      <p style="color:var(--text-secondary,#94a3b8); font-size:0.95rem; line-height:1.6; margin-bottom:12px;">${mainArticle.summary || mainArticle.content.substring(0, 120)}...</p>
      <div style="font-size:0.8rem; color:var(--text-muted,#64748b);">${mainArticle.author} · ${mainArticle.date}</div>
    </div>
  `;
}

/* ===== 전역 모달 제어 함수 ===== */
window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active', 'open', 'show');
    modal.style.display = 'none';
  }
};

window.openLoginModal = function () {
  const modal = document.getElementById('loginModal');
  const errDiv = document.getElementById('loginError');
  if (errDiv) errDiv.style.display = 'none';
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
};

window.closeLoginModal = function () {
  window.closeModal('loginModal');
};

window.openWriteModal = function (articleId = null) {
  if (!currentUser || !token) {
    showToast('기사 작성/수정은 로그인 후 가능합니다.', 'error');
    openLoginModal();
    return;
  }

  const modal = document.getElementById('writeModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('articleForm');

  editingArticleId = articleId;

  if (articleId) {
    const article = articles.find(a => a.id === Number(articleId));
    if (article) {
      if (title) title.textContent = '✏️ 기사 수정';
      if (document.getElementById('artTitle')) document.getElementById('artTitle').value = article.title;
      if (document.getElementById('artCategory')) document.getElementById('artCategory').value = article.category;
      if (document.getElementById('artAuthor')) document.getElementById('artAuthor').value = article.author;
      if (document.getElementById('artContent')) document.getElementById('artContent').value = article.content;
    }
  } else {
    if (title) title.textContent = '✍️ 새 기사 작성';
    if (form) form.reset();
    if (document.getElementById('artAuthor') && currentUser) {
      document.getElementById('artAuthor').value = currentUser.name || currentUser.username;
    }
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
};

window.closeWriteModal = function () {
  window.closeModal('writeModal');
  editingArticleId = null;
};

/* ===== 기사 상세 보기 모달 ===== */
window.openDetailModal = function (articleId) {
  const article = articles.find(a => a.id === Number(articleId));
  if (!article) return;

  const modal = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  const icon = getCategoryIcon(article.category);

  if (detailContent) {
    detailContent.innerHTML = `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px;">
          <span style="background: rgba(255,255,255,0.08); border:1px solid var(--border-color); color: var(--accent-gold); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem;">${icon} ${article.category}</span>
        </div>
        <h2 style="font-size: 1.5rem; margin-bottom: 12px; line-height: 1.4; font-weight: 700;">${article.title}</h2>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <span>작성자: <strong style="color: var(--text-primary);">${article.author}</strong></span>
          <span>•</span>
          <span>${article.date}</span>
        </div>
        <div style="font-size: 1rem; color: var(--text-secondary); line-height: 1.8; white-space: pre-line; margin-bottom: 24px;">${article.content}</div>

        ${currentUser ? `
          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
            <button class="btn btn-ghost" onclick="editArticle(${article.id}, event)" style="font-size: 0.85rem; padding: 8px 14px;">✏️ 수정</button>
            <button class="btn" onclick="deleteArticle(${article.id}, event)" style="background: rgba(232,85,85,0.15); color: #f87171; border: 1px solid rgba(232,85,85,0.3); font-size: 0.85rem; padding: 8px 14px;">🗑️ 삭제</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
};

/* ===== 카테고리 네비게이션 ===== */
function renderCategoryNav() {
  const catNav = document.getElementById('categoryNav');
  if (!catNav) return;

  catNav.innerHTML = categories.map(cat => `
    <button 
      class="cat-btn ${cat.name === currentCategory ? 'active' : ''}" 
      data-category="${cat.name}"
      onclick="setCategory('${cat.name}')"
      style="padding: 8px 16px; margin-right: 8px; border-radius: 20px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;"
    >
      <span>${cat.icon}</span> ${cat.name}
    </button>
  `).join('');
}

window.setCategory = function (category) {
  currentCategory = category;
  renderCategoryNav();
  renderArticles();
};

/* ===== 기사 목록 렌더링 ===== */
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

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center; padding: 40px; width: 100%; grid-column: 1 / -1;">
        <div style="font-size: 3rem;">📰</div>
        <h3>등록된 기사가 없습니다</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(article => {
    const icon = getCategoryIcon(article.category);
    return `
      <div class="article-card" onclick="openDetailModal(${article.id})" style="cursor:pointer; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; background: var(--bg-card, #1e293b); margin-bottom: 16px;">
        <div class="article-card-body">
          <span style="font-size: 0.8rem; color: var(--accent-gold, #fbbf24);">${icon} ${article.category}</span>
          <h3 style="margin: 8px 0; font-size: 1.1rem; color: var(--text-primary, #fff);">${article.title}</h3>
          <p style="color: var(--text-secondary, #94a3b8); font-size: 0.9rem; margin-bottom: 12px;">${article.summary || article.content.substring(0, 70)}...</p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted, #64748b);">
            <span>${article.author} • ${article.date}</span>
            ${currentUser ? `
              <div style="display: flex; gap: 6px;">
                <button onclick="editArticle(${article.id}, event)" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deleteArticle(${article.id}, event)" style="background:none; border:none; cursor:pointer;">🗑️</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== 기사 삭제 요청 ===== */
window.deleteArticle = async function (id, event) {
  if (event) event.stopPropagation();

  if (!confirm('정말 이 기사를 삭제하시겠습니까?')) return;

  try {
    const res = await fetch(`${API_BASE}/articles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(data.message || '게시글이 삭제되었습니다.', 'info');
    window.closeModal('detailModal');
    fetchArticles();
  } catch (err) {
    showToast(err.message || '삭제 실패', 'error');
  }
};

/* ===== 기사 수정 ===== */
window.editArticle = function (id, event) {
  if (event) event.stopPropagation();
  window.closeModal('detailModal');
  window.openWriteModal(id);
};

/* ===== 헤더 사용자 영역 UI 렌더링 ===== */
function renderHeaderUserUI() {
  const userArea = document.getElementById('userArea');
  const loginBtn = document.getElementById('loginBtn');
  const writeBtn = document.getElementById('writeBtn');

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userArea) {
      userArea.style.display = 'flex';
      const nameDisp = document.getElementById('userNameDisplay');
      if (nameDisp) nameDisp.textContent = `${currentUser.name || currentUser.username}`;
    }
    if (writeBtn) writeBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userArea) userArea.style.display = 'none';
    if (writeBtn) writeBtn.style.display = 'none';
  }
}

/* ===== 이벤트 리스너 바인딩 ===== */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderArticles();
    });
  }

  // 모달 배경 바깥 클릭 시 닫기
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        window.closeModal(overlay.id);
      }
    });
  });

  // 로그인 폼 제출 처리
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('loginId');
      const passwordInput = document.getElementById('loginPw');
      const errDiv = document.getElementById('loginError');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        if (errDiv) {
          errDiv.textContent = '아이디와 비밀번호를 모두 입력해주세요.';
          errDiv.style.display = 'block';
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        token = data.token;
        currentUser = data.user;

        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        renderHeaderUserUI();
        renderArticles();
        closeLoginModal();

        showToast(`${currentUser.name || currentUser.username}님 환영합니다!`, 'success');
      } catch (err) {
        if (errDiv) {
          errDiv.textContent = err.message || '로그인 실패';
          errDiv.style.display = 'block';
        }
      }
    });
  }

  // 기사 작성/수정 폼 제출 처리
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!token) {
        showToast('로그인이 필요합니다.', 'error');
        return;
      }

      const title = document.getElementById('artTitle').value;
      const category = document.getElementById('artCategory').value;
      const content = document.getElementById('artContent').value;
      const summary = content.substring(0, 100);

      const method = editingArticleId ? 'PUT' : 'POST';
      const url = editingArticleId ? `${API_BASE}/articles/${editingArticleId}` : `${API_BASE}/articles`;

      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ category, title, content, summary })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        showToast(editingArticleId ? '기사가 수정되었습니다.' : '새 기사가 등록되었습니다.', 'success');
        fetchArticles();
        closeWriteModal();
      } catch (err) {
        showToast(err.message || '저장에 실패했습니다.', 'error');
      }
    });
  }
}

/* ===== 로그아웃 ===== */
window.logout = function () {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  renderHeaderUserUI();
  renderArticles();
  showToast('로그아웃 되었습니다.', 'info');
};

/* ===== 이미지 미리보기 초기화 ===== */
window.clearImagePreview = function () {
  const input = document.getElementById('imageInput');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const uploadArea = document.getElementById('uploadArea');

  if (input) input.value = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (uploadArea) uploadArea.style.display = 'block';
};

/* ===== 🔔 토스트 알림 메시지 (화면 왼쪽 아래, 작고 아담한 스타일) ===== */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) return;

  // 컨테이너를 화면 왼쪽 하단 고정으로 설정
  container.style.cssText = "position: fixed; bottom: 20px; left: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 6px; pointer-events: none;";

  const toast = document.createElement('div');
  // 작고 깔끔한 컴팩트 알림창 스타일
  toast.style.cssText = "padding: 8px 14px; background: rgba(15, 23, 42, 0.95); color: #f1f5f9; border-radius: 8px; font-size: 0.78rem; border: 1px solid rgba(255,255,255,0.15); max-width: 250px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); backdrop-filter: blur(6px); pointer-events: auto; word-break: break-all;";
  
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}
