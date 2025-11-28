import Document from '../models/Document.js';
import { processDocument } from '../services/documentService.js';
import { getEmbedding } from '../services/embeddingService.js';

export const uploadDocument = async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const file = req.files.file;
    const userId = req.user.id;

    // Process the document (extract text, chunk, generate embeddings)
    const { textChunks, metadata } = await processDocument(file);

    // Store document in database
    const document = new Document({
      filename: file.name,
      originalName: file.name,
      fileType: file.mimetype,
      fileSize: file.size,
      vectorId: metadata.vectorId,
      userId,
    });

    await document.save();

    // Store embeddings in vector database
    await storeEmbeddings(textChunks, metadata, userId);

    res.status(201).json({
      message: 'Document uploaded and processed successfully',
      document,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Error processing document' });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user.id });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Error fetching documents' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from vector database
    await deleteEmbeddings(document.vectorId);

    // Delete from MongoDB
    await document.remove();

    res.json({ message: 'Document removed' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Error deleting document' });
  }
};

async function storeEmbeddings(chunks, metadata, userId) {
  // Implementation for storing embeddings in Pinecone/FAISS
  // This will be implemented in the embedding service
}

async function deleteEmbeddings(vectorId) {
  // Implementation for deleting embeddings from Pinecone/FAISS
  // This will be implemented in the embedding service
}
