/* ===== App State ===== */
let articles = JSON.parse(localStorage.getItem('articles')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;
let currentWeather = null;

// 카테고리 데이터 (IT과학->게임, 경제->SNS, 사회->기상청, 문화 삭제)
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
  
  // 실시간 사용자 위치 감지 및 날씨/뉴스 렌더링
  await fetchWeatherAndAutoCreateNews();
  renderArticles();
});

/* ===== Weather & Location Integration ===== */
async function fetchWeatherAndAutoCreateNews() {
  let lat = 37.5665;
  let lon = 126.9780;
  let regionName = "내 지역";

  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
      });
      lat = position.coords.latitude;
      lon = position.coords.longitude;
    } catch (e) {
      console.log('위치 권한 거부 또는 감지 실패. 기본 위치로 동작합니다.');
      regionName = "서울/전국";
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
      currentWeather = weather;

      const weatherText = getWeatherStatusText(weather.weathercode);
      const temp = weather.temperature;
      const wind = weather.windspeed;
      const todayStr = new Date().toISOString().split('T')[0];

      renderWeatherWidget(regionName, temp, weatherText, wind);

      const hasTodayWeatherNews = articles.some(a => a.category === '기상청' && a.date === todayStr && a.isAuto);

      if (!hasTodayWeatherNews) {
        const weatherArticle = {
          id: Date.now(),
          title: `[기상청 속보] ${regionName} 현재 기온 ${temp}°C, '${weatherText}'`,
          category: '기상청',
          excerpt: `기상청 발표: ${regionName} 지역 현재 풍속 ${wind}km/h입니다.`,
          content: `기상청에서 발표한 ${regionName} 지역 실시간 날씨 데이터입니다.\n\n- 현재 기온: ${temp}°C\n- 날씨 상태: ${weatherText}\n- 풍속: ${wind} km/h\n\n최신 기상 정보가 수시로 업데이트됩니다.`,
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
      <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 18px 24px; border-radius: 12px; margin: 20px 0; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,0.1);">
        <div>
          <span style="font-size: 0.85rem; color: #fbbf24; font-weight: bold;">☀️ 실시간 기상청 날씨 정보 (${region})</span>
          <h3 style="margin: 4px 0 0 0; font-size: 1.3rem;">현재 기온 ${temp}°C (${text})</h3>
        </div>
        <div style="text-align: right; font-size: 0.9rem; color: #94a3b8;">
          풍속: ${wind} km/h<br>
          <span style="font-size: 0.75rem; color: #34d399;">● 자동 GPS 수신</span>
        </div>
      </div>
    `;
  }
}

/* ===== Global Functions ===== */

// 1. 카테고리
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

// 2. 모달 제어 (상세보기 오류 수정 완)
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

// 상세 모달 열기
window.openDetailModal = function (articleId) {
  const article = articles.find(a => a.id === Number(articleId));
  if (!article) return;

  article.views = (article.views || 0) + 1;
  localStorage.setItem('articles', JSON.stringify(articles));
  renderArticles();

  const modal = document.getElementById('detailModal');
  let body = document.getElementById('detailModalBody');
  const icon = getCategoryIcon(article.category);

  // 컨테이너가 없으면 모달 내부에 자동 보장 생성
  if (!body && modal) {
    body = document.createElement('div');
    body.id = 'detailModalBody';
    modal.querySelector('.modal-content')?.appendChild(body);
  }

  if (body) {
    body.innerHTML = `
      ${article.image ? `<img src="${article.image}" style="width: 100%; max-height: 350px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;" alt="${article.title}">` : ''}
      <div class="detail-body">
        <div style="margin-bottom: 12px;">
          <span class="badge badge-${article.category}">${icon} ${article.category}</span>
        </div>
        <h2 style="font-size: 1.5rem; margin-bottom: 12px; color: #f8fafc; line-height: 1.4;">${article.title}</h2>
        <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 20px; display: flex; gap: 8px; align-items: center;">
          <span>작성자: <strong style="color: #e2e8f0;">${article.author}</strong></span>
          <span>•</span>
          <span>${article.date}</span>
          <span>•</span>
          <span>조회수 ${article.views}</span>
        </div>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
        <div style="font-size: 1rem; color: #cbd5e1; line-height: 1.7; white-space: pre-line;">${article.content}</div>
      </div>
    `;
  }

  if (modal) modal.classList.add('active');
};

// 상세 모달 닫기
window.closeDetailModal = function () {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('active');
};

// 3. 기사 삭제/수정
window.deleteArticle = function (id, event) {
  if (event) event.stopPropagation();

  if (!currentUser || currentUser.role !== 'admin') {
    showToast('관리자만 기사를 삭제할 수 있습니다.', 'error');
    return;
  }

  if (!confirm('정말 이 기사를 삭제하시겠습니까?')) return;

  articles = articles.filter(a => a.id !== Number(id));
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
        <div class="empty-desc">${isAdmin ? '새 기사 작성 버튼을 눌러 첫 기사를 작성해 보세요!' : '등록된 기사가 없습니다.'}</div>
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

  // 모달 외부 어두운 배경 바깥을 누르거나 닫기 버튼 누를 때 모달 닫히게 설정
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('close-btn') || e.target.closest('.modal-close')) {
        modal.classList.remove('active');
      }
    });
  });

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

  // 기사 작성/수정 폼 (파일 첨부 지원)
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

      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          finalImage = await readImageFile(fileInput.files[0]);
        } catch (err) {
          console.error('파일 읽기 실패', err);
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
