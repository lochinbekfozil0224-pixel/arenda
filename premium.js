/**
 * Premium - TG Premium sotib olish (1 oylik = admin lichka, qolganlari = sayt orqali)
 */
(function() {
  const usernameInput = document.getElementById('premiumUsername');
  const checkBtn = document.getElementById('premiumCheckBtn');
  const buyBtn = document.getElementById('premiumBuyBtn');

  let usernameValid = false;
  let usernameChecked = '';
  let selectedMonths = null;

  checkBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim().replace(/^@/, '');
    if (!APP.validateUsername(u)) {
      APP.toast('Username noto\'g\'ri', 'error');
      checkBtn.classList.add('error');
      checkBtn.textContent = 'Xato';
      setTimeout(() => { checkBtn.textContent = 'Tekshirish'; checkBtn.classList.remove('error'); }, 1500);
      return;
    }
    usernameValid = true;
    usernameChecked = u;
    checkBtn.classList.add('success');
    checkBtn.textContent = '✓';
    setTimeout(() => { checkBtn.textContent = 'Tekshirish'; checkBtn.classList.remove('success'); }, 1500);
  });

  // Premium variantlarini tanlash
  document.querySelectorAll('.premium-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.premium-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedMonths = parseInt(opt.dataset.premium);
    });
  });

  // Buy tugmasi
  buyBtn.addEventListener('click', async () => {
    const user = AUTH.getUser();
    if (!user) return APP.toast('Tizimga kiring', 'error');
    if (!usernameValid) return APP.toast('Avval username\'ni tekshiring', 'error');
    if (!selectedMonths) return APP.toast('Premium variantini tanlang', 'error');

    const settings = APP.getSettings();
    const target = '@' + usernameChecked;

    // 1 oylik premium - to'g'ridan-to'g'ri admin lichka
    if (selectedMonths === 1) {
      // Adminga otib ketish, va xabar tayyor
      const msg = encodeURIComponent(`Salom! Men ${target} uchun 1 oylik Premium olmoqchiman. Username: @${user.username || user.firstName}`);
      window.open(`https://t.me/${settings.adminUsername}?text=${msg}`, '_blank');
      return;
    }

    // Boshqalari uchun balansdan to'lash
    const priceMap = { 3: settings.premium.p3, 6: settings.premium.p6, 12: settings.premium.p12 };
    const som = priceMap[selectedMonths];

    if (user.balance < som) {
      return APP.toast(`Balansda yetarli mablag' yo'q. Yetishmaydi: ${APP.formatSom(som - user.balance)} so'm`, 'error');
    }

    buyBtn.disabled = true;
    buyBtn.textContent = 'Yuborilmoqda...';

    const paid = await APP.payWithBalance(som);
    if (!paid) {
      buyBtn.disabled = false;
      buyBtn.textContent = 'Sotib olish';
      return;
    }

    await APP.submitOrder({
      type: 'premium',
      target,
      amount: som,
      months: selectedMonths,
      payMethod: 'balance'
    });

    // Referal bonus (faqat 3 oylik uchun)
    if (selectedMonths === 3 && user.referredBy) {
      const data = await API.getUsers();
      const inviter = data.users.find(x => x.referralCode === user.referredBy);
      if (inviter) {
        inviter.starBonus = (inviter.starBonus || 0) + CONFIG.REFERRAL.premium3Bonus;
        await API.saveUsers(data.users);
        await API.addTransaction({
          type: 'referral-bonus',
          userId: inviter.telegramId,
          username: inviter.username,
          stars: CONFIG.REFERRAL.premium3Bonus,
          status: 'approved',
          adminNote: `${user.firstName || user.username} 3-oylik premium uchun bonus`
        });
      }
    }

    APP.showModal('purchaseLoader');
    buyBtn.disabled = false;
    buyBtn.textContent = 'Sotib olish';
  });
})();
