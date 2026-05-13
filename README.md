# 🌟 PRUM STAR

Telegram xizmatlari sayti: TG Stars, TG Premium, NFT sotuvi va NFT arenda (ijara).

**Stack:** Statik frontend (Vanilla JS) + Python bot + jsonbin.io database + TonConnect

---

## 📂 Loyiha tuzilishi

```
prumstar/
├── index.html                  # Asosiy SPA
├── style.css                   # Barcha uslublar
├── vercel.json                 # Vercel konfiguratsiyasi
├── tonconnect-manifest.json    # TonConnect manifest
├── js/
│   ├── config.js              # API kalitlar, sozlamalar
│   ├── api.js                 # JSONBin wrapper
│   ├── auth.js                # Foydalanuvchi authentifikatsiya
│   ├── app.js                 # Asosiy logika va router
│   ├── stars.js               # Stars sotib olish
│   ├── premium.js             # Premium sotib olish
│   ├── nft.js                 # NFT sotuv
│   ├── arenda.js              # NFT ijara + TonConnect
│   ├── profile.js             # Profil, tarix, referal
│   └── admin.js               # Admin panel
└── bot/
    ├── bot.py                 # Python Telegram bot
    ├── requirements.txt
    ├── Procfile               # Railway uchun
    └── runtime.txt
```

---

## 🚀 Deploy qilish

### 1️⃣ Frontend → Vercel

```bash
# Vercel CLI orqali:
npm i -g vercel
cd prumstar
vercel --prod
```

Yoki **GitHub orqali:**

