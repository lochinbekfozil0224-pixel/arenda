"""
PRUM STAR — To'lov boti (@PrumTolovBot)

Vazifalari:
  1. /start (deep link bilan): topup_USERID_AMOUNT, ref_CODE
  2. Foydalanuvchidan chek (rasm) qabul qilib, adminga forward qiladi
  3. Adminga inline tugmalar: ✅ Tasdiqlash / ❌ Bekor qilish
  4. Tasdiq bo'lsa - jsonbin'da balansga qo'shadi, foydalanuvchiga xabar
  5. jsonbin'dagi pending buyurtmalarni polling qiladi va adminga jonatadi
"""

import os
import asyncio
import logging
import json
from datetime import datetime
import requests
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    InputMediaPhoto
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, filters
)

# ============ CONFIG ============
BOT_TOKEN     = os.environ.get('BOT_TOKEN',     '8879229150:AAFBiG4bnfm9vy5ze2yOBFQ6iaiO6hlBZwk')
ADMIN_ID      = int(os.environ.get('ADMIN_ID',  '8135915671'))
JSONBIN_KEY   = os.environ.get('JSONBIN_KEY',   '$2a$10$XI2TsXyZALwW8eKdo9jxWumllfcHDQM53Bdwn4FCLtr5mlI5oUjl6')
SITE_URL      = os.environ.get('SITE_URL',      'https://prumstar.vercel.app')

# Bin IDs
BIN_SETTINGS     = os.environ.get('BIN_SETTINGS',     '6a04541dc0954111d818a428')
BIN_USERS        = os.environ.get('BIN_USERS',        '6a0453bf250b1311c3430672')
BIN_TRANSACTIONS = os.environ.get('BIN_TRANSACTIONS', '6a04531dc21f119a936300')

POLL_INTERVAL = int(os.environ.get('POLL_INTERVAL', '15'))  # sekund

