const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    chatId: {
        type: String,
        required: true
    },
    messages: [{
        content: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true,
            enum: ['user', 'assistant', 'system']
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    title: {
        type: String,
        default: 'New Chat'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Add compound index for faster queries
chatSchema.index({ userId: 1, chatId: 1 }, { unique: true });

// Add index for faster chat history queries
chatSchema.index({ userId: 1, lastUpdated: -1 });

// Pre-save middleware to update lastUpdated
chatSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Pre-findOneAndUpdate middleware to update lastUpdated
chatSchema.pre('findOneAndUpdate', function(next) {
    this.set({ lastUpdated: new Date() });
    next();
});

// Add a method to handle message updates
chatSchema.statics.updateWithMessages = async function(userId, chatId, messages, title) {
    // Generate permanent ID for temp chats
    const finalChatId = chatId.toString().startsWith('temp_') 
        ? `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : chatId;

    return this.findOneAndUpdate(
        { userId, chatId: finalChatId },
        {
            title: title || 'New Chat',
            messages,
            lastUpdated: new Date(),
            $setOnInsert: { userId }
        },
        { new: true, upsert: true }
    );
};

module.exports = mongoose.model('Chat', chatSchema); 