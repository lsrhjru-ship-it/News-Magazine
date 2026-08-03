// ===== 허가된 작성자 계정 목록 =====
// 이 목록에 있는 아이디/비밀번호를 가진 사람만 기사를 작성/수정/삭제할 수 있습니다.
// 계정 추가 시 { id: '아이디', pw: '비밀번호', name: '표시이름' } 형식으로 추가하세요.
const ALLOWED_WRITERS = [
  { id: 'lsrhjru', pw: 'lsr37733*', name: '관리자' },
  // 여기에 계정을 추가하세요
];

// ===== App State =====
const state = {
  articles: [],
  currentCategory: '전체',
  searchQuery: '',
  editingId: null,
  currentImage: null,
  currentUser: null,   // 로그인한 사용자 { id, name }
};

const CATEGORIES = ['전체', '날씨', '게임', 'SNS', '스포츠'];

const CATEGORY_EMOJIS = {
  '날씨': '🌤️', '게임': '🎮', 'SNS': '📱', '스포츠': '⚽', '전체': '📰'
};

// ===== Utility Functions =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function badgeClass(cat) {
  return 'badge badge-' + cat;
}

function getPlaceholder(cat) {
  return CATEGORY_EMOJIS[cat] || '📰';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Storage =====
function saveArticles() {
  localStorage.setItem('newsArticles', JSON.stringify(state.articles));
}

function loadArticles() {
  try {
    const data = localStorage.getItem('newsArticles');
    state.articles = data ? JSON.parse(data) : [];
  } catch {
    state.articles = [];
  }
}

// ===== Auth =====
function loadSession() {
  try {
    const saved = sessionStorage.getItem('newsUser');
    if (saved) state.currentUser = JSON.parse(saved);
  } catch { state.currentUser = null; }
}

function isLoggedIn() {
  return !!state.currentUser;
}

function openLoginModal() {
  document.getElementById('loginId').value = '';
  document.getElementById('loginPw').value = '';
  document.getElementById('loginError').style.display = 'none';
  openModal('loginModal');
  setTimeout(() => document.getElementById('loginId').focus(), 100);
}

function closeLoginModal() {
  closeModal('loginModal');
}

function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('loginId').value.trim();
  const pw = document.getElementById('loginPw').value;
  const user = ALLOWED_WRITERS.find(u => u.id === id && u.pw === pw);
  if (user) {
    state.currentUser = { id: user.id, name: user.name };
    sessionStorage.setItem('newsUser', JSON.stringify(state.currentUser));
    closeLoginModal();
    updateAuthUI();
    renderAll();
    showToast(`${user.name}님, 환영합니다! 🎉`, 'success');
  } else {
    const err = document.getElementById('loginError');
    err.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
    err.style.display = 'block';
    document.getElementById('loginPw').value = '';
    document.getElementById('loginPw').focus();
  }
}

function logout() {
  const name = state.currentUser?.name;
  state.currentUser = null;
  sessionStorage.removeItem('newsUser');
  updateAuthUI();
  renderAll();
  showToast(`${name}님이 로그아웃했습니다.`, 'info');
}

function updateAuthUI() {
  const writeBtn = document.getElementById('writeBtn');
  const userArea = document.getElementById('userArea');
  const loginBtn = document.getElementById('loginBtn');

  if (isLoggedIn()) {
    writeBtn.style.display = 'inline-flex';
    userArea.style.display = 'flex';
    document.getElementById('userNameDisplay').textContent = state.currentUser.name;
    loginBtn.style.display = 'none';
  } else {
    writeBtn.style.display = 'none';
    userArea.style.display = 'none';
    loginBtn.style.display = 'inline-flex';
  }
}

// ===== Toast =====
function showToast(message, type = 'info', icon = '📢') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// ===== Render =====
function renderCategoryNav() {
  const nav = document.getElementById('categoryNav');
  nav.innerHTML = CATEGORIES.map(cat => `
    <button class="cat-btn ${cat === state.currentCategory ? 'active' : ''}"
      onclick="selectCategory('${cat}')">
      ${CATEGORY_EMOJIS[cat]} ${cat}
    </button>
  `).join('');
}

