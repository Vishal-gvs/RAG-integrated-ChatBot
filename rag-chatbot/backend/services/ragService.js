import OpenAI from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';
import { getEmbedding } from './embeddingService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let pinecone;

// Initialize Pinecone client
async function initPinecone() {
  if (!pinecone) {
    pinecone = new PineconeClient();
    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT,
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}

export async function generateResponse(query, documentIds, userId) {
  try {
    // Get relevant document chunks using RAG
    const relevantChunks = await retrieveRelevantChunks(query, documentIds, userId);
    
    // Format the context from relevant chunks
    const context = formatContext(relevantChunks);
    
    // Generate response using OpenAI
    const response = await generateChatCompletion(query, context);
    
    // Extract sources from the relevant chunks
    const sources = extractSources(relevantChunks);
    
    return {
      response,
      sources,
    };
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
}

async function retrieveRelevantChunks(query, documentIds, userId) {
  try {
    // Initialize Pinecone
    const pineconeClient = await initPinecone();
    const index = pineconeClient.Index(process.env.PINECONE_INDEX);
    
    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query);
    
    // Build filter for document IDs if provided
    const filter = {};
    if (documentIds && documentIds.length > 0) {
      filter.documentId = { $in: documentIds };
    }
    
    // Query Pinecone for similar vectors
    const queryRequest = {
      vector: queryEmbedding,
      topK: 5, // Number of chunks to retrieve
      includeMetadata: true,
      filter,
    };
    
    const searchResults = await index.query({ queryRequest });
    
    // Process and return the results
    return searchResults.matches.map(match => ({
      text: match.metadata.text,
      documentId: match.metadata.documentId,
      pageNumber: match.metadata.pageNumber,
      score: match.score,
    }));
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    throw new Error('Failed to retrieve relevant information');
  }
}

function formatContext(chunks) {
  return chunks
    .map(
      (chunk, index) => `[Source ${index + 1}]\n${chunk.text}\nDocument: ${chunk.documentId}, Page: ${chunk.pageNumber}`
    )
    .join('\n\n');
}

async function generateChatCompletion(query, context) {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant. Use the following context to answer the question. If you don't know the answer, say you don't know.\n\nContext: ${context}`,
      },
      { role: 'user', content: query },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating chat completion:', error);
    throw new Error('Failed to generate response from AI');
  }
}

function extractSources(chunks) {
  const uniqueSources = new Map();
  
  chunks.forEach(chunk => {
    const sourceKey = `${chunk.documentId}_${chunk.pageNumber}`;
    if (!uniqueSources.has(sourceKey)) {
      uniqueSources.set(sourceKey, {
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
      });
    }
  });
  
  return Array.from(uniqueSources.values());
}
