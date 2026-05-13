/**
 * Profile - tarix, balans, referal
 */
window.PROFILE = (function() {
  let userTransactions = [];

  async function refresh() {
    const user = await AUTH.refresh();
    if (!user) return;

    document.getElementById('profileName').textContent = user.firstName || user.username || 'Foydalanuvchi';
    document.getElementById('profileId').textContent = user.telegramId;
    document.getElementById('profileBalance').textContent = APP.formatSom(user.balance);
    document.getElementById('profileAvatar').textContent = (user.firstName || user.username || 'U').charAt(0).toUpperCase();

    // Refresh user badge
    APP.updateUserBadge();

    // Referal
    const refLink = `${location.origin}${location.pathname}?ref=${user.referralCode}`;
    document.getElementById('refLink').textContent = refLink;
    document.getElementById('refCount').textContent = (user.referrals || []).length;
    document.getElementById('refEarned').textContent = (user.starBonus || 0) + ' ⭐';

    // Transactions
    const { transactions } = await API.getTransactions();
    userTransactions = transactions.filter(t => String(t.userId) === String(user.telegramId));
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('historyList');
    if (!userTransactions.length) {
      list.innerHTML = '<div class="empty-state">Hozircha buyurtmalar yo\'q</div>';
      return;
    }
    list.innerHTML = userTransactions.map(t => {
      const icon = typeIcon(t.type);
      const label = typeLabel(t);
      const date = formatDate(t.createdAt);
      const sign = (t.type === 'topup' || t.type === 'referral-bonus') ? '+' : '−';
      return `
        <div class="history-item">
          <div class="hist-icon">${icon}</div>
          <div class="hist-info">
            <div class="hist-type">${label}</div>
            <div class="hist-date">${date}</div>
          </div>
          <div style="text-align:right;">
            <div class="hist-amount">${sign} ${t.amount ? APP.formatSom(t.amount) + " so'm" : (t.stars || 0) + ' ⭐'}</div>
            <div class="hist-status ${t.status}">${statusLabel(t.status)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function typeIcon(t) {
    return { stars:'⭐', premium:'💎', nft:'🎁', rental:'🦊', topup:'💳', 'referral-bonus':'🤝', 'premium-1m':'💬' }[t] || '📋';
  }
  function typeLabel(t) {
    switch (t.type) {
      case 'stars': return `${t.stars} ⭐ → ${t.target}`;
      case 'premium': return `${t.months}-oylik Premium → ${t.target}`;
      case 'nft': return `${t.nftName} → ${t.target}`;
      case 'rental': return `${t.nftName} (${t.days} kun)`;
      case 'topup': return `Balans to'ldirish`;
      case 'referral-bonus': return `Referal bonus`;
      default: return t.type;
    }
  }
  function statusLabel(s) {
    return { pending: 'Kutilmoqda', approved: 'Tasdiqlangan', rejected: 'Bekor qilingan' }[s] || s;
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}.${mm} ${hh}:${mi}`;
  }

  // Profile tabs
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('historyContent').style.display = tab.dataset.tab === 'history' ? '' : 'none';
      document.getElementById('referralContent').style.display = tab.dataset.tab === 'referral' ? '' : 'none';
    });
  });

  // Copy ref link
  document.getElementById('copyRefBtn').addEventListener('click', () => {
    const text = document.getElementById('refLink').textContent;
    navigator.clipboard.writeText(text).then(() => APP.toast('Nusxalandi!', 'success'));
  });

  // ============ TOPUP FLOW ============
  document.getElementById('topupBtn').addEventListener('click', () => {
    document.getElementById('topupStep1').style.display = '';
    document.getElementById('topupStep2').style.display = 'none';
    document.getElementById('topupAmount').value = '';
    APP.showModal('topupModal');
  });

  document.getElementById('topupNextBtn').addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('topupAmount').value);
    if (!amount || amount < 1000) return APP.toast("Minimal summa 1 000 so'm", 'error');

    const settings = APP.getSettings();
    document.getElementById('topupCardNum').textContent = settings.cardNumber;
    document.getElementById('topupAmountShow').textContent = APP.formatSom(amount);

    // Bot link with prefilled data
    const user = AUTH.getUser();
    const startParam = `topup_${user.telegramId}_${amount}`;
    document.getElementById('botSendLink').href = `https://t.me/${CONFIG.BOT.USERNAME}?start=${startParam}`;

    document.getElementById('topupStep1').style.display = 'none';
    document.getElementById('topupStep2').style.display = '';

    // Yangi topup transaction yaratish (pending)
    await API.addTransaction({
      type: 'topup',
      userId: user.telegramId,
      username: user.username,
      amount,
      status: 'pending',
      adminNote: 'Botda chek kutilyapti'
    });
  });

  document.getElementById('copyCardBtn').addEventListener('click', () => {
    const num = document.getElementById('topupCardNum').textContent;
    navigator.clipboard.writeText(num.replace(/\s/g, '')).then(() => APP.toast('Nusxalandi!', 'success'));
  });

  return { refresh };
})();
