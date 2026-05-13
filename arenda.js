/**
 * Arenda - NFT ijaraga olish + TonConnect integratsiyasi
 */
window.ARENDA = (function() {
  const grid = document.getElementById('arendaGrid');
  const searchInput = document.getElementById('arendaSearch');
  const bottomBar = document.getElementById('arendaBottomBar');
  const countEl = document.getElementById('arendaCount');
  const totalEl = document.getElementById('arendaTotal');
  const rentBtn = document.getElementById('arendaRentBtn');
  const dayCountEl = document.getElementById('dayCount');
  const dayPlusBtn = document.getElementById('dayPlusBtn');
  const dayMinusBtn = document.getElementById('dayMinusBtn');
  const tonConnectBtn = document.getElementById('tonConnectBtn');
  const tonUrlInput = document.getElementById('arendaTonUrl');
  const confirmBtn = document.getElementById('arendaConfirmBtn');
  const confirmTotalEl = document.getElementById('arendaConfirmTotal');
  const selectedListEl = document.getElementById('arendaSelectedList');
  const qollanmaBtn = document.getElementById('qollanmaBtn');
  const guideBanner = document.getElementById('arendaGuideBanner');

  let allRentals = [];
  let selectedIds = new Set();
  let currentDays = 3;
  let tonConnectUI = null;
  let tonWalletAddress = null;

  async function refresh() {
    const { rentals } = await API.getRentals();
    allRentals = rentals || [];
    render(allRentals);
    initTonConnect();
  }

  function initTonConnect() {
    if (tonConnectUI || !window.TON_CONNECT_UI) return;
    try {
      tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
        manifestUrl: window.location.origin + '/tonconnect-manifest.json',
        buttonRootId: null
      });
      tonConnectUI.onStatusChange(wallet => {
        if (wallet && wallet.account) {
          tonWalletAddress = wallet.account.address;
          tonUrlInput.value = tonWalletAddress;
          APP.toast('TON hamyon ulandi', 'success');
        } else {
          tonWalletAddress = null;
        }
      });
    } catch (e) {
      console.error('TonConnect init failed', e);
    }
  }

  function render(items) {
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">Hozircha arenda giftlari yo\'q</div>';
      return;
    }
    grid.innerHTML = items.map(r => `
      <div class="arenda-card ${selectedIds.has(r.id) ? 'selected' : ''}" data-rid="${r.id}">
        <div class="nft-image">
          ${r.image ? `<img src="${r.image}" alt="${r.name}" loading="lazy">` : '🎁'}
          <div class="nft-check-badge">✓</div>
        </div>
        <div class="nft-info">
          <div class="nft-name">${r.name}</div>
          <div class="nft-num">${r.number || ''}</div>
          <div class="nft-price-row">
            <div class="nft-price-badge">${APP.formatSom(r.dailyPrice)} ▾</div>
            ${r.tgLink ? `<a class="nft-eye-btn" href="${r.tgLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()">👁</a>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.arenda-card').forEach(card => {
      card.addEventListener('click', () => toggleSelect(card.dataset.rid));
    });
  }

  function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateBottomBar();
    render(filtered());
  }

  function filtered() {
    const q = (searchInput.value || '').toLowerCase();
    if (!q) return allRentals;
    return allRentals.filter(x => (x.name + (x.number || '')).toLowerCase().includes(q));
  }

  function updateBottomBar() {
    const items = allRentals.filter(r => selectedIds.has(r.id));
    countEl.textContent = items.length;
    const total = items.reduce((s, r) => s + (r.dailyPrice || 0), 0);
    totalEl.textContent = APP.formatSom(total) + " so'm/kun";
    bottomBar.style.display = items.length > 0 ? 'block' : 'none';
  }

  // Confirm modal -> day counter + total
  function updateConfirmTotal() {
    const items = allRentals.filter(r => selectedIds.has(r.id));
    const sum = items.reduce((s, r) => s + (r.dailyPrice || 0), 0) * currentDays;
    confirmTotalEl.textContent = APP.formatSom(sum);
  }

  rentBtn.addEventListener('click', () => {
    if (!selectedIds.size) return APP.toast('Hech narsa tanlanmagan', 'error');
    currentDays = CONFIG.RENTAL.minDays;
    dayCountEl.textContent = currentDays;
    tonUrlInput.value = '';
    // Selected gifts list
    const items = allRentals.filter(r => selectedIds.has(r.id));
    selectedListEl.innerHTML = items.map(r => `
      <div class="arenda-selected-thumb">
        <img src="${r.image}" alt="">
        <div class="arenda-selected-thumb-name">${r.name}</div>
      </div>
    `).join('');
    updateConfirmTotal();
    APP.showModal('arendaConfirmModal');
  });

  dayPlusBtn.addEventListener('click', () => {
    currentDays++;
    dayCountEl.textContent = currentDays;
    updateConfirmTotal();
  });
  dayMinusBtn.addEventListener('click', () => {
    if (currentDays > CONFIG.RENTAL.minDays) currentDays--;
    dayCountEl.textContent = currentDays;
    updateConfirmTotal();
  });

  tonConnectBtn.addEventListener('click', async () => {
    if (!tonConnectUI) initTonConnect();
    if (!tonConnectUI) return APP.toast('TonConnect tayyor emas. Sahifani yangilang.', 'error');
    try { await tonConnectUI.openModal(); }
    catch(e) { APP.toast('TonConnect ochilmadi', 'error'); console.error(e); }
  });

  qollanmaBtn.addEventListener('click', () => APP.showGuide('arenda'));
  guideBanner.addEventListener('click', () => APP.showGuide('arenda'));

  // Confirm
  confirmBtn.addEventListener('click', async () => {
    const user = AUTH.getUser();
    if (!user) return APP.toast('Tizimga kiring', 'error');

    const tonUrl = (tonUrlInput.value || '').trim();
    if (!tonUrl) return APP.toast('TonConnect URL kiriting yoki hamyon ulang', 'error');

    const items = allRentals.filter(r => selectedIds.has(r.id));
    const dailyTotal = items.reduce((s, r) => s + (r.dailyPrice || 0), 0);
    const sum = dailyTotal * currentDays;

    if (user.balance < sum) {
      return APP.toast(`Balansda yetarli mablag' yo'q. Yetishmaydi: ${APP.formatSom(sum - user.balance)} so'm`, 'error');
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Yuborilmoqda...';

    const paid = await APP.payWithBalance(sum);
    if (!paid) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Ijaraga olish';
      return;
    }

    // Har bir NFT uchun alohida transaction yaratamiz
    for (const it of items) {
      await APP.submitOrder({
        type: 'rental',
        amount: it.dailyPrice * currentDays,
        nftId: it.id,
        nftName: it.name,
        nftImage: it.image,
        tonUrl,
        days: currentDays,
        payMethod: 'balance'
      });
    }

    APP.hideModal('arendaConfirmModal');
    selectedIds.clear();
    updateBottomBar();
    render(filtered());
    APP.showModal('purchaseLoader');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Ijaraga olish';
  });

  searchInput.addEventListener('input', () => render(filtered()));

  // "Mening ijaralarim" - profile'ga yo'naltirish (history filter)
  document.getElementById('myRentalsBtn').addEventListener('click', () => {
    APP.navigate('profile');
  });

  return { refresh };
})();
