import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for embeddings to avoid redundant API calls
const embeddingCache = new Map();

/**
 * Generates an embedding vector for the given text using OpenAI's embedding model
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<number[]>} - The embedding vector
 */
export async function getEmbedding(text) {
  try {
    // Check cache first
    const cacheKey = text.trim().toLowerCase();
    if (embeddingCache.has(cacheKey)) {
      return embeddingCache.get(cacheKey);
    }

    // Call OpenAI's API to get the embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    const embedding = response.data[0].embedding;
    
    // Cache the result
    embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate text embedding');
  }
}

/**
 * Stores document chunks with their embeddings in the vector database
 * @param {Array} chunks - Array of text chunks
 * @param {Object} metadata - Metadata about the document
 * @param {string} userId - ID of the user who owns the document
 */
export async function storeEmbeddings(chunks, metadata, userId) {
  try {
    const pinecone = await initPinecone();
    const index = pinecone.Index(process.env.PINECONE_INDEX);
    
    // Generate embeddings for each chunk
    const embeddingPromises = chunks.map(async (chunk, index) => {
      const embedding = await getEmbedding(chunk);
      
      return {
        id: `${metadata.vectorId}_chunk_${index}`,
        values: embedding,
        metadata: {
          text: chunk,
          documentId: metadata.vectorId,
          userId,
          pageNumber: 1, // This would be updated based on actual page numbers
          chunkIndex: index,
          ...metadata,
        },
      };
    });
    
    const vectors = await Promise.all(embeddingPromises);
    
    // Upsert vectors to Pinecone in batches (Pinecone has a limit per request)
    const BATCH_SIZE = 100;
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await index.upsert({
        upsertRequest: {
          vectors: batch,
          namespace: userId, // Optional: use namespace to separate user data
        },
      });
    }
    
    return vectors.length;
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw new Error('Failed to store document embeddings');
  }
}

/**
 * Deletes all embeddings for a specific document
 * @param {string} documentId - The ID of the document to delete
 */
export async function deleteEmbeddings(documentId) {
  try {
    const pinecone = await initPinecone();
    const index = pinecone.Index(process.env.PINECONE_INDEX);
    
    // Delete all vectors with the matching documentId in metadata
    await index.delete1({
      deleteRequest: {
        filter: {
          documentId: { $eq: documentId },
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    throw new Error('Failed to delete document embeddings');
  }
}

// Initialize Pinecone client (moved from ragService to avoid circular dependency)
let pineconeInstance;
async function initPinecone() {
  if (!pineconeInstance) {
    const { Pinecone } = await import('@pinecone-database/pinecone');
    pineconeInstance = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
  }
  return pineconeInstance;
}
