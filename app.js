/* ===== App State ===== */
const API_BASE = '/api';
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let articles = [];
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;

// 관리자 아이디 (서버의 기본 ADMIN_USERNAME)
const ADMIN_USERNAME = 'lsrhjru';

// 카테고리 데이터
const categories = [
  { name: '전체', icon: '🌐' },
  { name: '날씨', icon: '🌤️' },
  { name: '게임', icon: '🎮' },
  { name: 'SNS', icon: '📱' },
  { name: '스포츠', icon: '⚽' },
  { name: '기상청', icon: '☀️' }
];

function getCategoryIcon(catName) {
  const found = categories.find(c => c.name === catName);
  return found ? found.icon : '📰';
}

/* ===== DOM Loaded Initialization ===== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderCategoryNav();
  renderHeaderUserUI();
  setupEventListeners();

  // 서버에서 기사 목록 불러오기
  fetchArticles();

  // 실시간 날씨 데이터 수신
  fetchWeatherAndAutoCreateNews();
});

/* ===== 관리자 여부 확인 함수 ===== */
function checkIsAdmin() {
  return currentUser && (currentUser.username === ADMIN_USERNAME || currentUser.name === '관리자');
}

/* ===== Theme Control (다크/라이트 모드) ===== */
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

/* ===== 서버 API 연동 함수 (Fetch Articles) ===== */
async function fetchArticles() {
  try {
    const res = await fetch(`${API_BASE}/articles`);
    if (!res.ok) throw new Error('목록 조회 실패');
    articles = await res.json();
    renderArticles();
  } catch (err) {
    console.error('기사 목록 불러오기 오류:', err);
    showToast('기사 목록을 불러오지 못했습니다.', 'error');
  }
}

