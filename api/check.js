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

const isUsername = (identifier) => {
  return typeof identifier === 'string' && identifier.startsWith('@');
};

const cleanIdentifier = (id) => {
  if (!id) return null;
  return String(id).trim();
};

module.exports = async (req, res) => {
  try {
    // Handle root path request
    if (req.url === '/' || req.url === '/api/check' && req.method === 'GET' && !req.query.token) {
      return res.status(200).json(addSocialLinks({
        status: 'success',
        message: 'Telegram Membership Checker API',
        endpoints: {
          check_membership: {
            method: ['GET', 'POST'],
            path: '/api/check',
            parameters: {
              required: ['token', 'user_id', 'chat_id or chat_ids'],
              optional: []
            },
            example: {
              get: '/api/check?token=BOT_TOKEN&user_id=USER_ID&chat_ids=CHAT_ID1,CHAT_ID2',
              post: {
                token: 'BOT_TOKEN',
                user_id: 'USER_ID',
                chat_ids: ['CHAT_ID1', 'CHAT_ID2']
              }
            }
          }
        },
        version: '1.0.0'
      }));
    }

    // Support GET, POST
    const method = req.method;
    let botToken, userIdentifier, chatIdentifiers;
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

    // Extract parameters with proper cleaning
    if (method === 'GET') {
      botToken = cleanIdentifier(req.query.token);
      userIdentifier = cleanIdentifier(req.query.user_id || req.query.user_name);
      
      // Handle both chat_id and chat_ids parameters
      const chatIdParam = cleanIdentifier(req.query.chat_id);
      const chatIdsParam = req.query.chat_ids 
        ? req.query.chat_ids.split(',').map(cleanIdentifier).filter(Boolean)
        : [];
      
      chatIdentifiers = chatIdParam ? [chatIdParam] : chatIdsParam;
    } else if (method === 'POST') {
      botToken = cleanIdentifier(body.token);
      userIdentifier = cleanIdentifier(body.user_id || body.user_name);
      
      // Handle both chat_id and chat_ids parameters
      const chatIdParam = cleanIdentifier(body.chat_id);
      const chatIdsParam = Array.isArray(body.chat_ids) 
        ? body.chat_ids.map(cleanIdentifier).filter(Boolean)
        : typeof body.chat_ids === 'string' 
          ? body.chat_ids.split(',').map(cleanIdentifier).filter(Boolean)
          : [];
      
      chatIdentifiers = chatIdParam ? [chatIdParam] : chatIdsParam;
    } else {
      return res.status(405).json(addSocialLinks({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST methods are allowed',
        details: {
          allowed_methods: ['GET', 'POST']
        }
      }));
    }

    // Validate required parameters
    if (!botToken) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MISSING_BOT_TOKEN',
        message: 'Bot token is required',
        details: {
          parameter: 'token',
          expected_format: 'Telegram bot token (string)'
        }
      }));
    }

    if (!userIdentifier) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MISSING_USER_ID',
        message: 'User identifier is required',
        details: {
          parameter: 'user_id or user_name',
          expected_format: 'Telegram user ID (number or string) or username (@username)'
        }
      }));
    }

    if (!chatIdentifiers || chatIdentifiers.length === 0) {
      return res.status(400).json(addSocialLinks({
        status: 'error',
        code: 'MISSING_CHAT_IDS',
        message: 'At least one chat identifier is required',
        details: {
          parameter: 'chat_id or chat_ids',
          expected_format: 'Single chat ID/username or comma-separated list'
        }
      }));
    }

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    // Process all chat identifiers
    const results = [];
    const errors = [];
    let allSuccessful = true;
    
    for (const chatIdentifier of chatIdentifiers) {
      try {
        // Resolve username to ID if needed
        let chatId = chatIdentifier;
        if (isUsername(chatIdentifier)) {
          const chat = await bot.telegram.getChat(chatIdentifier);
          chatId = chat.id;
        }

        // Resolve user identifier (ID or username)
        let userId = userIdentifier;
        if (isUsername(userIdentifier)) {
          const user = await bot.telegram.getChat(userIdentifier);
          userId = user.id;
        }

        const member = await bot.telegram.getChatMember(chatId, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        const isAdmin = ['administrator', 'creator'].includes(member.status);
        
        if (!isMember) {
          allSuccessful = false;
          errors.push({
            chat_identifier: chatIdentifier,
            resolved_chat_id: chatId,
            code: 'USER_NOT_MEMBER',
            message: `User is not a member of ${chatIdentifier}`,
            user_status: member.status
          });
        }

        results.push({
          chat_identifier: chatIdentifier,
          resolved_chat_id: chatId,
          is_member: isMember,
          is_admin: isAdmin,
          user_status: member.status,
          success: isMember
        });
      } catch (error) {
        allSuccessful = false;
        if (error.description === 'Bad Request: user not found') {
          errors.push({
            chat_identifier: chatIdentifier,
            code: 'USER_NOT_FOUND',
            message: `User ${userIdentifier} not found in ${chatIdentifier}`
          });
        } else if (error.description === 'Bad Request: chat not found') {
          errors.push({
            chat_identifier: chatIdentifier,
            code: 'CHAT_NOT_FOUND',
            message: `Chat ${chatIdentifier} not found or bot has no access`
          });
        } else if (error.description === 'Bad Request: user_id invalid') {
          errors.push({
            chat_identifier: chatIdentifier,
            code: 'INVALID_USER_ID',
            message: `Invalid user identifier: ${userIdentifier}`
          });
        } else if (error.description === 'Bad Request: not enough rights') {
          errors.push({
            chat_identifier: chatIdentifier,
            code: 'INSUFFICIENT_BOT_RIGHTS',
            message: `Bot has insufficient rights in ${chatIdentifier}`
          });
        } else {
          errors.push({
            chat_identifier: chatIdentifier,
            code: 'UNKNOWN_ERROR',
            message: error.message || `Unknown error occurred with ${chatIdentifier}`,
            details: process.env.NODE_ENV === 'development' ? error.description : undefined
          });
        }
      }
    }

    // Prepare response
    const response = addSocialLinks({
      status: allSuccessful ? 'success' : errors.length === chatIdentifiers.length ? 'error' : 'partial_success',
      is_member_in_all: allSuccessful,
      metadata: {
        user_identifier: userIdentifier,
        chats_checked: chatIdentifiers.length,
        chats_successful: results.filter(r => r.success).length,
        chats_failed: errors.length,
        timestamp: new Date().toISOString()
      },
      results: results,
      errors: errors.length > 0 ? errors : undefined
    });

    // Determine status code
    let statusCode = allSuccessful ? 200 : 207;
    if (errors.length === chatIdentifiers.length) {
      statusCode = 424; // Failed dependency - all failed
    }

    return res.status(statusCode).json(response);
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