function getFilteredArticles() {
  let articles = [...state.articles];
  if (state.currentCategory !== '전체') {
    articles = articles.filter(a => a.category === state.currentCategory);
  }
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.author.toLowerCase().includes(q)
    );
  }
  return articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderStats() {
  const bar = document.getElementById('statsBar');
  const total = state.articles.length;
  const today = state.articles.filter(a => {
    const d = new Date(a.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const catCounts = {};
  CATEGORIES.slice(1).forEach(c => {
    catCounts[c] = state.articles.filter(a => a.category === c).length;
  });
  const top = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

  bar.innerHTML = `
    <div class="stat-item"><span class="live-dot"></span> <span>LIVE</span></div>
    <div class="stat-item">총 기사 <span class="stat-value">${total}</span>건</div>
    <div class="stat-item">오늘 등록 <span class="stat-value">${today}</span>건</div>
    ${top ? `<div class="stat-item">인기 카테고리 <span class="stat-value">${top[0]}</span></div>` : ''}
    <div class="stat-item">현재 시간 <span class="stat-value">${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></div>
  `;
}

function buildCardImg(article, cls = 'article-card-img') {
  if (article.image) {
    return `<img src="${article.image}" alt="${escapeHtml(article.title)}" class="${cls}" loading="lazy">`;
  }
  return `<div class="article-card-img-placeholder" style="font-size:48px">${getPlaceholder(article.category)}</div>`;
}

function renderHeroSection(articles) {
  const hero = document.getElementById('heroSection');
  if (articles.length === 0) {
    hero.innerHTML = '';
    return;
  }
  const main = articles[0];
  const sides = articles.slice(1, 3);

  const mainImg = main.image
    ? `<img src="${main.image}" alt="${escapeHtml(main.title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;background:linear-gradient(135deg,#0f1525,#1a2035)">${getPlaceholder(main.category)}</div>`;

  hero.innerHTML = `
    <div class="hero-card fade-in-up" onclick="openDetail('${main.id}')">
      ${mainImg}
      <div class="hero-card-content">
        <div class="hero-badge"><span class="${badgeClass(main.category)}">${main.category}</span></div>
        <div class="hero-title">${escapeHtml(main.title)}</div>
        <div class="hero-excerpt">${escapeHtml(main.content.slice(0, 120))}${main.content.length > 120 ? '...' : ''}</div>
        <div class="hero-meta">
          <span>✍️ ${escapeHtml(main.author)}</span>
          <span>·</span>
          <span>🕐 ${formatDate(main.createdAt)}</span>
        </div>
      </div>
    </div>
    ${sides.length > 0 ? `
    <div class="hero-side">
      ${sides.map(a => `
        <div class="side-card fade-in-up" onclick="openDetail('${a.id}')">
          ${a.image
      ? `<img src="${a.image}" alt="${escapeHtml(a.title)}" class="side-card-img" loading="lazy">`
      : `<div class="side-card-img-placeholder">${getPlaceholder(a.category)}</div>`
    }
          <div class="side-card-body">
            <span class="${badgeClass(a.category)}" style="font-size:10px;padding:2px 8px">${a.category}</span>
            <div class="side-card-title" style="margin-top:6px">${escapeHtml(a.title)}</div>
            <div class="side-card-meta">🕐 ${formatDate(a.createdAt)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}

function renderArticleGrid(articles) {
  const grid = document.getElementById('articlesGrid');
  const gridArticles = articles.slice(articles.length < 4 ? 0 : 3);

  if (articles.length === 0) {
    const isSearch = state.searchQuery.trim() || state.currentCategory !== '전체';
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isSearch ? '🔍' : '📭'}</div>
        <div class="empty-title">${isSearch ? '검색 결과가 없습니다' : '아직 기사가 없습니다'}</div>
        <div class="empty-desc">${isSearch ? '다른 검색어를 입력해 보세요.' : '첫 번째 기사를 작성해 보세요!'}</div>
        ${!isSearch ? `<button class="btn btn-gold" onclick="openWriteModal()">✍️ <span>기사 작성하기</span></button>` : ''}
      </div>
    `;
    return;
  }

  grid.innerHTML = gridArticles.map((article, i) => `
    <div class="article-card fade-in-up" style="animation-delay:${i * 0.07}s" onclick="openDetail('${article.id}')">
      <div class="article-card-img-container">
        ${buildCardImg(article)}
      </div>
      <div class="article-card-body">
        <span class="${badgeClass(article.category)}">${article.category}</span>
        <div class="article-card-title">${escapeHtml(article.title)}</div>
        <div class="article-card-excerpt">${escapeHtml(article.content.slice(0, 100))}${article.content.length > 100 ? '...' : ''}</div>
        <div class="article-card-meta">
          <div class="article-card-meta-left">
            <span>✍️ ${escapeHtml(article.author)}</span>
            <span class="meta-dot"></span>
            <span>🕐 ${formatDate(article.createdAt)}</span>
          </div>
          ${isLoggedIn() ? `
          <div class="article-card-actions" onclick="event.stopPropagation()">
            <button class="action-btn edit" onclick="openEditModal('${article.id}')" title="수정">✏️</button>
            <button class="action-btn delete" onclick="deleteArticle('${article.id}')" title="삭제">🗑️</button>
          </div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderAll() {
  const filtered = getFilteredArticles();
  renderHeroSection(filtered);
  renderArticleGrid(filtered);
  renderStats();
  updateSearchStatus(filtered.length);
}

function updateSearchStatus(count) {
  const el = document.getElementById('searchStatus');
  if (state.searchQuery || state.currentCategory !== '전체') {
    el.textContent = `"${state.currentCategory !== '전체' ? state.currentCategory : ''}${state.searchQuery ? ` ${state.searchQuery}` : ''}" 검색 결과 ${count}건`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

// ===== Category & Search =====
function selectCategory(cat) {
  state.currentCategory = cat;
  renderCategoryNav();
  renderAll();
}

function handleSearch(e) {
  state.searchQuery = e.target.value;
  renderAll();
}

// ===== Modal Controls =====
function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ===== Write / Edit Modal =====
function openWriteModal() {
  if (!isLoggedIn()) {
    openLoginModal();
    return;
  }
  state.editingId = null;
  state.currentImage = null;
  document.getElementById('modalTitle').textContent = '✍️ 새 기사 작성';
  document.getElementById('articleForm').reset();
  // 작성자 이름 자동 입력
  document.getElementById('artAuthor').value = state.currentUser.name;
  clearImagePreview();
  openModal('writeModal');
}

function openEditModal(id) {
  if (!isLoggedIn()) { openLoginModal(); return; }
  const article = state.articles.find(a => a.id === id);
  if (!article) return;
  state.editingId = id;
  state.currentImage = article.image || null;

  document.getElementById('modalTitle').textContent = '✏️ 기사 수정';
  document.getElementById('artTitle').value = article.title;
  document.getElementById('artCategory').value = article.category;
  document.getElementById('artAuthor').value = article.author;
  document.getElementById('artContent').value = article.content;

  if (article.image) {
    showImagePreview(article.image);
  } else {
    clearImagePreview();
  }
  openModal('writeModal');
}

function closeWriteModal() {
  closeModal('writeModal');
  state.editingId = null;
  state.currentImage = null;
}

// ===== Image Handling =====
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 업로드 가능합니다.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('파일 크기는 5MB 이하여야 합니다.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.currentImage = ev.target.result;
    showImagePreview(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  document.getElementById('uploadArea').style.display = 'none';
  const preview = document.getElementById('imagePreviewContainer');
  preview.style.display = 'block';
  document.getElementById('imagePreview').src = src;
}

function clearImagePreview() {
  state.currentImage = null;
  document.getElementById('uploadArea').style.display = 'block';
  const preview = document.getElementById('imagePreviewContainer');
  preview.style.display = 'none';
  document.getElementById('imagePreview').src = '';
  document.getElementById('imageInput').value = '';
}

// Drag and drop
const uploadArea = () => document.getElementById('uploadArea');

function initDragDrop() {
  const area = document.getElementById('uploadArea');
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('imageInput').files = dt.files;
      handleImageUpload({ target: { files: [file] } });
    }
  });
}

// ===== Article CRUD =====
function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('artTitle').value.trim();
  const category = document.getElementById('artCategory').value;
  const author = document.getElementById('artAuthor').value.trim();
  const content = document.getElementById('artContent').value.trim();

  if (!title || !content || !author) {
    showToast('제목, 작성자, 내용을 모두 입력해주세요.', 'error');
    return;
  }

  if (state.editingId) {
    const idx = state.articles.findIndex(a => a.id === state.editingId);
    if (idx !== -1) {
      state.articles[idx] = {
        ...state.articles[idx],
        title, category, author, content,
        image: state.currentImage,
        updatedAt: new Date().toISOString(),
      };
      showToast('기사가 수정되었습니다!', 'success');
    }
  } else {
    const article = {
      id: generateId(),
      title, category, author, content,
      image: state.currentImage,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    state.articles.unshift(article);
    showToast('기사가 등록되었습니다!', 'success');
  }

  saveArticles();
  closeWriteModal();
  renderAll();
}

function deleteArticle(id) {
  if (!isLoggedIn()) { showToast('로그인이 필요합니다.', 'error'); return; }
  if (!confirm('이 기사를 삭제하시겠습니까?')) return;
  state.articles = state.articles.filter(a => a.id !== id);
  saveArticles();
  renderAll();

  // Close detail if open
  const detailOverlay = document.getElementById('detailModal');
  if (detailOverlay.classList.contains('active')) {
    closeModal('detailModal');
  }

  showToast('기사가 삭제되었습니다.', 'info');
}

// ===== Detail Modal =====
function openDetail(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article) return;

  const detail = document.getElementById('detailContent');
  detail.innerHTML = `
    ${article.image ? `<img src="${article.image}" alt="${escapeHtml(article.title)}" class="detail-hero-img">` : ''}
    <div class="detail-body">
      <div class="detail-category">
        <span class="${badgeClass(article.category)}">${article.category}</span>
      </div>
      <h1 class="detail-title">${escapeHtml(article.title)}</h1>
      <div class="detail-meta">
        <div class="detail-meta-item">✍️ <strong>${escapeHtml(article.author)}</strong></div>
        <div class="detail-meta-item">🕐 ${formatDate(article.createdAt)}</div>
        ${article.updatedAt ? `<div class="detail-meta-item">🔄 ${formatDate(article.updatedAt)} 수정됨</div>` : ''}
      </div>
      <div class="detail-content">${escapeHtml(article.content)}</div>
      ${isLoggedIn() ? `
      <div style="display:flex;gap:12px;margin-top:32px;padding-top:20px;border-top:1px solid var(--border-color)">
        <button class="btn btn-ghost" onclick="openEditModal('${article.id}');closeModal('detailModal')">✏️ 수정하기</button>
        <button class="btn btn-ghost" style="color:var(--accent-red)" onclick="deleteArticle('${article.id}')">🗑️ 삭제하기</button>
      </div>` : ''}
    </div>
  `;

  openModal('detailModal');
}

// ===== Theme Toggle =====
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isLight ? '🌙' : '☀️';
}

// ===== Sample Data =====
function insertSampleData() {
  if (state.articles.length > 0) return;
  const samples = [
    {
      title: '글로벌 AI 기업들, 차세대 언어모델 경쟁 본격화',
      category: 'SNS',
      author: '이기자',
      content: `세계 주요 인공지능 기업들이 차세대 대규모 언어모델(LLM) 개발을 위한 경쟁에 본격적으로 돌입했다. OpenAI, Google DeepMind, Anthropic 등 빅테크 기업들은 올해 하반기 새로운 모델 출시를 예고하며 시장 주도권 확보에 나서고 있다.

업계 전문가들은 이번 경쟁이 단순한 성능 향상을 넘어 에이전트 AI와 멀티모달 처리 능력에 초점이 맞춰질 것이라고 전망했다. 특히 실시간 추론과 장문 맥락 처리 능력이 핵심 차별화 요소가 될 것으로 보인다.

국내 AI 스타트업들도 이에 뒤질세라 한국어 특화 모델 개발에 박차를 가하고 있으며, 정부의 AI 원천기술 지원 예산도 대폭 증가했다.`,
      image: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      title: '파리 올림픽 특수…국내 스포츠 산업 활성화 기대',
      category: '스포츠',
      author: '최기자',
      content: `파리 올림픽 개막을 앞두고 국내 스포츠 산업에 대한 기대감이 높아지고 있다. 주요 스포츠 브랜드와 중계 플랫폼의 광고 수익이 전년 대비 40% 이상 증가할 것으로 전망된다.

대한민국 선수단은 이번 대회에서 금메달 10개 이상을 목표로 하고 있으며, 양궁·사격·유도 종목에서 강세를 보일 것으로 기대된다. 국민 응원 열기도 뜨겁게 달아오르고 있어 관련 용품 판매도 급증세다.`,
      image: null,
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      title: '국립현대미술관, 한국 현대작가 특별전 개막',
      category: '게임',
      author: '김기자',
      content: `국립현대미술관 서울관에서 한국 현대작가 40인의 작품을 한자리에 모은 특별전이 개막했다. 이번 전시는 1990년대부터 현재까지 한국 현대미술의 흐름을 조망하는 대규모 기획전으로, 회화·설치·미디어아트 등 다양한 장르의 작품 200여 점이 전시된다.

큐레이터 이지영 씨는 "이번 전시를 통해 세계 미술계에서 K-아트의 위상을 재확인하는 계기가 될 것"이라고 밝혔다. 전시는 오는 10월 말까지 진행되며 입장료는 무료다.`,
      image: null,
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
  ];

  state.articles = samples.map(s => ({ ...s, id: generateId(), updatedAt: null }));
  saveArticles();
}

// ===== Init =====
function init() {
  loadArticles();
  loadSession();

  // Theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('themeBtn').textContent = '🌙';
  }

  insertSampleData();
  renderCategoryNav();
  updateAuthUI();
  renderAll();
  initDragDrop();

  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  // Form submit
  document.getElementById('articleForm').addEventListener('submit', handleFormSubmit);

  // Login form submit
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Close modals on backdrop click
  document.getElementById('writeModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('writeModal')) closeWriteModal();
  });
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('detailModal')) closeModal('detailModal');
  });
  document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('loginModal')) closeLoginModal();
  });

  // Image input
  document.getElementById('imageInput').addEventListener('change', handleImageUpload);

  // Update time every minute
  setInterval(() => renderStats(), 60000);
}

document.addEventListener('DOMContentLoaded', init);