/* ===== Weather Integration ===== */
async function fetchWeatherAndAutoCreateNews() {
  let lat = 37.5665;
  let lon = 126.9780;
  let regionName = "내 지역";

  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 1500 });
      });
      lat = position.coords.latitude;
      lon = position.coords.longitude;
    } catch (e) {
      regionName = "전국";
    }
  }

  try {
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const weatherData = await weatherRes.json();

    if (regionName === "내 지역") {
      try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`);
        const geoData = await geoRes.json();
        regionName = geoData.city || geoData.principalSubdivision || geoData.locality || "내 지역";
      } catch (e) {
        regionName = "내 지역";
      }
    }

    if (weatherData && weatherData.current_weather) {
      const weather = weatherData.current_weather;
      const weatherText = getWeatherStatusText(weather.weathercode);
      const temp = weather.temperature;
      const wind = weather.windspeed;

      renderWeatherWidget(regionName, temp, weatherText, wind);
    }
  } catch (err) {
    console.error('날씨 데이터 불러오기 실패:', err);
  }
}

function getWeatherStatusText(code) {
  if (code === 0) return '맑음 ☀️';
  if (code <= 3) return '구름 조금/흐림 ⛅';
  if (code <= 48) return '안개 🌫️';
  if (code <= 67) return '비 🌧️';
  if (code <= 77) return '눈 ❄️';
  return '소나기/강우 🌧️';
}

function renderWeatherWidget(region, temp, text, wind) {
  let widget = document.getElementById('weatherWidget');
  if (!widget) {
    const grid = document.getElementById('articlesGrid');
    if (grid) {
      widget = document.createElement('div');
      widget.id = 'weatherWidget';
      grid.parentNode.insertBefore(widget, grid);
    }
  }

  if (widget) {
    widget.innerHTML = `
      <div style="background: var(--bg-card); color: var(--text-primary); padding: 18px 24px; border-radius: 12px; margin: 20px 0; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-color);">
        <div>
          <span style="font-size: 0.85rem; color: #fbbf24; font-weight: bold;">☀️ 실시간 기상청 날씨 정보 (${region})</span>
          <h3 style="margin: 4px 0 0 0; font-size: 1.3rem;">현재 기온 ${temp}°C (${text})</h3>
        </div>
        <div style="text-align: right; font-size: 0.9rem; color: var(--text-secondary);">
          풍속: ${wind} km/h<br>
          <span style="font-size: 0.75rem; color: #34d399;">● GPS 위치 수신됨</span>
        </div>
      </div>
    `;
  }
}

/* ===== Global Modal Control Functions ===== */
window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active', 'open', 'show');
    modal.style.display = 'none';
  }
};

window.openLoginModal = function () {
  const modal = document.getElementById('loginModal');
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

  if (articleId && !checkIsAdmin()) {
    showToast('기사 수정은 관리자만 가능합니다.', 'error');
    return;
  }

  const modal = document.getElementById('writeModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('articleForm');

  editingArticleId = articleId;

  if (articleId) {
    const article = articles.find(a => a.id === Number(articleId));
    if (article) {
      if (title) title.textContent = '✏️ 기사 수정 (관리자)';
      if (document.getElementById('artTitle')) document.getElementById('artTitle').value = article.title;
      if (document.getElementById('artCategory')) document.getElementById('artCategory').value = article.category;
      if (document.getElementById('artAuthor')) document.getElementById('artAuthor').value = article.author;
      if (document.getElementById('artContent')) document.getElementById('artContent').value = article.content;
    }
  } else {
    if (title) title.textContent = '✍️ 새 기사 작성';
    if (form) form.reset();
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

/* ===== 기사 상세보기 모달 ===== */
window.openDetailModal = function (articleId) {
  const article = articles.find(a => a.id === Number(articleId));
  if (!article) return;

  const modal = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  const icon = getCategoryIcon(article.category);
  const isAdmin = checkIsAdmin();

  if (detailContent) {
    detailContent.innerHTML = `
      <div style="margin-bottom: 12px;">
        <span class="badge" style="background: rgba(255,255,255,0.08); border:1px solid var(--border-color); color: var(--accent-gold); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem;">${icon} ${article.category}</span>
      </div>
      <h2 style="font-size: 1.5rem; margin-bottom: 12px; line-height: 1.4; font-weight: 700;">${article.title}</h2>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <span>작성자: <strong style="color: var(--text-primary);">${article.author}</strong></span>
        <span>•</span>
        <span>${article.date}</span>
      </div>
      <div style="font-size: 1rem; color: var(--text-secondary); line-height: 1.8; white-space: pre-line; margin-bottom: 24px;">${article.content}</div>

      <!-- 오직 관리자 계정일 때만 표시되는 버튼 -->
      ${isAdmin ? `
        <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <button class="btn btn-ghost" onclick="editArticle(${article.id}, event)" style="font-size: 0.85rem; padding: 8px 14px;">✏️ 기사 수정</button>
          <button class="btn" onclick="deleteArticle(${article.id}, event)" style="background: rgba(232,85,85,0.15); color: #f87171; border: 1px solid rgba(232,85,85,0.3); font-size: 0.85rem; padding: 8px 14px;">🗑️ 기사 삭제</button>
        </div>
      ` : ''}
    `;
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
};

window.closeDetailModal = function () {
  window.closeModal('detailModal');
};

/* ===== Category Navigation & Render ===== */
function renderCategoryNav() {
  const catNav = document.getElementById('categoryNav');
  if (!catNav) return;

  catNav.innerHTML = categories.map(cat => `
    <button 
      class="cat-btn ${cat.name === currentCategory ? 'active' : ''}" 
      data-category="${cat.name}"
      onclick="setCategory('${cat.name}')"
    >
      <span class="cat-icon">${cat.icon}</span> ${cat.name}
    </button>
  `).join('');
}

window.setCategory = function (category) {
  currentCategory = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderArticles();
};

/* ===== Articles Render ===== */
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

  const isAdmin = checkIsAdmin();

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="text-align:center; padding: 40px; width: 100%;">
        <div style="font-size: 3rem;">📰</div>
        <h3>등록된 기사가 없습니다</h3>
        <button class="btn btn-gold" onclick="openWriteModal()" style="margin-top:12px;">첫 기사 작성하기</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(article => {
    const icon = getCategoryIcon(article.category);
    return `
      <div class="article-card" onclick="openDetailModal(${article.id})" style="cursor:pointer;">
        <div class="article-card-body" style="padding: 16px;">
          <span class="badge badge-${article.category}">${icon} ${article.category}</span>
          <h3 class="article-card-title" style="margin: 10px 0; font-size: 1.1rem;">${article.title}</h3>
          <p class="article-card-excerpt" style="color:var(--text-secondary); font-size:0.9rem;">${article.summary || article.content.substring(0, 60)}...</p>
          <div class="article-card-meta" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted);">
            <div>
              <span>${article.author}</span> • <span>${article.date}</span>
            </div>

            <!-- 관리자만 보는 수정/삭제 버튼 -->
            ${isAdmin ? `
              <div style="display:flex; gap:6px;">
                <button class="action-btn edit" onclick="editArticle(${article.id}, event)" title="수정" style="padding: 3px 7px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer;">✏️</button>
                <button class="action-btn delete" onclick="deleteArticle(${article.id}, event)" title="삭제" style="padding: 3px 7px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer;">🗑️</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== 기사 삭제 (서버 API 연동) ===== */
window.deleteArticle = async function (id, event) {
  if (event) event.stopPropagation();

  if (!checkIsAdmin()) {
    showToast('관리자만 기사를 삭제할 수 있습니다.', 'error');
    return;
  }

  if (!confirm('정말 이 기사를 삭제하시겠습니까?')) return;

  try {
    const res = await fetch(`${API_BASE}/articles/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('게시글이 삭제되었습니다.', 'info');
    closeDetailModal();
    fetchArticles();
  } catch (err) {
    showToast(err.message || '삭제에 실패했습니다.', 'error');
  }
};

