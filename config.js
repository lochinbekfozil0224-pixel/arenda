/**
 * PRUM STAR - Configuration
 * MUHIM: jsonbin keys bu yerda. Mahalliy ishlatish uchun mos.
 * Productionga deploy qilishdan oldin: jsonbin'da CORS allowed origins'ga sayt domeningni qo'sh.
 */
window.CONFIG = {
  // jsonbin.io credentials
  JSONBIN: {
    MASTER_KEY: '$2a$10$XI2TsXyZALwW8eKdo9jxWumllfcHDQM53Bdwn4FCLtr5mlI5oUjl6',
    ACCESS_KEY: '$2a$10$tTWjDfgh7sNuPmHB43Oe2.QNy3iX22YtYMl/HcWts3xba43YUudiq',
    // Sizning bin ID laringizni shu yerga yozing (screenshot'dan):
    BINS: {
      settings:     '6a04541dc0954111d818a428',
      rentals:      '6a04543adc21f119a93637d',
      transactions: '6a04531dc21f119a936300',
      products:     '6a0453d9c0954111d818a29d',
      users:        '6a0453bf250b1311c3430672'
    }
  },

  // Bot va admin info
  BOT: {
    USERNAME: 'PrumTolovBot',
    URL: 'https://t.me/PrumTolovBot'
  },
  ADMIN: {
    ID: '8135915671',
    USERNAME: 'YordamAD',
    PASSWORD: 'lochinbek0224'   // Admin paneliga kirish paroli
  },

  // Sayt nomi
  SITE: {
    NAME: 'PRUM STAR',
    SUBTITLE: 'Orzon star masgani',
    CHANNEL: 'https://t.me/PRUM_STAR'
  },

  // Default narxlar (settings binda mavjud bo'lmasa)
  DEFAULTS: {
    starPrice: 215,
    premium: { p3: 169000, p6: 225000, p12: 409000 },
    cardNumber: '0000 0000 0000 0000',
    guides: {
      stars:   'https://www.youtube.com/embed/dQw4w9WgXcQ',
      premium: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      nft:     'https://www.youtube.com/embed/dQw4w9WgXcQ',
      arenda:  'https://www.youtube.com/embed/dQw4w9WgXcQ'
    }
  },

  // Referal bonuslari
  REFERRAL: {
    starsPerHundred: 1,        // har 100 star sotib olishga 1 star
    premium3Bonus: 10          // 3 oylik premium uchun 10 star
  },

  // Arenda
  RENTAL: {
    minDays: 3
  },

  // TonConnect manifest
  TONCONNECT_MANIFEST: '/tonconnect-manifest.json'
};
