// api/check.js
const { Telegraf } = require('telegraf');
const { json } = require('micro');

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

// Clean chat usernames properly
const cleanChatIdentifiers = (input) => {
  if (!input) return [];
  return String(input)
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 1 && id.startsWith('@'));
};

module.exports = async (req, res) => {
  try {
    if (req.url === '/' || (req.url === '/api/check' && req.method === 'GET' && !req.query.token)) {
      return res.status(200).json(addSocialLinks({
        status: 'success',
        message: 'Telegram Membership Checker API (Public Channels/Groups Only)',
        endpoints: {
          check_membership: {
            method: ['GET', 'POST'],
            path: '/api/check',
            parameters: {
              required: [
                'token (Bot Token)',
                'user_id (Numeric User ID only)',
                'chat_id or chat_ids (Comma-separated @usernames)'
              ],
              example: '/api/check?token=BOT_TOKEN&user_id=123456789&chat_ids=@channel1,@group1'
            }
          }
        },
        version: '1.1.0'
      }));
    }

    const method = req.method;
    let botToken, userId, chatUsernames = [];
    let body = {};

    if (method === 'POST') {
      try {
        body = await json(req);
      } catch {
        return res.status(400).json(addSocialLinks({
          status: 'error',
          code: 'INVALID_JSON',
          message: 'Invalid JSON payload'
        }));
      }
    }

    if (method === 'GET') {
      botToken = req.query.token?.trim();
      userId = parseInt(req.query.user_id);
      chatUsernames = cleanChatIdentifiers(req.query.chat_id || req.query.chat_ids);
    } else if (method === 'POST') {
      botToken = body.token?.trim();
      userId = parseInt(body.user_id);
      chatUsernames = cleanChatIdentifiers(body.chat_id || body.chat_ids);
    } else {
      return res.status(405).json(addSocialLinks({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST supported'
      }));
    }

    if (!botToken) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MISSING_TOKEN',
        message: 'Bot token is required'
      }));
    }

    if (!userId || isNaN(userId)) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'INVALID_USER_ID',
        message: 'Valid numeric user ID is required'
      }));
    }

    if (chatUsernames.length === 0) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'NO_CHAT_IDS',
        message: 'Provide at least one valid @chat_id'
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
          throw new Error('Only public groups or channels are allowed');
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
            message: `User does not exist or is not visible in ${chatUsername}`
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

    const response = addSocialLinks({
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
    });

    return res.status(allSuccessful ? 200 : errors.length === chatUsernames.length ? 424 : 207).json(response);

  } catch (error) {
    console.error('Internal Error:', error);
    return res.status(500).json(addSocialLinks({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on the server'
    }));
  }
};
