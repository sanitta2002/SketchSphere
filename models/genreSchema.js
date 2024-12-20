const mongoose = require('mongoose');

const genreSchema = new mongoose.Schema({
  genre_name: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

const Genre= mongoose.model('Genre', genreSchema);
module.exports = Genre