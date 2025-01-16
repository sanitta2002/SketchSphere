const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        date: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Middleware to prevent negative balance
walletSchema.pre('save', function(next) {
    if (this.balance < 0) {
        next(new Error('Wallet balance cannot be negative'));
    }
    next();
});

module.exports = mongoose.model('Wallet', walletSchema);
