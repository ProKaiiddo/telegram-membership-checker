// api/check.js
const { Telegraf } = require('telegraf');
const { json } = require('micro');
const { URL } = require('url');

const SOCIAL_LINKS = {
  developer: "@Kaiiddo on Telegram",
  youtube: "@Kaiiddo",
  twitter: "@HelloKaiiddo",
  github: "ProKaiiddo",
  bsky: "kaiiddo.bsky.social"
};

const addSocialLinks = (response) => ({
  ...response,
  social: SOCIAL_LINKS
});

// Clean input and remove @
const cleanChatIdentifier = (input) => {
  if (!input) return null;
  return input.trim().replace(/^@/, '');
};

module.exports = async (req, res) => {
  try {
    const method = req.method;
    let botToken, userId, chatUsername;
    let body = {};

    // Root help page
    if (req.url === '/' || (req.url.startsWith('/api/check') && method === 'GET' && !req.url.includes('token='))) {
      return res.status(200).json(addSocialLinks({
        status: 'success',
        message: 'Telegram Membership Checker API',
        usage: '/api/check?token=BOT_TOKEN&user_id=123456789&chat_id=JunnioMarket',
        note: 'Remove "@" — it is handled automatically.',
        method: ['GET', 'POST'],
        version: '1.3.0'
      }));
    }

    // ✅ Handle GET (Vercel compatible)
    if (method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const params = url.searchParams;

      botToken = params.get('token')?.trim();
      userId = parseInt(params.get('user_id'));
      chatUsername = cleanChatIdentifier(params.get('chat_id'));
    }

    // ✅ Handle POST (use micro's json parser for Vercel)
    else if (method === 'POST') {
      try {
        body = await json(req);
        botToken = body.token?.trim();
        userId = parseInt(body.user_id);
        chatUsername = cleanChatIdentifier(body.chat_id);
      } catch {
        return res.status(400).json(addSocialLinks({
          status: 'error',
          code: 'INVALID_JSON',
          message: 'Invalid JSON body.'
        }));
      }
    }

    // ❌ Invalid method
    else {
      return res.status(405).json(addSocialLinks({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST supported.'
      }));
    }

    // ❗ Missing fields
    if (!botToken || !userId || isNaN(userId) || !chatUsername) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        message: 'Missing required parameters: token, user_id, or chat_id.'
      }));
    }

    const bot = new Telegraf(botToken);
    const fullChatUsername = '@' + chatUsername;

    try {
      const chat = await bot.telegram.getChat(fullChatUsername);
      const member = await bot.telegram.getChatMember(chat.id, userId);
      const isMember = ['creator', 'administrator', 'member'].includes(member.status);
      const isAdmin = ['creator', 'administrator'].includes(member.status);

      return res.status(200).json(addSocialLinks({
        status: 'success',
        is_member: isMember,
        is_admin: isAdmin,
        user_status: member.status,
        chat: {
          username: fullChatUsername,
          title: chat.title,
          type: chat.type
        }
      }));
    } catch (error) {
      const msg = error.description || error.message || 'Unknown error';

      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MEMBERSHIP_CHECK_FAILED',
        message: msg
      }));
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json(addSocialLinks({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.'
    }));
  }
};
