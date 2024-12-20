const mongoose = require('mogoose')

const couponSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true,
    },
    expireOn:{
        type:Date,
        required:true
    },
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    isList:{
        type:Boolean,
        default:true
    },
    userId:{
        type:Schema.Type.ObjectId,
        ref:"User",
    }

})

const Coupon= mongoose.model("Coupon",couponSchema)
module.exports=Coupon