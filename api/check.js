const { Telegraf } = require('telegraf');

module.exports = async (req, res) => {
  try {
    // Support GET, POST, and cURL
    const method = req.method;
    let botToken, userId, chatId;
    
    if (method === 'GET') {
      botToken = req.query.token;
      userId = req.query.user_id;
      chatId = req.query.chat_id;
    } else if (method === 'POST') {
      botToken = req.body.token;
      userId = req.body.user_id;
      chatId = req.body.chat_id;
    } else {
      return res.status(405).json({ 
        status: 'error', 
        message: 'Method not allowed' 
      });
    }

    // Validate required parameters
    if (!botToken || !userId || !chatId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required parameters: token, user_id, or chat_id' 
      });
    }

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    try {
      // Check membership
      const member = await bot.telegram.getChatMember(chatId, userId);
      
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);
      const isAdmin = ['administrator', 'creator'].includes(member.status);
      
      return res.status(200).json({
        status: 'success',
        data: {
          is_member: isMember,
          is_admin: isAdmin,
          user_status: member.status,
          chat_id: chatId,
          user_id: userId
        }
      });
    } catch (error) {
      if (error.description === 'Bad Request: user not found') {
        return res.status(200).json({ 
          status: 'success', 
          data: { 
            is_member: false,
            is_admin: false,
            user_status: 'non_member',
            chat_id: chatId,
            user_id: userId
          } 
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Internal server error' 
    });
  }
};
