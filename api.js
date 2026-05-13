/**
 * JSONBin.io API wrapper
 */
window.API = (function() {
  const BASE = 'https://api.jsonbin.io/v3';
  const HEADERS = {
    'Content-Type': 'application/json',
    'X-Master-Key': CONFIG.JSONBIN.MASTER_KEY
  };

  // In-memory cache - har bir bin uchun
  const cache = {};

  async function getBin(binId, useCache = true) {
    if (useCache && cache[binId]) return cache[binId];
    try {
      const res = await fetch(`${BASE}/b/${binId}/latest`, { headers: HEADERS });
      if (!res.ok) throw new Error('Read fail: ' + res.status);
      const data = await res.json();
      cache[binId] = data.record;
      return data.record;
    } catch (e) {
      console.error('getBin error:', binId, e);
      return null;
    }
  }

  async function updateBin(binId, payload) {
    try {
      const res = await fetch(`${BASE}/b/${binId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Update fail: ' + res.status);
      const data = await res.json();
      cache[binId] = payload;
      return data;
    } catch (e) {
      console.error('updateBin error:', binId, e);
      return null;
    }
  }

  // === Specific helpers ===

  async function getSettings() {
    const data = await getBin(CONFIG.JSONBIN.BINS.settings);
    if (!data) return getDefaultSettings();
    return Object.assign(getDefaultSettings(), data);
  }
  function getDefaultSettings() {
    return {
      cardNumber: CONFIG.DEFAULTS.cardNumber,
      adminId: CONFIG.ADMIN.ID,
      adminUsername: CONFIG.ADMIN.USERNAME,
      starPrice: CONFIG.DEFAULTS.starPrice,
      premium: { ...CONFIG.DEFAULTS.premium },
      guides: { ...CONFIG.DEFAULTS.guides }
    };
  }
  async function saveSettings(settings) {
    return await updateBin(CONFIG.JSONBIN.BINS.settings, settings);
  }

  async function getUsers() {
    const data = await getBin(CONFIG.JSONBIN.BINS.users, false);
    if (!data || !data.users) return { users: [] };
    return data;
  }
  async function saveUsers(users) {
    return await updateBin(CONFIG.JSONBIN.BINS.users, { users });
  }
  async function findUser(telegramId) {
    const { users } = await getUsers();
    return users.find(u => String(u.telegramId) === String(telegramId));
  }
  async function upsertUser(user) {
    const data = await getUsers();
    const idx = data.users.findIndex(u => String(u.telegramId) === String(user.telegramId));
    if (idx >= 0) data.users[idx] = { ...data.users[idx], ...user };
    else data.users.push(user);
    await saveUsers(data.users);
    return user;
  }
  async function updateUserBalance(telegramId, delta) {
    const data = await getUsers();
    const u = data.users.find(x => String(x.telegramId) === String(telegramId));
    if (!u) return null;
    u.balance = (u.balance || 0) + delta;
    if (u.balance < 0) u.balance = 0;
    await saveUsers(data.users);
    return u;
  }

  async function getTransactions() {
    const d = await getBin(CONFIG.JSONBIN.BINS.transactions, false);
    if (!d || !d.transactions) return { transactions: [] };
    return d;
  }
  async function addTransaction(tx) {
    const d = await getTransactions();
    tx.id = tx.id || ('tx_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    tx.createdAt = tx.createdAt || new Date().toISOString();
    d.transactions.unshift(tx);
    if (d.transactions.length > 500) d.transactions = d.transactions.slice(0, 500);
    await updateBin(CONFIG.JSONBIN.BINS.transactions, d);
    return tx;
  }
  async function updateTransaction(id, updates) {
    const d = await getTransactions();
    const t = d.transactions.find(x => x.id === id);
    if (!t) return null;
    Object.assign(t, updates);
    await updateBin(CONFIG.JSONBIN.BINS.transactions, d);
    return t;
  }

  async function getProducts() {
    const d = await getBin(CONFIG.JSONBIN.BINS.products, false);
    if (!d) return { nfts: [] };
    return d;
  }
  async function saveProducts(prods) {
    return await updateBin(CONFIG.JSONBIN.BINS.products, prods);
  }

  async function getRentals() {
    const d = await getBin(CONFIG.JSONBIN.BINS.rentals, false);
    if (!d) return { rentals: [] };
    return d;
  }
  async function saveRentals(r) {
    return await updateBin(CONFIG.JSONBIN.BINS.rentals, r);
  }

  // Cache reset
  function clearCache() { Object.keys(cache).forEach(k => delete cache[k]); }

  return {
    getBin, updateBin,
    getSettings, saveSettings,
    getUsers, saveUsers, findUser, upsertUser, updateUserBalance,
    getTransactions, addTransaction, updateTransaction,
    getProducts, saveProducts,
    getRentals, saveRentals,
    clearCache
  };
})();