1. Bu papkani GitHub repoga push qiling
2. [vercel.com](https://vercel.com) ga kiring
3. "New Project" → reponi tanlang
4. Framework Preset: **Other**
5. Root Directory: `.`
6. Build Command: bo'sh
7. Output Directory: `.`
8. Deploy ✅

Saytingiz `https://prumstar.vercel.app` (yoki sizga berilgan URL) da ochiladi.

**⚠️ Muhim:** Deploy qilgandan keyin `tonconnect-manifest.json` dagi `url` ni o'zingizning domeningizga o'zgartiring.

---

### 2️⃣ Bot → Railway

1. [railway.app](https://railway.app) ga kiring
2. **New Project** → **Deploy from GitHub repo** → reponi tanlang
3. Root Directory: `bot/`
4. **Variables** bo'limida quyidagilarni qo'shing:

| Variable | Qiymati |
|----------|---------|
| `BOT_TOKEN` | `8879229150:AAFBiG4bnfm9vy5ze2yOBFQ6iaiO6hlBZwk` |
| `ADMIN_ID` | `8135915671` |
| `JSONBIN_KEY` | `$2a$10$XI2TsXyZALwW8eKdo9jxWumllfcHDQM53Bdwn4FCLtr5mlI5oUjl6` |
| `SITE_URL` | `https://prumstar.vercel.app` |
| `BIN_SETTINGS` | `6a04541dc0954111d818a428` |
| `BIN_USERS` | `6a0453bf250b1311c3430672` |
| `BIN_TRANSACTIONS` | `6a04531dc21f119a936300` |
| `POLL_INTERVAL` | `15` |

5. **Settings → Networking** dan public domain yaratish shart emas (bot polling rejimida ishlaydi).

---

### 3️⃣ JSONBin sozlash

[jsonbin.io](https://jsonbin.io) ga kiring va quyidagi 5 ta bin yarating:

#### 📌 `settings` bin (initial JSON):
```json
{
  "cardNumber": "0000 0000 0000 0000",
  "adminId": "8135915671",
  "adminUsername": "YordamAD",
  "starPrice": 215,
  "premium": {
    "p3": 169000,
    "p6": 225000,
    "p12": 409000
  },
  "guides": {
    "stars": "",
    "premium": "",
    "nft": "",
    "arenda": ""
  }
}
```

#### 📌 `users` bin:
```json
{ "users": [] }
```

#### 📌 `transactions` bin:
```json
{ "transactions": [] }
```

#### 📌 `products` bin:
```json
{ "nfts": [] }
```

#### 📌 `rentals` bin:
```json
{ "rentals": [] }
```

**Bin ID larni** olib, `js/config.js` ichidagi `BINS` obyektiga yozing.

#### CORS sozlamalari (juda muhim!)
JSONBin → Profile → **Allowed Origins** bo'limiga sayt domeningizni qo'shing:
- `https://prumstar.vercel.app`
- `http://localhost:*` (test uchun)

---

## ⚙️ Sayt sozlamalari (Admin paneldan)

1. Saytni oching → **Profil** sahifasiga o'ting
2. O'ng yuqoridagi ⚙️ tugmasini bosing
3. Parol: `lochinbek0224`
4. **Sozlamalar** tabidan:
   - Karta raqami (foydalanuvchilar ko'radi)
   - Star narxi (1 ⭐ = X so'm)
   - Premium narxlari
   - YouTube qo'llanma URLlari

---

## 🛠️ Mahalliy test

```bash
# Frontend
cd prumstar
python -m http.server 8000
# Brauzerda: http://localhost:8000

# Bot
cd prumstar/bot
pip install -r requirements.txt
python bot.py
```

---

## 🔄 Asosiy oqimlar

### Balans to'ldirish:
1. Foydalanuvchi → Profil → "Balansni to'ldirish"
2. Summa kiritadi → karta raqamini ko'radi → to'lov qiladi
3. "Botga yuborish" tugmasini bosadi → bot ochiladi (deep-link `?start=topup_USERID_AMOUNT`)
4. Foydalanuvchi chek rasmini botga yuboradi
5. Bot adminga forward qiladi (inline ✅/❌ tugmalar bilan)
6. Admin ✅ bossa → balans qo'shiladi, foydalanuvchiga xabar
7. Admin ❌ bossa → rad etiladi

### Buyurtma (Stars / Premium / NFT / Arenda):
1. Foydalanuvchi saytda mahsulot tanlaydi
2. Balansdan to'laydi (yoki yetarli emas bo'lsa - to'ldirish kerak)
3. Buyurtma `jsonbin.transactions` ga `pending` holatida saqlanadi
4. Bot har 15 soniyada polling qiladi va yangi `pending` buyurtmalarni adminga yuboradi
5. Admin botda ✅/❌ tugmalari orqali yopib qo'yadi
6. Foydalanuvchiga avtomatik xabar boradi

### Referal:
- Har bir foydalanuvchining unikal `?ref=CODE` havolasi bor (Profil → Referal)
- Taklif qilingan kishi xarid qilganida:
  - **Stars:** har 100 ⭐ uchun taklif qiluvchiga 1 ⭐
  - **3-oylik Premium:** taklif qiluvchiga 10 ⭐
  - **NFT/Arenda:** bonus yo'q
- Bonus admin tomonidan qo'lda foydalanuvchining Telegram hisobiga jonatiladi (orderlar tarixida ko'rinadi)

### NFT Arenda + TonConnect:
1. Foydalanuvchi giftlarni tanlaydi
2. "Ijaraga olish" → modal ochiladi
3. Kunlar sonini tanlaydi (min 3 kun)
4. **TonConnect** tugmasini bosadi → Tonkeeper/Tonhub avtomatik ochiladi
5. Hamyon ulanadi → manzil avtomatik to'ldiriladi
6. Tasdiqlaydi → buyurtma adminga boradi
7. Admin Fragment.com orqali NFT ni jonatadi

---

## 🛡️ Xavfsizlik eslatmasi

- jsonbin Master Key frontend kodda ko'rinadi (bu statik sayt uchun normal)
- Admin parolini doim o'zgartiring (`js/config.js` → `ADMIN.PASSWORD`)
- Bot tokenini hech kimga bermang. Agar leak bo'lsa — [@BotFather](https://t.me/BotFather) → `/revoke` → yangi token oling

---

## 🐛 Muammolar

| Muammo | Yechim |
|--------|--------|
| Sayt yuklanmadi | jsonbin CORS sozlamalarini tekshiring |
| Bot pending orderlarni ko'rmayapti | Railway loglarini ko'ring; `JSONBIN_KEY` to'g'rimi? |
| TonConnect ochilmaydi | `tonconnect-manifest.json` da `url` saytingizga to'g'ri kelsin |
| Admin panel parol qabul qilmayapti | `js/config.js` da `ADMIN.PASSWORD` ni tekshiring |

---

## 👤 Kontaktlar

- Admin: [@YordamAD](https://t.me/YordamAD)
- Kanal: [@PRUM_STAR](https://t.me/PRUM_STAR)
- Bot: [@PrumTolovBot](https://t.me/PrumTolovBot)

Omad! 🚀
