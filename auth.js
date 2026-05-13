/**
 * Auth - foydalanuvchini aniqlash.
 * 1) Telegram WebApp ichida ochilsa - tg.initDataUnsafe.user dan oladi
 * 2) Brauzerda ochilsa - localStorage'da saqlangan ID dan oladi
 * 3) URL'da ?ref=xxx bo'lsa - referal sifatida ishlatadi
 */
window.AUTH = (function() {
  let currentUser = null;

  function isTelegramWebApp() {
    return typeof window.Telegram !== 'undefined' && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user;
  }

  function getReferralFromUrl() {
    const params = new URLSearchParams(location.search);
    return params.get('ref') || params.get('start') || null;
  }

  function genReferralCode(userId) {
    // Short, URL-safe referral code based on user id
    return 'r' + parseInt(userId).toString(36) + Math.random().toString(36).slice(2, 5);
  }

  async function init() {
    let telegramId, username, firstName, photoUrl;

    if (isTelegramWebApp()) {
      const tg = window.Telegram.WebApp;
      const u = tg.initDataUnsafe.user;
      telegramId = String(u.id);
      username = u.username || '';
      firstName = u.first_name || '';
      photoUrl = u.photo_url || '';
      try { tg.expand(); tg.ready(); } catch(e) {}
    } else {
      // Brauzerda: avval localStorage, keyin promt
      telegramId = localStorage.getItem('prumstar_user_id');
      if (!telegramId) {
        // Telegram ID so'rash
        telegramId = await promptForTelegramId();
        if (!telegramId) return null;
        localStorage.setItem('prumstar_user_id', telegramId);
      }
      username = localStorage.getItem('prumstar_user_username') || '';
      firstName = localStorage.getItem('prumstar_user_name') || ('User' + telegramId.slice(-3));
    }

    // Db'da bormi tekshirish
    let user = await API.findUser(telegramId);
    if (!user) {
      // Yangi user yaratish
      const refCode = genReferralCode(telegramId);
      const refBy = getReferralFromUrl();

      user = {
        telegramId,
        username,
        firstName,
        photoUrl,
        balance: 0,
        referralCode: refCode,
        referredBy: refBy,
        referrals: [],
        starBonus: 0,
        createdAt: new Date().toISOString()
      };
      await API.upsertUser(user);

      // Agar referal orqali kelgan bo'lsa - taklif qiluvchining ro'yxatiga qo'shamiz
      if (refBy) {
        const usersData = await API.getUsers();
        const inviter = usersData.users.find(x => x.referralCode === refBy);
        if (inviter) {
          inviter.referrals = inviter.referrals || [];
          if (!inviter.referrals.includes(telegramId)) {
            inviter.referrals.push(telegramId);
            await API.saveUsers(usersData.users);
          }
        }
      }
    } else {
      // Mavjud user - username/photo'ni yangilash
      if (username && user.username !== username) {
        user.username = username;
        await API.upsertUser(user);
      }
    }

    currentUser = user;
    return user;
  }

  function promptForTelegramId() {
    return new Promise(resolve => {
      const id = prompt(
        "👋 PRUM STAR\n\n" +
        "Iltimos, Telegram ID raqamingizni kiriting.\n" +
        "(@userinfobot ga /start yuborib ID ni ko'rishingiz mumkin)"
      );
      if (id && /^\d{5,15}$/.test(id.trim())) resolve(id.trim());
      else resolve(null);
    });
  }

  function getUser() { return currentUser; }
  async function refresh() {
    if (!currentUser) return null;
    currentUser = await API.findUser(currentUser.telegramId);
    return currentUser;
  }

  return { init, getUser, refresh, getReferralFromUrl };
})();