JSONBIN_BASE = 'https://api.jsonbin.io/v3'
HEADERS = {'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY}

# In-memory: qaysi tx ID lar adminga yuborilgan (qayta yubormaslik uchun)
sent_to_admin = set()
# Topup amount kuting holatlar: user_id -> {amount, txId}
pending_topups = {}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============ JSONBIN HELPERS ============
def jb_get(bin_id):
    try:
        r = requests.get(f'{JSONBIN_BASE}/b/{bin_id}/latest', headers=HEADERS, timeout=15)
        if r.ok: return r.json().get('record', {})
    except Exception as e:
        logger.error('jb_get error: %s', e)
    return {}

def jb_put(bin_id, data):
    try:
        r = requests.put(f'{JSONBIN_BASE}/b/{bin_id}', headers=HEADERS, json=data, timeout=15)
        return r.ok
    except Exception as e:
        logger.error('jb_put error: %s', e)
    return False

def add_transaction(tx):
    data = jb_get(BIN_TRANSACTIONS) or {'transactions': []}
    data.setdefault('transactions', [])
    tx.setdefault('id', f"tx_{int(datetime.now().timestamp()*1000)}")
    tx.setdefault('createdAt', datetime.now().isoformat())
    data['transactions'].insert(0, tx)
    data['transactions'] = data['transactions'][:500]
    jb_put(BIN_TRANSACTIONS, data)
    return tx

def update_transaction(tx_id, updates):
    data = jb_get(BIN_TRANSACTIONS) or {'transactions': []}
    for t in data.get('transactions', []):
        if t.get('id') == tx_id:
            t.update(updates)
            jb_put(BIN_TRANSACTIONS, data)
            return t
    return None

def get_user(telegram_id):
    data = jb_get(BIN_USERS) or {'users': []}
    for u in data.get('users', []):
        if str(u.get('telegramId')) == str(telegram_id):
            return u
    return None

def update_user_balance(telegram_id, delta):
    data = jb_get(BIN_USERS) or {'users': []}
    for u in data.get('users', []):
        if str(u.get('telegramId')) == str(telegram_id):
            u['balance'] = max(0, (u.get('balance', 0) or 0) + delta)
            jb_put(BIN_USERS, data)
            return u
    # Foydalanuvchi yo'q - yangi yaratamiz
    new_user = {
        'telegramId': str(telegram_id),
        'username': '',
        'firstName': '',
        'balance': max(0, delta),
        'referralCode': f"r{telegram_id}",
        'referrals': [],
        'starBonus': 0,
        'createdAt': datetime.now().isoformat()
    }
    data.setdefault('users', []).append(new_user)
    jb_put(BIN_USERS, data)
    return new_user

def upsert_user_basic(telegram_id, username, first_name):
    data = jb_get(BIN_USERS) or {'users': []}
    data.setdefault('users', [])
    for u in data['users']:
        if str(u.get('telegramId')) == str(telegram_id):
            u['username'] = username or u.get('username', '')
            u['firstName'] = first_name or u.get('firstName', '')
            jb_put(BIN_USERS, data)
            return u
    new_user = {
        'telegramId': str(telegram_id),
        'username': username or '',
        'firstName': first_name or '',
        'balance': 0,
        'referralCode': f"r{telegram_id}",
        'referrals': [],
        'starBonus': 0,
        'createdAt': datetime.now().isoformat()
    }
    data['users'].append(new_user)
    jb_put(BIN_USERS, data)
    return new_user


# ============ HANDLERS ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    upsert_user_basic(user.id, user.username, user.first_name)
    args = context.args

    # Deep link: topup_USERID_AMOUNT
    if args and args[0].startswith('topup_'):
        parts = args[0].split('_')
        if len(parts) >= 3:
            try:
                amount = int(parts[2])
                pending_topups[user.id] = {'amount': amount}
                settings = jb_get(BIN_SETTINGS)
                card = settings.get('cardNumber', '0000 0000 0000 0000')
                await update.message.reply_text(
                    f"💳 *Balans to'ldirish*\n\n"
                    f"Quyidagi karta raqamiga *{amount:,}* so'm o'tkazma qiling:\n\n"
                    f"`{card}`\n\n"
                    f"To'lov qilgach, *chek rasmini* shu chatga yuboring. Admin tasdiqlaganda balansingiz to'ldiriladi.",
                    parse_mode='Markdown'
                )
                return
            except ValueError:
                pass

    # Default start
    keyboard = [
        [InlineKeyboardButton("🌐 Saytni ochish", url=SITE_URL)],
        [InlineKeyboardButton("💬 Adminga yozish", url=f"https://t.me/YordamAD")]
    ]
    await update.message.reply_text(
        f"👋 Assalomu alaykum, *{user.first_name}*!\n\n"
        f"🌟 *PRUM STAR* — Telegram xizmatlari botiga xush kelibsiz.\n\n"
        f"Botning vazifasi:\n"
        f"• Balans to'ldirish chekini qabul qilish\n"
        f"• Buyurtmalaringiz holati haqida xabar berish\n\n"
        f"Asosiy xizmatlar saytda mavjud 👇",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchidan chek rasmi qabul qilamiz va adminga forward qilamiz."""
    user = update.effective_user
    photo = update.message.photo[-1]  # eng katta rasm

    if user.id == ADMIN_ID:
        await update.message.reply_text("Admin uchun chek qabul qilinmaydi.")
        return

    # Topup data
    topup = pending_topups.get(user.id)
    if not topup:
        await update.message.reply_text(
            "❓ Avval saytda balans to'ldirish summasini kiriting va 'Botga yuborish' tugmasini bosing.\n\n"
            f"🌐 {SITE_URL}"
        )
        return

    amount = topup['amount']

    # Transaction yaratamiz
    tx = add_transaction({
        'type': 'topup',
        'userId': str(user.id),
        'username': user.username or '',
        'firstName': user.first_name or '',
        'amount': amount,
        'status': 'pending',
        'adminNote': 'Chek botga yuborildi'
    })

    # Adminga forward qilish + inline buttons
    caption = (
        f"💰 *YANGI BALANS TO'LDIRISH*\n\n"
        f"👤 Foydalanuvchi: {user.first_name} (@{user.username or '—'})\n"
        f"🆔 ID: `{user.id}`\n"
        f"💵 Summa: *{amount:,}* so'm\n\n"
        f"Tx ID: `{tx['id']}`"
    )
    keyboard = [[
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"approve|{tx['id']}|{user.id}|{amount}"),
        InlineKeyboardButton("❌ Bekor qilish", callback_data=f"reject|{tx['id']}|{user.id}|{amount}")
    ]]
    await context.bot.send_photo(
        chat_id=ADMIN_ID,
        photo=photo.file_id,
        caption=caption,
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    pending_topups.pop(user.id, None)
    await update.message.reply_text(
        "✅ Chek qabul qilindi va adminga yuborildi.\n\n"
        "Admin tekshiruvidan keyin balansingiz to'ldiriladi. Odatda bu 10-30 daqiqa davom etadi.\n\n"
        "💡 Sayt orqali holatni kuzating: " + SITE_URL
    )


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin tasdiqlash/bekor qilish tugmalari."""
    q = update.callback_query
    await q.answer()

    if q.from_user.id != ADMIN_ID:
        await q.answer("Faqat admin uchun!", show_alert=True)
        return

    parts = q.data.split('|')
    action = parts[0]

    if action in ('approve', 'reject'):
        tx_id = parts[1]
        user_id = int(parts[2])
        amount = int(parts[3]) if len(parts) > 3 else 0

        if action == 'approve':
            # Balansga qo'shamiz (faqat topup)
            tx = jb_get(BIN_TRANSACTIONS).get('transactions', [])
            tx_obj = next((t for t in tx if t.get('id') == tx_id), None)
            if tx_obj and tx_obj.get('type') == 'topup':
                update_user_balance(user_id, amount)
            update_transaction(tx_id, {'status': 'approved', 'adminNote': 'Admin tasdiqladi'})
            await q.edit_message_caption(
                caption=(q.message.caption or '') + "\n\n✅ *TASDIQLANDI*",
                parse_mode='Markdown'
            )
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=f"✅ *Balansingiz to'ldirildi!*\n\n💵 +{amount:,} so'm\n\nEndi sayt orqali xarid qilishingiz mumkin: {SITE_URL}",
                    parse_mode='Markdown'
                )
            except Exception as e:
                logger.error('Notify user failed: %s', e)

        elif action == 'reject':
            update_transaction(tx_id, {'status': 'rejected', 'adminNote': 'Admin rad etdi'})
            await q.edit_message_caption(
                caption=(q.message.caption or '') + "\n\n❌ *RAD ETILDI*",
                parse_mode='Markdown'
            )
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=f"❌ Balans to'ldirish rad etildi.\n\nSavollaringiz bo'lsa adminga murojaat qiling: @YordamAD"
                )
            except Exception as e:
                logger.error('Notify user failed: %s', e)

    elif action in ('order_approve', 'order_reject'):
        tx_id = parts[1]
        user_id = parts[2] if len(parts) > 2 else None

        tx = jb_get(BIN_TRANSACTIONS).get('transactions', [])
        tx_obj = next((t for t in tx if t.get('id') == tx_id), None)
        if not tx_obj:
            await q.edit_message_text("Buyurtma topilmadi.")
            return

        if action == 'order_approve':
            update_transaction(tx_id, {'status': 'approved', 'adminNote': 'Admin amalga oshirdi'})
            new_text = (q.message.text or q.message.caption or '') + "\n\n✅ *TASDIQLANDI*"
            if q.message.photo:
                await q.edit_message_caption(caption=new_text, parse_mode='Markdown')
            else:
                await q.edit_message_text(new_text, parse_mode='Markdown')
            try:
                await context.bot.send_message(
                    chat_id=int(user_id),
                    text=f"✅ Buyurtmangiz bajarildi!\n\n{order_summary(tx_obj)}"
                )
            except Exception as e:
                logger.error('User notify failed: %s', e)

        elif action == 'order_reject':
            # Balansga qaytarish (topup va bonus emas bo'lsa)
            if tx_obj.get('type') not in ('topup', 'referral-bonus') and tx_obj.get('amount'):
                update_user_balance(int(user_id), tx_obj['amount'])
            update_transaction(tx_id, {'status': 'rejected', 'adminNote': 'Admin rad etdi'})
            new_text = (q.message.text or q.message.caption or '') + "\n\n❌ *RAD ETILDI* (balans qaytarildi)"
            if q.message.photo:
                await q.edit_message_caption(caption=new_text, parse_mode='Markdown')
            else:
                await q.edit_message_text(new_text, parse_mode='Markdown')
            try:
                await context.bot.send_message(
                    chat_id=int(user_id),
                    text="❌ Buyurtmangiz bekor qilindi. Balansingizga summa qaytarildi.\n\nSavollar: @YordamAD"
                )
            except Exception as e:
                logger.error('User notify failed: %s', e)