/* ===== 기사 수정 ===== */
window.editArticle = function (id, event) {
  if (event) event.stopPropagation();

  if (!checkIsAdmin()) {
    showToast('관리자만 기사를 수정할 수 있습니다.', 'error');
    return;
  }

  closeDetailModal();
  window.openWriteModal(id);
};

/* ===== Header UI Render ===== */
function renderHeaderUserUI() {
  const userArea = document.getElementById('userArea');
  const loginBtn = document.getElementById('loginBtn');
  const writeBtn = document.getElementById('writeBtn');

  const isAdmin = checkIsAdmin();

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userArea) {
      userArea.style.display = 'flex';
      document.getElementById('userNameDisplay').textContent = `${currentUser.name} (${currentUser.username})`;
    }
    if (writeBtn) writeBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userArea) userArea.style.display = 'none';
    if (writeBtn) writeBtn.style.display = 'none';
  }
}

/* ===== Event Listeners Setup ===== */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderArticles();
    });
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        window.closeModal(overlay.id);
      }
    });
  });

  // 로그인 폼 제출 (서버 API 호출)
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('loginId');
      const passwordInput = document.getElementById('loginPassword');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        showToast('아이디와 비밀번호를 모두 입력해주세요.', 'error');
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

        // 로그인 성공 시 토큰과 유저 정보 저장
        token = data.token;
        currentUser = data.user;

        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        renderHeaderUserUI();
        renderArticles();
        closeLoginModal();

        showToast(`${currentUser.name}님 환영합니다!`, 'success');
      } catch (err) {
        showToast(err.message || '로그인 실패', 'error');
      }
    });
  }

  // 기사 작성 및 수정 (서버 API 호출)
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

/* ===== Logout ===== */
window.logout = function () {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  renderHeaderUserUI();
  renderArticles();
  showToast('로그아웃 되었습니다.', 'info');
};

/* ===== Toast Message ===== */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cssText = "padding: 12px 20px; margin-top: 10px; background: #1e293b; color: #fff; border-radius: 8px; font-size: 0.9rem; position: fixed; bottom: 20px; right: 20px; z-index: 9999; border: 1px solid rgba(255,255,255,0.1);";
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
