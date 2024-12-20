const mongoose =require('mongoose')

const wishlistSchema= new mongoose.Schema({
    userId:{
        type:Schema.Type.ObjectId,
        ref:"User",
        required:true,
    },
    products:[{
        productId:{
            type:Schema.Type.ObjectId,
            ref:"Product",
            required:true
        },
        addedOn:{
           type:Date,
           default:Date.now
        }
    }]
})

const Wishlist =mongoose.model("Wishlist",wishlistSchema)
module.exports = Wishlist