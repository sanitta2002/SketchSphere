const mongoose =require('mongoose')


const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  Published_Date: {
    type: Date,
    required: false,
  },
  writer: {
    type: String,
    required: false,
  },
  cover_Artist: {
    type: String,
    required: false,
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  genre_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: false,
  },
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: false,
  },
  offerPrice: {
    type: Number,
    default:0
  },
  available_quantity: {
    type: Number,
    required: false,
  },
  Regular_price: {
    type: Number,
  },
  Sale_price: {
    type: Number,
  },
  description: {
    type: String,
    required: true,
  },
  quantity:{
    type:Number,
    default:true
  },
  product_img: {
    type: [String], // Assume this stores the URL or file path
    required: true,
  },
  isBlocked:{
    type:Boolean,
    defult:false
   },
  status: {
    type: String,
    default: 'list',
  },
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product