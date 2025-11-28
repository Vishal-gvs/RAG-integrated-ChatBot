import express from 'express';
import { 
  createChat, 
  getChats, 
  getChatById, 
  sendMessage, 
  regenerateResponse,
  updateChatTitle 
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createChat)
  .get(protect, getChats);

router.route('/:id')
  .get(protect, getChatById)
  .put(protect, updateChatTitle);

router.route('/:id/message')
  .post(protect, sendMessage);

router.route('/:id/regenerate')
  .post(protect, regenerateResponse);

export default router;
