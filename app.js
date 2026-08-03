/* ===== App State ===== */
let articles = JSON.parse(localStorage.getItem('articles')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;
let currentWeather = null;

// 카테고리 & 이모지 데이터 정의 (IT과학->게임, 경제->SNS, 사회->기상청, 문화 삭제)
const categories = [
  { name: '전체', icon: '🌐' },
  { name: '게임', icon: '🎮' },
  { name: 'SNS', icon: '📱' },
  { name: '기상청', icon: '☀️' }
];

/* ===== Helper Function ===== */
function getCategoryIcon(catName) {
  const found = categories.find(c => c.name === catName);
  return found ? found.icon : '📰';
}

/* ===== DOM Loaded Initialization ===== */
document.addEventListener('DOMContentLoaded', async () => {
  renderCategoryNav();
  renderHeaderUserUI();
  setupEventListeners();
  
  // 날씨 데이터 및 기상청 자동 뉴스 생성 실행
  await fetchWeatherAndAutoCreateNews();
  renderArticles();
});

/* ===== Weather & Weather News Integration ===== */
async function fetchWeatherAndAutoCreateNews() {
  try {
    // 대한민국 울산/서울 기준 기상청 데이터 요청 (Open-Meteo Free API)
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.5383&longitude=129.3114&current_weather=true');
    const data = await res.json();

    if (data && data.current_weather) {
      const weather = data.current_weather;
      currentWeather = weather;

      // 날씨 상태 매핑
      const weatherText = getWeatherStatusText(weather.weathercode);
      const temp = weather.temperature;
      const wind = weather.windspeed;
      const todayStr = new Date().toISOString().split('T')[0];

      // 사이트 중간 날씨 위젯 렌더링
      renderWeatherWidget(temp, weatherText, wind);

      // 오늘 날짜 기상청 자동 속보 기사가 없으면 자동으로 등록
      const hasTodayWeatherNews = articles.some(a => a.category === '기상청' && a.date === todayStr && a.isAuto);

      if (!hasTodayWeatherNews) {
        const weatherArticle = {
          id: Date.now(),
          title: `[기상청 속보] 오늘 현재 기온 ${temp}°C, 날씨 상태는 '${weatherText}'입니다.`,
          category: '기상청',
          excerpt: `기상청 발표: 현재 풍속 ${wind}km/h이며, 야외 활동 시 참고 바랍니다.`,
          content: `기상청에서 발표한 실시간 날씨 데이터입니다.\n\n- 현재 기온: ${temp}°C\n- 날씨 상태: ${weatherText}\n- 풍속: ${wind} km/h\n\n지속적으로 최신 기상 정보를 업데이트해 드립니다.`,
          author: '기상청 자동시스템',
          date: todayStr,
          views: 1,
          isAuto: true,
          image: 'https://images.unsplash.com/photo-1592210454359-9043f067919b?w=800&q=80'
        };

        articles.unshift(weatherArticle);
        localStorage.setItem('articles', JSON.stringify(articles));
      }
    }
  } catch (err) {
    console.error('날씨 불러오기 실패:', err);
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

function renderWeatherWidget(temp, text, wind) {
  let widget = document.getElementById('weatherWidget');
  if (!widget) {
    // 위젯이 HTML에 없을 경우 articlesGrid 상단에 자동 생성
    const grid = document.getElementById('articlesGrid');
    if (grid) {
      widget = document.createElement('div');
      widget.id = 'weatherWidget';
      grid.parentNode.insertBefore(widget, grid);
    }
  }

  if (widget) {
    widget.innerHTML = `
      <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 18px 24px; border-radius: 12px; margin: 20px 0; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,0.1);">
        <div>
          <span style="font-size: 0.85rem; color: #fbbf24; font-weight: bold;">☀️ 실시간 기상청 날씨 정보</span>
          <h3 style="margin: 4px 0 0 0; font-size: 1.3rem;">울산/전국 기온 ${temp}°C (${text})</h3>
        </div>
        <div style="text-align: right; font-size: 0.9rem; color: #94a3b8;">
          풍속: ${wind} km/h<br>
          <span style="font-size: 0.75rem; color: #34d399;">● 자동 업데이트 완료</span>
        </div>
      </div>
    `;
  }
}

/* ===== Global Functions ===== */

// 1. 카테고리 바 생성
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

// 2. 모달 제어
window.openLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('active');
};

window.closeLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('active');
};

window.openWriteModal = function (articleId = null) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('관리자만 기사를 작성/수정할 수 있습니다.', 'error');
    return;
  }

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
  const icon = getCategoryIcon(article.category);

  if (body) {
    body.innerHTML = `
      ${article.image ? `<img src="${article.image}" class="detail-hero-img" alt="${article.title}">` : ''}
      <div class="detail-body">
        <div class="detail-category">
          <span class="badge badge-${article.category}">${icon} ${article.category}</span>
        </div>
        <h2 class="detail-title">${article.title}</h2>
        <div class="detail-meta">
          <span>작성자: <strong>${article.author}</strong></span>
          <span>•</span>
          <span>${article.date}</span>
          <span>•</span>
          <span>조회수 ${article.views}</span>
        </div>
        <div class="detail-content" style="white-space: pre-line;">${article.content}</div>
      </div>
    `;
  }

  if (modal) modal.classList.add('active');
};

