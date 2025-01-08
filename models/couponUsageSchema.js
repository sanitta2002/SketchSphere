const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    couponCode: {
        type: String,
        required: true
    },
    usedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique combination of userId and couponCode
couponUsageSchema.index({ userId: 1, couponCode: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
