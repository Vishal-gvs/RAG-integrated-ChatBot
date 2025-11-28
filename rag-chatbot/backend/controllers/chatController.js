import Chat from '../models/Chat.js';
import { generateResponse } from '../services/ragService.js';

export const createChat = async (req, res) => {
  try {
    const { title = 'New Chat', documentIds = [] } = req.body;
    
    const chat = new Chat({
      userId: req.user.id,
      title,
      messages: [],
      activeDocuments: documentIds,
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Error creating chat' });
  }
};

export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('_id title updatedAt');
    
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Error fetching chats' });
  }
};

export const getChatById = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate('activeDocuments', 'filename');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Error fetching chat' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const chatId = req.params.id;
    
    // Add user message to chat
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId: req.user.id },
      {
        $push: {
          messages: {
            role: 'user',
            content,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Generate AI response
    const { response, sources } = await generateResponse(content, chat.activeDocuments, req.user.id);

    // Add AI response to chat
    chat.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      sources,
    });

    await chat.save();

    res.status(201).json({
      message: {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        sources,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error processing message' });
  }
};

export const regenerateResponse = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get the last user message
    const lastUserMessage = [...chat.messages]
      .reverse()
      .find((msg) => msg.role === 'user');

    if (!lastUserMessage) {
      return res.status(400).json({ error: 'No user message found to regenerate response' });
    }

    // Remove the last assistant message if it exists
    if (chat.messages[chat.messages.length - 1]?.role === 'assistant') {
      chat.messages.pop();
    }

    // Generate new AI response
    const { response, sources } = await generateResponse(
      lastUserMessage.content,
      chat.activeDocuments,
      req.user.id
    );

    // Add new AI response to chat
    chat.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      sources,
    });

    await chat.save();

    res.status(200).json({
      message: {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        sources,
      },
    });
  } catch (error) {
    console.error('Error regenerating response:', error);
    res.status(500).json({ error: 'Error regenerating response' });
  }
};

export const updateChatTitle = async (req, res) => {
  try {
    const { title } = req.body;
    
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error updating chat title:', error);
    res.status(500).json({ error: 'Error updating chat title' });
  }
};
