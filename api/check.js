const { Telegraf } = require('telegraf');
const { json } = require('micro');
const { URL } = require('url');

const SOCIAL_LINKS = {
  developer: "@Kaiiddo on Telegram",
  youtube: "@Kaiiddo",
  twitter: "@HelloKaiiddo",
  github: "ProKaiiddo"
};

const addSocialLinks = (response) => ({
  ...response,
  social: SOCIAL_LINKS
});

const cleanChatIdentifiers = (input) => {
  if (!input) return [];
  return String(input)
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 1 && id.startsWith('@'));
};

module.exports = async (req, res) => {
  try {
    const method = req.method;
    let botToken, userId, chatUsernames = [];
    let body = {};

    // Root info handler
    if (req.url === '/' || (req.url.startsWith('/api/check') && method === 'GET' && !req.url.includes('token='))) {
      return res.status(200).json(addSocialLinks({
        status: 'success',
        message: 'Telegram Membership Checker API (Public Channels/Groups Only)',
        endpoints: {
          check_membership: {
            method: ['GET', 'POST'],
            path: '/api/check',
            parameters: {
              required: ['token', 'user_id', 'chat_id or chat_ids'],
              example: '/api/check?token=BOT_TOKEN&user_id=123456789&chat_ids=@channel1,@group1'
            }
          }
        },
        version: '1.1.0'
      }));
    }

    // Read GET params using URL class (for Vercel compatibility)
    if (method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const params = url.searchParams;

      botToken = params.get('token')?.trim();
      userId = parseInt(params.get('user_id'));
      chatUsernames = cleanChatIdentifiers(params.get('chat_id') || params.get('chat_ids'));
    }

    // Read POST params
    else if (method === 'POST') {
      try {
        body = await json(req);
        botToken = body.token?.trim();
        userId = parseInt(body.user_id);
        chatUsernames = cleanChatIdentifiers(body.chat_id || body.chat_ids);
      } catch {
        return res.status(400).json(addSocialLinks({
          status: 'error',
          code: 'INVALID_JSON',
          message: 'Invalid JSON payload'
        }));
      }
    }

    // Only allow GET and POST
    else {
      return res.status(405).json(addSocialLinks({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST methods are supported'
      }));
    }

    // Validation
    if (!botToken || !userId || isNaN(userId) || chatUsernames.length === 0) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        message: 'Missing required parameters: token, user_id, or chat_id'
      }));
    }

    const bot = new Telegraf(botToken);
    const results = [];
    const errors = [];
    let allSuccessful = true;

    for (const chatUsername of chatUsernames) {
      try {
        const chat = await bot.telegram.getChat(chatUsername);

        if (!['channel', 'supergroup', 'group'].includes(chat.type)) {
          throw new Error('Only public channels/groups supported');
        }

        const member = await bot.telegram.getChatMember(chat.id, userId);
        const isMember = ['creator', 'administrator', 'member'].includes(member.status);
        const isAdmin = ['creator', 'administrator'].includes(member.status);

        if (!isMember) {
          allSuccessful = false;
          errors.push({
            chat_username: chatUsername,
            code: 'NOT_MEMBER',
            message: `User is not a member of ${chatUsername}`,
            user_status: member.status
          });
        }

        results.push({
          chat_username: chatUsername,
          chat_title: chat.title,
          is_member: isMember,
          is_admin: isAdmin,
          user_status: member.status,
          success: isMember
        });

      } catch (error) {
        allSuccessful = false;
        const msg = error.description || error.message;
        if (msg.includes('chat not found')) {
          errors.push({
            chat_username: chatUsername,
            code: 'CHAT_NOT_FOUND',
            message: `${chatUsername} does not exist or bot isn’t a member`
          });
        } else if (msg.includes('user not found')) {
          errors.push({
            chat_username: chatUsername,
            code: 'USER_NOT_FOUND',
            message: `User not found or not visible in ${chatUsername}`
          });
        } else if (msg.includes('not enough rights')) {
          errors.push({
            chat_username: chatUsername,
            code: 'BOT_NOT_ADMIN',
            message: `Bot lacks rights to check ${chatUsername}`
          });
        } else {
          errors.push({
            chat_username: chatUsername,
            code: 'UNKNOWN_ERROR',
            message: `Failed to check ${chatUsername}: ${msg}`
          });
        }
      }
    }

    return res.status(allSuccessful ? 200 : errors.length === chatUsernames.length ? 424 : 207).json(addSocialLinks({
      status: allSuccessful ? 'success' : errors.length === chatUsernames.length ? 'error' : 'partial_success',
      is_member_in_all: allSuccessful,
      metadata: {
        user_id: userId,
        chats_checked: chatUsernames.length,
        chats_successful: results.filter(r => r.success).length,
        chats_failed: errors.length,
        timestamp: new Date().toISOString()
      },
      results,
      errors: errors.length ? errors : undefined
    }));
  } catch (err) {
    console.error('Unexpected Error:', err);
    return res.status(500).json(addSocialLinks({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error'
    }));
  }
};
