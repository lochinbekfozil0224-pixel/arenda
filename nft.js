/**
 * NFT - sotib olish moduli (rasm + nom + narx)
 */
window.NFT = (function() {
  const grid = document.getElementById('nftGrid');
  const searchInput = document.getElementById('nftSearch');
  const recipientInput = document.getElementById('nftRecipient');
  let allNfts = [];
  let selectedNft = null;

  async function refresh() {
    const { nfts } = await API.getProducts();
    allNfts = nfts || [];
    render(allNfts);
  }

  function render(items) {
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">Hozircha NFTlar yo\'q</div>';
      return;
    }
    grid.innerHTML = items.map(nft => `
      <div class="nft-card" data-nft-id="${nft.id}">
        <div class="nft-image">
          ${nft.image ? `<img src="${nft.image}" alt="${nft.name}" loading="lazy">` : '🎁'}
          <div class="nft-check-badge">✓</div>
        </div>
        <div class="nft-info">
          <div class="nft-name">${nft.name}</div>
          <div class="nft-num">${nft.number || ''}</div>
          <div class="nft-price-row">
            <div class="nft-price-badge">${APP.formatSom(nft.price)} so'm</div>
            ${nft.tgLink ? `<a class="nft-eye-btn" href="${nft.tgLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()">👁</a>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.nft-card').forEach(card => {
      card.addEventListener('click', () => openBuyModal(card.dataset.nftId));
    });
  }

  function openBuyModal(id) {
    const nft = allNfts.find(x => x.id === id);
    if (!nft) return;
    selectedNft = nft;

    const recipient = (recipientInput.value || '').trim().replace(/^@/, '');
    if (!APP.validateUsername(recipient)) {
      APP.toast('Avval qabul qiluvchining @username\'ini kiriting', 'error');
      recipientInput.focus();
      return;
    }

    const html = `
      <div style="text-align:center;">
        <img src="${nft.image}" style="width:120px;height:120px;border-radius:18px;object-fit:cover;margin:0 auto 14px;display:block;">
        <h3 style="margin-bottom:6px;">${nft.name}</h3>
        <div style="color:#a0a4b8;font-size:13px;margin-bottom:12px;">${nft.number || ''}</div>
        <div style="background:rgba(167,139,250,0.1);padding:14px;border-radius:12px;margin-bottom:14px;">
          <div style="font-size:12px;color:#a0a4b8;">Qabul qiluvchi:</div>
          <div style="font-weight:700;color:#a78bfa;font-size:16px;">@${recipient}</div>
        </div>
        <div style="font-size:24px;font-weight:800;">${APP.formatSom(nft.price)} so'm</div>
      </div>
    `;
    document.getElementById('nftBuyDetails').innerHTML = html;
    APP.showModal('nftBuyModal');
  }

  document.getElementById('nftBuyConfirm').addEventListener('click', async () => {
    if (!selectedNft) return;
    const user = AUTH.getUser();
    if (!user) return APP.toast('Tizimga kiring', 'error');

    const recipient = (recipientInput.value || '').trim().replace(/^@/, '');
    if (!APP.validateUsername(recipient)) return APP.toast('Username noto\'g\'ri', 'error');

    if (user.balance < selectedNft.price) {
      return APP.toast(`Balansda yetarli mablag' yo'q. Yetishmaydi: ${APP.formatSom(selectedNft.price - user.balance)} so'm`, 'error');
    }

    const paid = await APP.payWithBalance(selectedNft.price);
    if (!paid) return;

    await APP.submitOrder({
      type: 'nft',
      target: '@' + recipient,
      amount: selectedNft.price,
      nftId: selectedNft.id,
      nftName: selectedNft.name,
      nftImage: selectedNft.image,
      payMethod: 'balance'
    });

    APP.hideModal('nftBuyModal');
    APP.showModal('purchaseLoader');
    selectedNft = null;
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    render(allNfts.filter(x => (x.name + (x.number || '')).toLowerCase().includes(q)));
  });

  return { refresh };
})();