def order_summary(tx):
    """Buyurtma matni formatlash."""
    t = tx.get('type')
    if t == 'stars':
        return f"⭐ {tx.get('stars')} Stars → {tx.get('target')}"
    if t == 'premium':
        return f"💎 {tx.get('months')}-oylik Premium → {tx.get('target')}"
    if t == 'nft':
        return f"🎁 {tx.get('nftName')} → {tx.get('target')}"
    if t == 'rental':
        return f"🦊 {tx.get('nftName')} ({tx.get('days')} kun)"
    return t


# ============ POLLING jsonbin TRANSACTIONS ============
async def poll_orders(context: ContextTypes.DEFAULT_TYPE):
    """jsonbin'dagi pending order'larni adminga yuborish."""
    try:
        data = jb_get(BIN_TRANSACTIONS) or {}
        txs = data.get('transactions', [])
        for t in txs:
            if t.get('status') != 'pending': continue
            if t.get('type') == 'topup': continue  # topup'lar chek bilan keladi
            tx_id = t.get('id')
            if tx_id in sent_to_admin: continue

            await send_order_to_admin(context, t)
            sent_to_admin.add(tx_id)
    except Exception as e:
        logger.error('Poll error: %s', e)


async def send_order_to_admin(context, tx):
    """Bitta orderni adminga yuborish."""
    t = tx.get('type')
    user_id = tx.get('userId')
    username = tx.get('username', '—')
    first_name = tx.get('firstName', '')
    amount = tx.get('amount', 0)
    target = tx.get('target', '')

    title = {
        'stars':  '⭐ YANGI STARS BUYURTMASI',
        'premium':'💎 YANGI PREMIUM BUYURTMASI',
        'nft':    '🎁 YANGI NFT BUYURTMASI',
        'rental': '🦊 YANGI ARENDA BUYURTMASI',
        'premium-1m': '💬 1-OYLIK PREMIUM (LICHKA)'
    }.get(t, '📋 YANGI BUYURTMA')

    details = []
    if t == 'stars':
        details.append(f"⭐ Summa: *{tx.get('stars')}* stars")
        details.append(f"➡️ Qabul qiluvchi: {target}")
    elif t == 'premium':
        details.append(f"💎 Tarif: *{tx.get('months')}-oylik*")
        details.append(f"➡️ Qabul qiluvchi: {target}")
    elif t == 'nft':
        details.append(f"🎁 NFT: *{tx.get('nftName')}*")
        details.append(f"➡️ Qabul qiluvchi: {target}")
    elif t == 'rental':
        details.append(f"🦊 NFT: *{tx.get('nftName')}*")
        details.append(f"📅 Muddat: *{tx.get('days')}* kun")
        details.append(f"🔗 TonConnect: `{tx.get('tonUrl', '—')}`")

    caption = (
        f"{title}\n\n"
        f"👤 Foydalanuvchi: {first_name} (@{username})\n"
        f"🆔 ID: `{user_id}`\n"
        f"💵 To'langan: *{amount:,}* so'm\n\n"
        + "\n".join(details) +
        f"\n\nTx ID: `{tx.get('id')}`"
    )

    keyboard = [[
        InlineKeyboardButton("✅ Bajardim", callback_data=f"order_approve|{tx.get('id')}|{user_id}"),
        InlineKeyboardButton("❌ Bekor qilish", callback_data=f"order_reject|{tx.get('id')}|{user_id}")
    ]]

    try:
        image = tx.get('nftImage')
        if image:
            await context.bot.send_photo(
                chat_id=ADMIN_ID,
                photo=image,
                caption=caption,
                parse_mode='Markdown',
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        else:
            await context.bot.send_message(
                chat_id=ADMIN_ID,
                text=caption,
                parse_mode='Markdown',
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
    except Exception as e:
        logger.error('send order failed: %s', e)


async def help_command(update, context):
    await update.message.reply_text(
        "📖 *Yordam*\n\n"
        "/start — Bosh menyu\n\n"
        "Balansni to'ldirish uchun:\n"
        "1. Saytga kiring\n"
        "2. 'Balansni to'ldirish' tugmasini bosing\n"
        "3. Summani kiriting va 'Botga yuborish'ni bosing\n"
        "4. Karta raqamiga to'lov qiling va chekni shu botga yuboring\n\n"
        f"🌐 Sayt: {SITE_URL}\n"
        "💬 Admin: @YordamAD",
        parse_mode='Markdown'
    )


def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('help', help_command))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(CallbackQueryHandler(callback_handler))

    # JobQueue: orderlarni polling qilish
    job_queue = app.job_queue
    job_queue.run_repeating(poll_orders, interval=POLL_INTERVAL, first=10)

    logger.info('PRUM STAR boti ishga tushdi')
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
