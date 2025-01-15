const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    offerPrice: {
        type: Number,
        default: 0
    },
    offerPercentage: {
        type: Number,
        default: 0
    },
    offerStartDate: {
        type: Date
    },
    offerEndDate: {
        type: Date
    }
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;