const TelegramBot = require('node-telegram-bot-api')
const uniqRow = require('./lib/pg.lib.js')
require('dotenv').config()

const bot = new TelegramBot(process.env.TOKEN, { polling: true })
const sessions = {}

async function checkUser(msg) {
    const chatId = msg.chat.id
    const username = msg.from.username || null
    const firstName = msg.from.first_name || null
    const lastName = msg.from.last_name || null
    
    try {
        // Avval chat_id bo'yicha tekshiramiz
        const existing = await uniqRow(
            `SELECT * FROM users WHERE user_chat_id = $1 LIMIT 1`,
            chatId
        )
        
        if (existing.rows.length > 0) {
            // Agar username o'zgargan bo'lsa, yangilaymiz
            const user = existing.rows[0]
            if (user.user_username !== username) {
                await uniqRow(
                    `UPDATE users SET user_username = $1, user_first_name = $2, user_last_name = $3 WHERE user_chat_id = $4`,
                    username,
                    firstName,
                    lastName,
                    chatId
                )
            }
            return user
        }
        
        // username bo'yicha ham tekshirib, agar bor bo'lsa, chat_id ni yangilaymiz
        if (username) {
            const byUsername = await uniqRow(
                `SELECT * FROM users WHERE LOWER(user_username) = LOWER($1) LIMIT 1`,
                username
            )
            if (byUsername.rows.length > 0) {
                await uniqRow(
                    `UPDATE users SET user_chat_id = $1 WHERE LOWER(user_username) = LOWER($2)`,
                    chatId,
                    username
                )
                return byUsername.rows[0]
            }
        }
        
        // Yangi user qo'shamiz
        const ins = await uniqRow(
            `INSERT INTO users (user_chat_id, user_username, user_first_name, user_last_name, user_status)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (user_chat_id) DO NOTHING
       RETURNING *`,
            chatId,
            username,
            firstName,
            lastName
        )
        return ins.rows[0]
    } catch (err) {
        console.error('checkUser error:', err)
        return null
    }
}

function mainMenu() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: '📞 Telefon raqamni ulashish', request_contact: true }],
                [{ text: '💬 Xabar yuborish' }],
                [{ text: 'ℹ️ Ma’lumot' }, { text: '❌ Bekor qilish' }],
            ],
            resize_keyboard: true,
        }
    }
}

// --- Komandalar ---
bot.onText(/\/start/, async (msg) => {
    await checkUser(msg)
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, `👋 Salom, ${msg.from.first_name || ''}!\nQuyidagi menyudan tanlang:`, mainMenu())
})

bot.onText(/\/info/, async (msg) => {
    await checkUser(msg)
    await bot.sendMessage(msg.chat.id, 'ℹ️ Bu bot orqali username yoki telefon orqali xabar yuborish mumkin.', mainMenu())
})

bot.onText(/\/cancel/, async (msg) => {
    await checkUser(msg)
    const chatId = msg.chat.id
    if (sessions[chatId]) delete sessions[chatId]
    await bot.sendMessage(chatId, '❌ Amallar bekor qilindi.', mainMenu())
})

bot.onText(/\/setphone/, async (msg) => {
    await checkUser(msg)
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, '📲 Raqamingizni ulashish uchun pastdagi tugmani bosing.', {
        reply_markup: {
            keyboard: [
                [{ text: '📞 Kontaktni ulashish', request_contact: true }],
                [{ text: '⬅️ Orqaga' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    })
})

// --- Contactni olish ---
bot.on('contact', async (msg) => {
    await checkUser(msg)
    const chatId = msg.chat.id
    const phoneRaw = msg.contact.phone_number || ''
    const phone = phoneRaw.startsWith('+') ? phoneRaw : '+' + phoneRaw
    try {
        await uniqRow(
            `UPDATE users SET user_phone_number = $1 WHERE user_chat_id = $2`,
            phone,
            chatId
        )
        await bot.sendMessage(chatId, `✅ Telefon raqam saqlandi: ${phone}`, mainMenu())
    } catch (err) {
        console.error('save contact error', err)
        await bot.sendMessage(chatId, '⚠️ Telefon raqam saqlanmadi.', mainMenu())
    }
})

bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    
})

// --- Har qanday xabar ---
bot.on('message', async (msg) => {
    if (!msg.text) return
    await checkUser(msg)
    const chatId = msg.chat.id
    
    if (msg.text.startsWith('/')) return // komandalar yuqorida ishlaydi
    
    if (msg.text === 'ℹ️ Ma’lumot') {
        return bot.sendMessage(chatId, '📘 Bot haqida maʼlumot: username yoki telefon orqali xabar yuborish mumkin.', mainMenu())
    }
    
    if (msg.text === '❌ Bekor qilish') {
        if (sessions[chatId]) delete sessions[chatId]
        return bot.sendMessage(chatId, '❌ Bekor qilindi.', mainMenu())
    }
    
    if (msg.text === '💬 Xabar yuborish') {
        const r = await uniqRow(`SELECT user_phone_number FROM users WHERE user_chat_id = $1`, chatId)
        const user = r.rows[0]
        if (!user || !user.user_phone_number) {
            return bot.sendMessage(chatId, '📞 Iltimos, avval telefon raqamingizni ulashing.', mainMenu())
        }
        sessions[chatId] = { step: 'ask_target' }
        return bot.sendMessage(chatId, '👤 Kimga xabar yubormoqchisiz? Username (@username) yoki telefon raqam kiriting.', { reply_markup: { remove_keyboard: true } })
    }
    
    const session = sessions[chatId]
    if (!session) return
    
    if (session.step === 'ask_target') {
        const raw = msg.text.trim()
        session.rawTarget = raw
        session.target = null
        if (raw.startsWith('@')) session.target = { type: 'username', value: raw.replace('@', '').trim() }
        else if (raw.startsWith('+')) session.target = { type: 'phone', value: raw }
        if (!session.target) {
            delete sessions[chatId]
            return bot.sendMessage(chatId, '❌ Username yoki telefon noto‘g‘ri.', mainMenu())
        }
        session.step = 'ask_message'
        return bot.sendMessage(chatId, '💬 Endi xabar matnini yozing. Bekor qilish uchun ❌ Bekor qilish.', { reply_markup: { remove_keyboard: true } })
    }
    
    if (session.step === 'ask_message') {
        const message = msg.text
        let targetUser
        try {
            if (session.target.type === 'username') {
                const r = await uniqRow(`SELECT * FROM users WHERE LOWER(user_username) = LOWER($1)`, session.target.value)
                targetUser = r.rows[0]
            } else {
                const r = await uniqRow(`SELECT * FROM users WHERE user_phone_number = $1`, session.target.value)
                targetUser = r.rows[0]
            }
            if (!targetUser) {
                delete sessions[chatId]
                return bot.sendMessage(chatId, `❌ Foydalanuvchi topilmadi: ${session.rawTarget}`, mainMenu())
            }
            await bot.sendMessage(targetUser.user_chat_id, message)
            await bot.sendMessage(chatId, `✅ Xabar ${session.rawTarget} ga yuborildi!`, mainMenu())
        } catch (err) {
            console.error('send message error', err)
            await bot.sendMessage(chatId, `⚠️ Xabar yuborilmadi: ${err.response?.body?.description || err.message}`, mainMenu())
        }
        delete sessions[chatId]
    }
})