// api/check.js
const { Telegraf } = require('telegraf');
const { json } = require('micro');

const SOCIAL_LINKS = {
  developer: "@Kaiiddo on Telegram",
  youtube: "@Kaiiddo",
  twitter: "@HelloKaiiddo",
  github: "ProKaiiddo"
};

const addSocialLinks = (response) => {
  return {
    ...response,
    social: SOCIAL_LINKS
  };
};

const cleanChatIdentifiers = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(id => String(id).trim()).filter(id => id.startsWith('@'));
  }
  return String(input).split(',')
    .map(id => id.trim())
    .filter(id => id.startsWith('@'));
};

module.exports = async (req, res) => {
  try {
    // Handle root path request
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
                'chat_id or chat_ids (Channel/Group usernames with @ prefix)'
              ],
              example_request: '/api/check?token=BOT_TOKEN&user_id=123456789&chat_ids=@channel1,@group1'
            }
          }
        },
        version: '1.0.0'
      }));
    }

    // Support GET, POST
    const method = req.method;
    let botToken, userId, chatUsernames;
    let body = {};

    if (method === 'POST') {
      try {
        body = await json(req);
      } catch (e) {
        return res.status(400).json(addSocialLinks({
          status: 'error',
          code: 'INVALID_JSON',
          message: 'Invalid JSON payload in request body'
        }));
      }
    }

    // Extract and validate parameters
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
        message: 'Only GET and POST methods are allowed'
      }));
    }

    // Validate required parameters
    if (!botToken) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MISSING_BOT_TOKEN',
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
        code: 'INVALID_CHAT_USERNAMES',
        message: 'At least one valid channel/group username (@username) is required',
        details: {
          example: '@channel1,@group1'
        }
      }));
    }

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    // Process all chat usernames
    const results = [];
    const errors = [];
    let allSuccessful = true;
    
    for (const chatUsername of chatUsernames) {
      try {
        // Get chat info to verify it's public
        const chat = await bot.telegram.getChat(chatUsername);
        
        if (chat.type !== 'channel' && chat.type !== 'supergroup') {
          throw new Error('Only public channels and groups are supported');
        }

        // Check membership
        const member = await bot.telegram.getChatMember(chat.id, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        const isAdmin = ['administrator', 'creator'].includes(member.status);
        
        if (!isMember) {
          allSuccessful = false;
          errors.push({
            chat_username: chatUsername,
            code: 'USER_NOT_MEMBER',
            message: `User is not a member of ${chatUsername}`,
            user_status: member.status
          });
        }

        results.push({
          chat_username: chatUsername,
          chat_title: chat.title,
          chat_type: chat.type,
          is_member: isMember,
          is_admin: isAdmin,
          user_status: member.status,
          success: isMember
        });
      } catch (error) {
        allSuccessful = false;
        if (error.description === 'Bad Request: user not found') {
          errors.push({
            chat_username: chatUsername,
            code: 'USER_NOT_FOUND',
            message: `User not found in ${chatUsername}`
          });
        } else if (error.description === 'Bad Request: chat not found') {
          errors.push({
            chat_username: chatUsername,
            code: 'CHAT_NOT_FOUND',
            message: `${chatUsername} not found or not public`
          });
        } else if (error.description === 'Bad Request: not enough rights') {
          errors.push({
            chat_username: chatUsername,
            code: 'INSUFFICIENT_BOT_RIGHTS',
            message: `Bot needs to join ${chatUsername} first`
          });
        } else {
          errors.push({
            chat_username: chatUsername,
            code: 'UNKNOWN_ERROR',
            message: error.message || `Error checking ${chatUsername}`,
            details: process.env.NODE_ENV === 'development' ? error.description : undefined
          });
        }
      }
    }

    // Prepare response
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
      results: results,
      errors: errors.length > 0 ? errors : undefined
    });

    return res.status(allSuccessful ? 200 : errors.length === chatUsernames.length ? 424 : 207).json(response);
  } catch (error) {
    console.error('Unexpected Error:', error);
    return res.status(500).json(addSocialLinks({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? {
        error_message: error.message,
        error_description: error.description,
        error_stack: error.stack
      } : undefined
    }));
  }
};
