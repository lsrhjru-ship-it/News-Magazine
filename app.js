/* ===== App State ===== */
let articles = JSON.parse(localStorage.getItem('articles')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentCategory = '전체';
let searchQuery = '';
let editingArticleId = null;

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
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  renderCategoryNav();
  renderHeaderUserUI();
  setupEventListeners();

  await fetchWeatherAndAutoCreateNews();
  renderArticles();
});

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
      const todayStr = new Date().toISOString().split('T')[0];

      renderWeatherWidget(regionName, temp, weatherText, wind);

      const hasTodayWeatherNews = articles.some(a => a.category === '기상청' && a.date === todayStr && a.isAuto);

      if (!hasTodayWeatherNews) {
        const weatherArticle = {
          id: Date.now(),
          title: `[기상청 속보] ${regionName} 현재 기온 ${temp}°C, '${weatherText}'`,
          category: '기상청',
          excerpt: `기상청 발표: ${regionName} 지역 현재 풍속 ${wind}km/h입니다.`,
          content: `기상청에서 발표한 ${regionName} 지역 실시간 날씨 데이터입니다.\n\n- 현재 기온: ${temp}°C\n- 날씨 상태: ${weatherText}\n- 풍속: ${wind} km/h\n\n최신 기상 정보가 실시간 업데이트됩니다.`,
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
  if (!currentUser) {
    showToast('기사 작성/수정은 로그인 후 가능합니다.', 'error');
    openLoginModal();
    return;
  }

  const modal = document.getElementById('writeModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('articleForm');

  editingArticleId = articleId;
  clearImagePreview(); // 기존 선택 이미지 미리보기 초기화

  if (articleId) {
    const article = articles.find(a => a.id === Number(articleId));
    if (article) {
      if (title) title.textContent = '✏️ 기사 수정';
      if (document.getElementById('artTitle')) document.getElementById('artTitle').value = article.title;
      if (document.getElementById('artCategory')) document.getElementById('artCategory').value = article.category;
      if (document.getElementById('artAuthor')) document.getElementById('artAuthor').value = article.author;
      if (document.getElementById('artContent')) document.getElementById('artContent').value = article.content;

      // 기존 기사에 이미지가 존재한다면 미리보기 표시
      if (article.image) {
        const previewImg = document.getElementById('imagePreview');
        const uploadArea = document.getElementById('uploadArea');
        const previewContainer = document.getElementById('imagePreviewContainer');

        if (previewImg) previewImg.src = article.image;
        if (uploadArea) uploadArea.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'block';
      }
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
  clearImagePreview();
};

// 상세보기 모달
window.openDetailModal = function (articleId) {
  const article = articles.find(a => a.id === Number(articleId));
  if (!article) return;

  article.views = (article.views || 0) + 1;
  localStorage.setItem('articles', JSON.stringify(articles));
  renderArticles();

  const modal = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  const icon = getCategoryIcon(article.category);

  if (detailContent) {
    detailContent.innerHTML = `
      ${article.image ? `<img src="${article.image}" style="width: 100%; max-height: 320px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;" alt="${article.title}">` : ''}
      <div style="margin-bottom: 12px;">
        <span class="badge" style="background: rgba(255,255,255,0.08); border:1px solid var(--border-color); color: var(--accent-gold); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem;">${icon} ${article.category}</span>
      </div>
      <h2 style="font-size: 1.5rem; margin-bottom: 12px; line-height: 1.4; font-weight: 700;">${article.title}</h2>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <span>작성자: <strong style="color: var(--text-primary);">${article.author}</strong></span>
        <span>•</span>
        <span>${article.date}</span>
        <span>•</span>
        <span>조회수 ${article.views}</span>
      </div>
      <div style="font-size: 1rem; color: var(--text-secondary); line-height: 1.8; white-space: pre-line;">${article.content}</div>
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

/* ===== Articles Render & Actions ===== */
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
        <div class="article-card-img-container">
          ${article.image
        ? `<img src="${article.image}" class="article-card-img" alt="${article.title}">`
        : `<div class="article-card-img-placeholder" style="font-size:2rem; text-align:center; padding: 30px;">${icon}</div>`
      }
        </div>
        <div class="article-card-body" style="padding: 16px;">
          <span class="badge badge-${article.category}">${icon} ${article.category}</span>
          <h3 class="article-card-title" style="margin: 10px 0; font-size: 1.1rem;">${article.title}</h3>
          <p class="article-card-excerpt" style="color:var(--text-secondary); font-size:0.9rem;">${article.excerpt || article.content.substring(0, 60)}...</p>
          <div class="article-card-meta" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted);">
            <div>
              <span>${article.author}</span> • <span>${article.date}</span>
            </div>
            ${isAdmin ? `
              <div style="display:flex; gap:4px;">
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

window.deleteArticle = function (id, event) {
  if (event) event.stopPropagation();

  if (!currentUser || currentUser.role !== 'admin') {
    showToast('삭제 권한이 없습니다.', 'error');
    return;
  }

  if (!confirm('정말 삭제하시겠습니까?')) return;

  articles = articles.filter(a => a.id !== Number(id));
  localStorage.setItem('articles', JSON.stringify(articles));
  renderArticles();
  showToast('기사가 삭제되었습니다.', 'info');
};

window.editArticle = function (id, event) {
  if (event) event.stopPropagation();
  window.openWriteModal(id);
};

/* ===== Header & UI Handling ===== */
function renderHeaderUserUI() {
  const userArea = document.getElementById('userArea');
  const loginBtn = document.getElementById('loginBtn');
  const writeBtn = document.getElementById('writeBtn');

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userArea) {
      userArea.style.display = 'flex';
      document.getElementById('userNameDisplay').textContent = `${currentUser.name} ${isAdmin ? '(관리자)' : ''}`;
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

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const loginId = document.getElementById('loginId').value;
      if (!loginId) return;

      const role = (loginId.toLowerCase() === 'admin' || loginId === '관리자') ? 'admin' : 'user';

      currentUser = { name: loginId, role: role };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      renderHeaderUserUI();
      renderArticles();
      closeLoginModal();

      showToast(`${loginId}님 환영합니다! ${role === 'admin' ? '(관리자 권한)' : ''}`, 'success');
    });
  }

  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser) {
        showToast('로그인이 필요합니다.', 'error');
        return;
      }

      const title = document.getElementById('artTitle').value;
      const category = document.getElementById('artCategory').value;
      const author = document.getElementById('artAuthor').value;
      const content = document.getElementById('artContent').value;
      const fileInput = document.getElementById('imageInput');

      let finalImage = '';

      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          // 이미지 축소 및 압축 후 Base64 변환
          finalImage = await readImageFile(fileInput.files[0]);
        } catch (err) {
          console.error('이미지 읽기 실패', err);
          showToast('이미지 용량이 너무 크거나 읽기에 실패했습니다.', 'error');
          return;
        }
      }

      const isPreviewVisible = document.getElementById('imagePreviewContainer')?.style.display !== 'none';

      if (editingArticleId) {
        articles = articles.map(a => {
          if (a.id === editingArticleId) {
            let updatedImage = a.image;
            if (finalImage) {
              updatedImage = finalImage;
            } else if (!isPreviewVisible) {
              updatedImage = ''; // 미리보기 제거 상태면 기존 이미지 삭제
            }
            return { ...a, title, category, author, content, image: updatedImage };
          }
          return a;
        });
        showToast('기사가 수정되었습니다.', 'success');
      } else {
        const newArticle = {
          id: Date.now(),
          title,
          category,
          content,
          image: finalImage,
          author: author || currentUser.name,
          date: new Date().toISOString().split('T')[0],
          views: 0
        };
        articles.unshift(newArticle);
        showToast('새 기사가 등록되었습니다.', 'success');
      }

      try {
        localStorage.setItem('articles', JSON.stringify(articles));
      } catch (storageErr) {
        showToast('저장 용량이 부족합니다. 이미지를 변경해 보세요.', 'error');
        return;
      }

      renderArticles();
      closeWriteModal();
    });
  }

  // 이미지 선택(change) 리스너 등록
  setupImageInputListener();
}

/* ===== Image Handling & Preview ===== */

// 파일 입력 선택 시 미리보기 표시
function setupImageInputListener() {
  const fileInput = document.getElementById('imageInput');
  const uploadArea = document.getElementById('uploadArea');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');

  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (previewImg) previewImg.src = evt.target.result;
        if (uploadArea) uploadArea.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

// 이미지 미리보기 초기화 (HTML ✕ 버튼 연동)
window.clearImagePreview = function () {
  const fileInput = document.getElementById('imageInput');
  const uploadArea = document.getElementById('uploadArea');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');

  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (uploadArea) uploadArea.style.display = 'block';
};

// Canvas를 활용하여 대용량 이미지를 자동으로 800px 축소 및 JPEG 70% 압축
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxWidth = 800; // 가로 최대 800px 축소

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 70% 품질 압축 (localStorage 5MB 한계 대응)
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = error => reject(error);
      img.src = e.target.result;
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/* ===== User Logout & Toast Messages ===== */

window.logout = function () {
  currentUser = null;
  localStorage.removeItem('currentUser');
  renderHeaderUserUI();
  renderArticles();
  showToast('로그아웃 되었습니다.', 'info');
};

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
