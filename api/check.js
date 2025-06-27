// api/check.js
const { Telegraf } = require('telegraf');

module.exports = async (req, res) => {
  try {
    // Support GET, POST, and cURL
    const method = req.method;
    let botToken, userId, chatIds;
    
    if (method === 'GET') {
      botToken = req.query.token;
      userId = req.query.user_id;
      chatIds = req.query.chat_ids ? req.query.chat_ids.split(',') : [req.query.chat_id];
    } else if (method === 'POST') {
      botToken = req.body.token;
      userId = req.body.user_id;
      chatIds = req.body.chat_ids ? (Array.isArray(req.body.chat_ids) ? req.body.chat_ids : req.body.chat_ids.split(',')) : [req.body.chat_id];
    } else {
      return res.status(405).json({ 
        status: 'error', 
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST methods are allowed',
        details: {
          allowed_methods: ['GET', 'POST']
        }
      });
    }

    // Validate required parameters
    if (!botToken) {
      return res.status(400).json({ 
        status: 'error',
        code: 'MISSING_BOT_TOKEN',
        message: 'Bot token is required',
        details: {
          parameter: 'token',
          expected_format: 'Telegram bot token (string)'
        }
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        status: 'error',
        code: 'MISSING_USER_ID',
        message: 'User ID is required',
        details: {
          parameter: 'user_id',
          expected_format: 'Telegram user ID (number or string)'
        }
      });
    }

    if (!chatIds || chatIds.length === 0 || chatIds.some(id => !id)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'MISSING_CHAT_IDS',
        message: 'At least one chat ID is required',
        details: {
          parameter: 'chat_id or chat_ids',
          expected_format: 'Single chat ID (string) or comma-separated list of chat IDs'
        }
      });
    }

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    // Process all chat IDs
    const results = [];
    const errors = [];
    
    for (const chatId of chatIds) {
      try {
        // Check membership
        const member = await bot.telegram.getChatMember(chatId, userId);
        
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        const isAdmin = ['administrator', 'creator'].includes(member.status);
        
        results.push({
          chat_id: chatId,
          is_member: isMember,
          is_admin: isAdmin,
          user_status: member.status,
          success: true
        });
      } catch (error) {
        if (error.description === 'Bad Request: user not found') {
          results.push({
            chat_id: chatId,
            is_member: false,
            is_admin: false,
            user_status: 'non_member',
            success: true
          });
        } else if (error.description === 'Bad Request: chat not found') {
          errors.push({
            chat_id: chatId,
            code: 'CHAT_NOT_FOUND',
            message: 'The specified chat/channel was not found',
            details: {
              possible_reasons: [
                'Bot is not a member of this chat',
                'Chat ID is invalid',
                'Chat does not exist'
              ]
            }
          });
        } else if (error.description === 'Bad Request: user_id invalid') {
          errors.push({
            chat_id: chatId,
            code: 'INVALID_USER_ID',
            message: 'The provided user ID is invalid',
            details: {
              provided_user_id: userId,
              expected_format: 'Telegram user ID (number or string)'
            }
          });
        } else if (error.description === 'Bad Request: not enough rights') {
          errors.push({
            chat_id: chatId,
            code: 'INSUFFICIENT_BOT_RIGHTS',
            message: 'Bot does not have sufficient rights in this chat',
            details: {
              required_rights: 'Bot must be a member with admin privileges to check membership'
            }
          });
        } else {
          errors.push({
            chat_id: chatId,
            code: 'UNKNOWN_ERROR',
            message: error.message || 'Unknown error occurred',
            details: {
              error_description: error.description,
              stack_trace: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
          });
        }
      }
    }

    // Prepare response
    const response = {
      status: errors.length === 0 ? 'success' : 'partial_success',
      metadata: {
        user_id: userId,
        chats_checked: chatIds.length,
        chats_successful: results.length,
        chats_failed: errors.length
      },
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };

    // Determine status code
    let statusCode = 200;
    if (errors.length > 0 && errors.length === chatIds.length) {
      statusCode = 424; // Failed dependency (all failed)
    } else if (errors.length > 0) {
      statusCode = 207; // Multi-status (some succeeded, some failed)
    }

    return res.status(statusCode).json(response);
  } catch (error) {
    console.error('Unexpected Error:', error);
    return res.status(500).json({ 
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? {
        error_message: error.message,
        error_stack: error.stack
      } : undefined
    });
  }
};
