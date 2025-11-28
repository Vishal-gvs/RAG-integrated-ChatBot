import express from 'express';
import { uploadDocument, getDocuments, deleteDocument } from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, uploadDocument)
  .get(protect, getDocuments);

router.route('/:id')
  .delete(protect, deleteDocument);

export default router;
