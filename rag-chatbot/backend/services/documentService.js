import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';

const MAX_CHUNK_SIZE = 1000; // Maximum characters per chunk
const OVERLAP_SIZE = 200; // Overlap between chunks

export async function processDocument(file) {
  const fileType = file.mimetype;
  let text = '';

  try {
    if (fileType === 'application/pdf') {
      const data = await pdfParse(file.data);
      text = data.text;
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Handle .docx files
      const result = await mammoth.extractRawText({ buffer: file.data });
      text = result.value;
    } else if (fileType === 'text/plain') {
      // Handle .txt files
      text = file.data.toString('utf-8');
    } else {
      throw new Error('Unsupported file type');
    }

    // Clean and normalize the text
    text = cleanText(text);
    
    // Split text into chunks
    const chunks = splitIntoChunks(text);
    
    // Generate metadata for each chunk
    const metadata = {
      filename: file.name,
      fileType: file.mimetype,
      vectorId: `doc_${uuidv4()}`,
      timestamp: new Date().toISOString(),
    };

    return {
      textChunks: chunks,
      metadata,
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error('Failed to process document');
  }
}

function cleanText(text) {
  // Remove extra whitespace and normalize newlines
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + MAX_CHUNK_SIZE;
    
    // Don't split in the middle of a sentence if possible
    if (end < text.length) {
      const nextPeriod = text.indexOf('.', end);
      const nextSpace = text.lastIndexOf(' ', end);
      
      if (nextPeriod !== -1 && nextPeriod - end < 100) {
        end = nextPeriod + 1;
      } else if (nextSpace !== -1) {
        end = nextSpace;
      }
    } else {
      end = text.length;
    }
    
    chunks.push(text.substring(start, end).trim());
    
    // Move start to the next chunk, with some overlap
    start = Math.min(start + MAX_CHUNK_SIZE - OVERLAP_SIZE, text.length);
    
    // If we're at the end, break to avoid infinite loop
    if (start >= text.length - 1) break;
  }
  
  return chunks;
}