window.closeDetailModal = function () {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('active');
};

// 3. 기사 삭제 및 수정
window.deleteArticle = function (id, event) {
  if (event) event.stopPropagation();

  if (!currentUser || currentUser.role !== 'admin') {
    showToast('관리자만 기사를 삭제할 수 있습니다.', 'error');
    return;
  }

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

/* ===== UI Render Functions ===== */
function renderHeaderUserUI() {
  const container = document.getElementById('userAuthContainer');
  if (!container) return;

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (currentUser) {
    container.innerHTML = `
      ${isAdmin ? `<button class="btn btn-gold" onclick="openWriteModal()">✏️ 기사 작성</button>` : ''}
      <div class="user-badge">
        <span class="user-avatar">${isAdmin ? '👑' : '👤'}</span>
        <span class="user-name">${currentUser.name} ${isAdmin ? '(관리자)' : ''}</span>
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

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <div class="empty-title">등록된 기사가 없습니다</div>
        <div class="empty-desc">${isAdmin ? '새 기사 작성 버튼을 눌러 첫 기사를 작성해 보세요!' : '기사가 아직 등록되지 않았습니다.'}</div>
        ${isAdmin ? `<button class="btn btn-gold" onclick="openWriteModal()">기사 작성하기</button>` : ''}
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(article => {
    const icon = getCategoryIcon(article.category);
    return `
      <div class="article-card fade-in-up" onclick="openDetailModal(${article.id})">
        <div class="article-card-img-container">
          ${article.image 
            ? `<img src="${article.image}" class="article-card-img" alt="${article.title}">`
            : `<div class="article-card-img-placeholder">${icon}</div>`
          }
        </div>
        <div class="article-card-body">
          <span class="badge badge-${article.category}">${icon} ${article.category}</span>
          <h3 class="article-card-title">${article.title}</h3>
          <p class="article-card-excerpt">${article.excerpt || article.content.substring(0, 60)}...</p>
          <div class="article-card-meta">
            <div class="article-card-meta-left">
              <span>${article.author}</span>
              <span class="meta-dot"></span>
              <span>${article.date}</span>
            </div>
            ${isAdmin ? `
              <div class="article-card-actions">
                <button class="action-btn edit" onclick="editArticle(${article.id}, event)" title="수정">✏️</button>
                <button class="action-btn delete" onclick="deleteArticle(${article.id}, event)" title="삭제">🗑️</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
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

  // 로그인 폼
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      if (!username) return;

      const role = (username.toLowerCase() === 'admin' || username === '관리자') ? 'admin' : 'user';

      currentUser = { name: username, role: role };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      renderHeaderUserUI();
      renderArticles();
      closeLoginModal();
      
      showToast(`${username}님 환영합니다! ${role === 'admin' ? '(관리자 권한)' : ''}`, 'success');
    });
  }

  // 기사 작성/수정 폼 (파일 직접 업로드 처리 포함)
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser || currentUser.role !== 'admin') {
        showToast('관리자 권한이 필요합니다.', 'error');
        return;
      }

      const title = document.getElementById('inputTitle').value;
      const category = document.getElementById('selectCategory').value;
      const excerpt = document.getElementById('inputExcerpt').value;
      const content = document.getElementById('textContent').value;
      const urlImage = document.getElementById('inputImageUrl') ? document.getElementById('inputImageUrl').value : '';
      const fileInput = document.getElementById('inputImageFile');

      let finalImage = urlImage;

      // 컴퓨터에서 첨부한 사진 파일이 있을 경우 Base64 인코딩 변환
      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          finalImage = await readImageFile(fileInput.files[0]);
        } catch (err) {
          console.error('파일 업로드 오류', err);
        }
      }

      if (editingArticleId) {
        articles = articles.map(a => {
          if (a.id === editingArticleId) {
            return { ...a, title, category, excerpt, content, image: finalImage || a.image };
          }
          return a;
        });
        showToast('기사가 수정되었습니다.', 'success');
      } else {
        const newArticle = {
          id: Date.now(),
          title,
          category,
          excerpt,
          content,
          image: finalImage,
          author: currentUser.name,
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

// 이미지 파일을 Read
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// 로그아웃
window.logout = function () {
  currentUser = null;
  localStorage.removeItem('currentUser');
  renderHeaderUserUI();
  renderArticles();
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
