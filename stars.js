/**
 * Stars - TG Stars sotib olish
 */
(function() {
  const usernameInput = document.getElementById('starsUsername');
  const checkBtn = document.getElementById('starsCheckBtn');
  const amountInput = document.getElementById('starsAmount');
  const priceEl = document.getElementById('starsPrice');
  const maxHint = document.getElementById('starsMaxHint');
  const buyBtn = document.getElementById('starsBuyBtn');

  let usernameValid = false;
  let usernameChecked = '';

  // Username tekshirish
  checkBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim().replace(/^@/, '');
    if (!APP.validateUsername(u)) {
      APP.toast('Username noto\'g\'ri', 'error');
      checkBtn.classList.remove('success');
      checkBtn.classList.add('error');
      checkBtn.textContent = 'Xato';
      setTimeout(() => { checkBtn.textContent = 'Tekshirish'; checkBtn.classList.remove('error'); }, 1500);
      return;
    }
    usernameValid = true;
    usernameChecked = u;
    checkBtn.classList.remove('error');
    checkBtn.classList.add('success');
    checkBtn.textContent = '✓';
    setTimeout(() => { checkBtn.textContent = 'Tekshirish'; checkBtn.classList.remove('success'); }, 1500);
  });

  // Sotuv: 1 star = X so'm. Foydalanuvchining balansiga qarab max stars hisoblaymiz
  amountInput.addEventListener('input', updatePrice);

  function updatePrice() {
    const user = AUTH.getUser();
    const settings = APP.getSettings();
    const rate = settings.starPrice;
    const stars = parseInt(amountInput.value) || 0;
    const som = stars * rate;
    priceEl.textContent = stars > 0 ? APP.formatSom(som) + ' so\'m' : '—';
    if (user) {
      const maxStars = Math.floor(user.balance / rate);
      maxHint.innerHTML = `Maksimal olish mumkin: ${maxStars} ⭐ (${APP.formatSom(maxStars * rate)} so'm)`;
    }
  }

  // Buy
  buyBtn.addEventListener('click', async () => {
    const user = AUTH.getUser();
    if (!user) return APP.toast('Tizimga kiring', 'error');
    if (!usernameValid) return APP.toast('Avval username\'ni tekshiring', 'error');

    const stars = parseInt(amountInput.value) || 0;
    if (stars < 50) return APP.toast('Minimal 50 ⭐', 'error');

    const settings = APP.getSettings();
    const som = stars * settings.starPrice;
    if (user.balance < som) return APP.toast(`Balansda yetarli mablag' yo'q. Yetishmaydi: ${APP.formatSom(som - user.balance)} so'm`, 'error');

    buyBtn.disabled = true;
    buyBtn.textContent = 'Yuborilmoqda...';

    const paid = await APP.payWithBalance(som);
    if (!paid) {
      buyBtn.disabled = false;
      buyBtn.textContent = 'Sotib olish';
      return;
    }

    // Buyurtma jonatish
    const tx = await APP.submitOrder({
      type: 'stars',
      target: '@' + usernameChecked,
      amount: som,
      stars: stars,
      payMethod: 'balance'
    });

    // Referal bonus berish
    await applyReferralBonus(user, stars);

    APP.showModal('purchaseLoader');
    buyBtn.disabled = false;
    buyBtn.textContent = 'Sotib olish';
    amountInput.value = '';
    priceEl.textContent = '—';
  });

  // Referal bonusni hisoblash va taklif qiluvchiga berish
  async function applyReferralBonus(user, starsBought) {
    if (!user.referredBy) return;
    const bonusStars = Math.floor(starsBought / 100) * CONFIG.REFERRAL.starsPerHundred;
    if (bonusStars <= 0) return;

    const data = await API.getUsers();
    const inviter = data.users.find(x => x.referralCode === user.referredBy);
    if (!inviter) return;
    inviter.starBonus = (inviter.starBonus || 0) + bonusStars;
    await API.saveUsers(data.users);
    // Bonusni botga xabar qilish uchun transaction qo'shamiz
    await API.addTransaction({
      type: 'referral-bonus',
      userId: inviter.telegramId,
      username: inviter.username,
      stars: bonusStars,
      status: 'approved',
      adminNote: `${user.firstName || user.username} dan referal bonus`
    });
  }

  // Loader close
  document.getElementById('loaderCloseBtn').addEventListener('click', () => {
    APP.hideModal('purchaseLoader');
    APP.navigate('profile');
  });
})();
