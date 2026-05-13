/**
 * App - main routing, navigation, settings load
 */
window.APP = (function() {
  let settings = null;

  // Utility: format som
  function formatSom(n) {
    if (!n && n !== 0) return '0';
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Toast
  function toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // Navigation
  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.querySelector(`.page[data-page="${page}"]`);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);

    // Custom hooks per page
    if (page === 'profile' && window.PROFILE) PROFILE.refresh();
    if (page === 'nft' && window.NFT) NFT.refresh();
    if (page === 'arenda' && window.ARENDA) ARENDA.refresh();
    if (page === 'admin' && window.ADMIN_PANEL) ADMIN_PANEL.refresh();
  }

  // Modal helpers
  function showModal(id) { document.getElementById(id).classList.add('show'); }
  function hideModal(id) { document.getElementById(id).classList.remove('show'); }

  // Tekshirish: Telegram username valid?
  function validateUsername(u) {
    if (!u) return false;
    const clean = u.replace(/^@/, '').trim();
    return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(clean);
  }

  // Buyurtmani bot orqali adminga jonatish (Telegram t.me link bilan)
  // Endi to'g'ridan-to'g'ri jsonbin'ga yozamiz, bot uni tekshiradi.
  async function submitOrder(orderData) {
    const user = AUTH.getUser();
    if (!user) {
      toast('Avval tizimga kiring', 'error');
      return null;
    }

    const tx = {
      type: orderData.type,            // 'stars' | 'premium' | 'nft' | 'rental' | 'topup' | 'premium-1m'
      userId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      target: orderData.target || '',  // @username (kim uchun)
      amount: orderData.amount || 0,   // som
      stars: orderData.stars || 0,
      months: orderData.months || 0,
      nftId: orderData.nftId || null,
      nftName: orderData.nftName || '',
      nftImage: orderData.nftImage || '',
      tonUrl: orderData.tonUrl || '',
      days: orderData.days || 0,
      payMethod: orderData.payMethod || 'balance',  // balance | card
      status: 'pending',
      adminNote: ''
    };

    const saved = await API.addTransaction(tx);
    return saved;
  }

  // Balansdan to'lov
  async function payWithBalance(amount) {
    const user = AUTH.getUser();
    if (!user) return false;
    if (user.balance < amount) {
      toast(`Balansda yetarli mablag' yo'q. Yetishmaydi: ${formatSom(amount - user.balance)} so'm`, 'error');
      return false;
    }
    await API.updateUserBalance(user.telegramId, -amount);
    await AUTH.refresh();
    updateUserBadge();
    return true;
  }

  // Header badge yangilash
  function updateUserBadge() {
    const u = AUTH.getUser();
    if (!u) return;
    document.getElementById('userName').textContent = u.firstName || u.username || 'User';
    document.getElementById('userBalance').textContent = formatSom(u.balance);
    document.getElementById('userAvatar').textContent = (u.firstName || u.username || 'U').charAt(0).toUpperCase();
  }

  // Sozlamalarni yuklash va UI'ga qo'llash
  async function loadSettings() {
    settings = await API.getSettings();
    // Premium narxlarini ko'rsatish
    document.getElementById('premium3Price').textContent = formatSom(settings.premium.p3) + ' so\'m';
    document.getElementById('premium6Price').textContent = formatSom(settings.premium.p6) + ' so\'m';
    document.getElementById('premium12Price').textContent = formatSom(settings.premium.p12) + ' so\'m';
    // Star kurs
    document.getElementById('starsRate').textContent = settings.starPrice;
    return settings;
  }

  function getSettings() { return settings; }

  // Statistika (home)
  async function loadStats() {
    const { users } = await API.getUsers();
    const { transactions } = await API.getTransactions();
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statTransactions').textContent = transactions.filter(t => t.status === 'approved').length;
  }

  // YouTube embed URLni normalize qilish
  function youtubeEmbed(url) {
    if (!url) return '';
    if (url.includes('/embed/')) return url;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    return url;
  }

  function showGuide(type) {
    const url = youtubeEmbed(settings.guides[type] || '');
    document.getElementById('guideTitle').textContent = `Qo'llanma — ${type.toUpperCase()}`;
    document.getElementById('guideVideo').src = url;
    showModal('guideModal');
  }

  // INIT
  async function init() {
    // Loaders
    await loadSettings();
    const user = await AUTH.init();
    if (!user) {
      toast('Tizimga kirish muvaffaqiyatsiz. Sahifani yangilang.', 'error');
      return;
    }
    updateUserBadge();
    loadStats();

    // Navigation - har bir [data-nav] tugma
    document.body.addEventListener('click', e => {
      const navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        navigate(navBtn.dataset.nav);
        return;
      }
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const modal = closeBtn.closest('.modal');
        if (modal) modal.classList.remove('show');
        // Stop YouTube
        const vid = document.getElementById('guideVideo');
        if (vid && vid.src) vid.src = '';
        return;
      }
      // Modal background close
      if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
        const vid = document.getElementById('guideVideo');
        if (vid && vid.src) vid.src = '';
      }
    });

    // Profile -> admin panel link
    document.getElementById('adminPanelLink').addEventListener('click', () => {
      navigate('admin-login');
    });

    // Adminga yozish
    document.getElementById('contactAdminBtn').addEventListener('click', () => {
      window.open(`https://t.me/${settings.adminUsername}`, '_blank');
    });

    // Channel link update
    const chLink = document.querySelector('.channel-link');
    if (chLink) chLink.href = CONFIG.SITE.CHANNEL;
  }

  return { init, navigate, showModal, hideModal, toast, submitOrder, payWithBalance, updateUserBadge, validateUsername, formatSom, loadSettings, getSettings, loadStats, showGuide };
})();

document.addEventListener('DOMContentLoaded', APP.init);
