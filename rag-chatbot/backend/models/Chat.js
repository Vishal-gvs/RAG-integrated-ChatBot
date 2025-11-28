import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  sources: [
    {
      documentId: String,
      pageNumber: Number,
      text: String,
    },
  ],
});

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: 'New Chat',
    },
    messages: [messageSchema],
    activeDocuments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Chat', chatSchema);
