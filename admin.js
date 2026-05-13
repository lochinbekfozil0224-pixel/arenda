/**
 * Admin Panel - parol bilan kirish, hamma narsani boshqarish
 */
window.ADMIN_PANEL = (function() {
  let isLoggedIn = false;

  // Login
  document.getElementById('adminLoginBtn').addEventListener('click', () => {
    const pw = document.getElementById('adminPwInput').value;
    if (pw === CONFIG.ADMIN.PASSWORD) {
      isLoggedIn = true;
      document.getElementById('adminPwInput').value = '';
      document.getElementById('adminError').textContent = '';
      APP.navigate('admin');
    } else {
      document.getElementById('adminError').textContent = 'Parol noto\'g\'ri';
    }
  });
  document.getElementById('adminPwInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
  });

  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-content').forEach(c => c.style.display = 'none');
      const target = 'admin-' + tab.dataset.admintab;
      document.getElementById(target).style.display = '';
      // Load content
      if (tab.dataset.admintab === 'users') loadUsers();
      if (tab.dataset.admintab === 'nfts') loadNfts();
      if (tab.dataset.admintab === 'rentals') loadRentals();
      if (tab.dataset.admintab === 'orders') loadOrders();
    });
  });

  // ============ SETTINGS ============
  async function loadSettings() {
    const s = await API.getSettings();
    document.getElementById('setCardNumber').value = s.cardNumber || '';
    document.getElementById('setAdminId').value = s.adminId || '';
    document.getElementById('setAdminUsername').value = s.adminUsername || '';
    document.getElementById('setStarPrice').value = s.starPrice;
    document.getElementById('setP3').value = s.premium.p3;
    document.getElementById('setP6').value = s.premium.p6;
    document.getElementById('setP12').value = s.premium.p12;
    document.getElementById('setGuideStars').value = s.guides?.stars || '';
    document.getElementById('setGuidePremium').value = s.guides?.premium || '';
    document.getElementById('setGuideNft').value = s.guides?.nft || '';
    document.getElementById('setGuideArenda').value = s.guides?.arenda || '';
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const settings = {
      cardNumber: document.getElementById('setCardNumber').value.trim(),
      adminId: document.getElementById('setAdminId').value.trim(),
      adminUsername: document.getElementById('setAdminUsername').value.trim().replace(/^@/, ''),
      starPrice: parseInt(document.getElementById('setStarPrice').value) || 215,
      premium: {
        p3: parseInt(document.getElementById('setP3').value) || 169000,
        p6: parseInt(document.getElementById('setP6').value) || 225000,
        p12: parseInt(document.getElementById('setP12').value) || 409000
      },
      guides: {
        stars:   document.getElementById('setGuideStars').value.trim(),
        premium: document.getElementById('setGuidePremium').value.trim(),
        nft:     document.getElementById('setGuideNft').value.trim(),
        arenda:  document.getElementById('setGuideArenda').value.trim()
      }
    };
    await API.saveSettings(settings);
    API.clearCache();
    await APP.loadSettings();
    APP.toast('Saqlandi!', 'success');
  });

  // ============ USERS ============
  async function loadUsers() {
    const { users } = await API.getUsers();
    const list = document.getElementById('adminUsersList');
    if (!users.length) {
      list.innerHTML = '<div class="empty-state">Hech kim yo\'q</div>';
      return;
    }
    renderUsers(users);
  }
  function renderUsers(users) {
    const list = document.getElementById('adminUsersList');
    list.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-item-avatar">${(u.firstName || u.username || 'U').charAt(0).toUpperCase()}</div>
        <div class="user-item-info">
          <div class="user-item-name">${u.firstName || u.username || 'User'} @${u.username || '—'}</div>
          <div class="user-item-meta">ID: ${u.telegramId} · Balans: ${APP.formatSom(u.balance)} so'm · Ref: ${(u.referrals||[]).length}</div>
        </div>
        <div class="user-item-actions">
          <button class="user-action-btn" title="Balans +/−" onclick="ADMIN_PANEL.modifyBalance('${u.telegramId}')">💰</button>
          <button class="user-action-btn" title="Adminga yozish" onclick="window.open('tg://user?id=${u.telegramId}','_blank')">💬</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('userSearchInput').addEventListener('input', async (e) => {
    const q = e.target.value.toLowerCase();
    const { users } = await API.getUsers();
    renderUsers(users.filter(u =>
      String(u.telegramId).includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q)
    ));
  });

  async function modifyBalance(telegramId) {
    const inp = prompt('Balansga + yoki − qiymat (so\'m). Masalan: 5000 yoki -2000');
    const delta = parseInt(inp);
    if (isNaN(delta)) return;
    await API.updateUserBalance(telegramId, delta);
    APP.toast('Balans yangilandi', 'success');
    loadUsers();
    if (AUTH.getUser().telegramId === String(telegramId)) {
      await AUTH.refresh();
      APP.updateUserBadge();
    }
  }

  // ============ NFTS ============
  async function loadNfts() {
    const { nfts = [] } = await API.getProducts();
    const list = document.getElementById('adminNftList');
    if (!nfts.length) {
      list.innerHTML = '<div class="empty-state">Hozircha NFT yo\'q</div>';
      return;
    }
    list.innerHTML = nfts.map((n, i) => `
      <div class="admin-list-item">
        <img src="${n.image || ''}" alt="" onerror="this.style.display='none'">
        <div class="admin-list-item-info">
          <div class="admin-list-name">${n.name}</div>
          <div class="admin-list-meta">${n.number || ''} · ${APP.formatSom(n.price)} so'm</div>
          <div class="admin-list-meta" style="word-break:break-all;font-size:10px;">${n.tgLink || ''}</div>
        </div>
        <div class="admin-list-actions">
          <button class="admin-btn-edit" onclick="ADMIN_PANEL.editNft(${i})">✎</button>
          <button class="admin-btn-delete" onclick="ADMIN_PANEL.deleteNft(${i})">🗑</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('addNftBtn').addEventListener('click', () => editNft(-1));

  async function editNft(idx) {
    const { nfts = [] } = await API.getProducts();
    const nft = idx >= 0 ? nfts[idx] : { id: 'nft_' + Date.now(), name: '', number: '', image: '', price: 0, tgLink: '' };
    const name = prompt('Nomi:', nft.name);
    if (name === null) return;
    const number = prompt('Raqami (masalan #28677):', nft.number);
    if (number === null) return;
    const image = prompt('Rasm URL:', nft.image);
    if (image === null) return;
    const price = parseInt(prompt('Narxi (so\'m):', nft.price));
    if (isNaN(price)) return;
    const tgLink = prompt('Telegram NFT link (https://t.me/nft/...):', nft.tgLink);
    if (tgLink === null) return;

    nft.name = name; nft.number = number; nft.image = image; nft.price = price; nft.tgLink = tgLink;
    if (idx >= 0) nfts[idx] = nft;
    else nfts.push(nft);

    await API.saveProducts({ nfts });
    loadNfts();
    APP.toast('Saqlandi', 'success');
  }
  async function deleteNft(idx) {
    if (!confirm("O'chirilsinmi?")) return;
    const { nfts = [] } = await API.getProducts();
    nfts.splice(idx, 1);
    await API.saveProducts({ nfts });
    loadNfts();
  }

  // ============ RENTALS ============
  async function loadRentals() {
    const { rentals = [] } = await API.getRentals();
    const list = document.getElementById('adminRentalList');
    if (!rentals.length) {
      list.innerHTML = '<div class="empty-state">Hozircha arenda yo\'q</div>';
      return;
    }
    list.innerHTML = rentals.map((r, i) => `
      <div class="admin-list-item">
        <img src="${r.image || ''}" alt="" onerror="this.style.display='none'">
        <div class="admin-list-item-info">
          <div class="admin-list-name">${r.name}</div>
          <div class="admin-list-meta">${r.number || ''} · ${APP.formatSom(r.dailyPrice)} so'm/kun</div>
          <div class="admin-list-meta" style="word-break:break-all;font-size:10px;">${r.tgLink || ''}</div>
        </div>
        <div class="admin-list-actions">
          <button class="admin-btn-edit" onclick="ADMIN_PANEL.editRental(${i})">✎</button>
          <button class="admin-btn-delete" onclick="ADMIN_PANEL.deleteRental(${i})">🗑</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('addRentalBtn').addEventListener('click', () => editRental(-1));

  async function editRental(idx) {
    const { rentals = [] } = await API.getRentals();
    const r = idx >= 0 ? rentals[idx] : { id: 'r_' + Date.now(), name: '', number: '', image: '', dailyPrice: 1500, tgLink: '' };
    const name = prompt('Nomi:', r.name);
    if (name === null) return;
    const number = prompt('Raqami:', r.number);
    if (number === null) return;
    const image = prompt('Rasm URL:', r.image);
    if (image === null) return;
    const dailyPrice = parseInt(prompt('Kunlik narx (so\'m):', r.dailyPrice));
    if (isNaN(dailyPrice)) return;
    const tgLink = prompt('Telegram NFT link:', r.tgLink);
    if (tgLink === null) return;

    r.name = name; r.number = number; r.image = image; r.dailyPrice = dailyPrice; r.tgLink = tgLink;
    if (idx >= 0) rentals[idx] = r;
    else rentals.push(r);

    await API.saveRentals({ rentals });
    loadRentals();
    APP.toast('Saqlandi', 'success');
  }
  async function deleteRental(idx) {
    if (!confirm("O'chirilsinmi?")) return;
    const { rentals = [] } = await API.getRentals();
    rentals.splice(idx, 1);
    await API.saveRentals({ rentals });
    loadRentals();
  }

  // ============ ORDERS ============
  async function loadOrders() {
    const { transactions } = await API.getTransactions();
    const list = document.getElementById('adminOrdersList');
    if (!transactions.length) {
      list.innerHTML = '<div class="empty-state">Hozircha buyurtmalar yo\'q</div>';
      return;
    }
    list.innerHTML = transactions.slice(0, 100).map(t => {
      const label = t.type === 'stars' ? `${t.stars}⭐` :
                    t.type === 'premium' ? `${t.months}-oylik` :
                    t.type === 'nft' ? t.nftName :
                    t.type === 'rental' ? `${t.nftName} ${t.days}kun` :
                    t.type === 'topup' ? "Balans to'ldirish" : t.type;
      return `
        <div class="admin-list-item">
          <div style="width:56px;height:56px;border-radius:12px;background:rgba(108,92,231,.15);display:flex;align-items:center;justify-content:center;font-size:22px;">
            ${({stars:'⭐',premium:'💎',nft:'🎁',rental:'🦊',topup:'💳','referral-bonus':'🤝'})[t.type] || '📋'}
          </div>
          <div class="admin-list-item-info">
            <div class="admin-list-name">${label} — ${t.target || ''}</div>
            <div class="admin-list-meta">@${t.username || '—'} · ${APP.formatSom(t.amount)}so'm</div>
            <div class="admin-list-meta hist-status ${t.status}" style="display:inline-block;margin-top:4px;">${t.status}</div>
          </div>
          <div class="admin-list-actions">
            ${t.status === 'pending' ? `
              <button class="admin-btn-edit" onclick="ADMIN_PANEL.approveOrder('${t.id}')">✓</button>
              <button class="admin-btn-delete" onclick="ADMIN_PANEL.rejectOrder('${t.id}')">✕</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function approveOrder(id) {
    const { transactions } = await API.getTransactions();
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    // Topup tasdiqlansa - balansga qo'shamiz
    if (t.type === 'topup') {
      await API.updateUserBalance(t.userId, t.amount);
    }
    await API.updateTransaction(id, { status: 'approved' });
    APP.toast('Tasdiqlandi', 'success');
    loadOrders();
  }
  async function rejectOrder(id) {
    if (!confirm('Bekor qilinsinmi?')) return;
    const { transactions } = await API.getTransactions();
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    // Topup emas bo'lsa - balansga qaytaramiz
    if (t.type !== 'topup' && t.type !== 'referral-bonus' && t.amount) {
      await API.updateUserBalance(t.userId, t.amount);
    }
    await API.updateTransaction(id, { status: 'rejected' });
    APP.toast('Bekor qilindi', 'success');
    loadOrders();
  }

  async function refresh() {
    if (!isLoggedIn) {
      APP.navigate('admin-login');
      return;
    }
    loadSettings();
  }

  return { refresh, modifyBalance, editNft, deleteNft, editRental, deleteRental, approveOrder, rejectOrder };
})();
