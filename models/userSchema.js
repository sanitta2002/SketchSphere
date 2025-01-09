const mongoose =require('mongoose')
const { search } = require('../server')
const {Schema}= mongoose
const userschema=new Schema({
    name:{
        type:String,
        required: true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        defult:null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    }
,    
    
    password:{
        type:String,
        required:false
    },
    isBlocked:{
     type:Boolean,
     defult:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet:{
        type:Number,
        defult:0,
    },
    wishlist:[{
        type: Schema.Types.ObjectId,
        ref:"Product"
    }],
    orderHistory:[{
        type: Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now,

    },
    referalCode:{
        type:String
    },
    redeemed:{
        type:Boolean
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category"
        },
        genre:[{
            type:Schema.Types.ObjectId,
            ref:"genre"
        }]
    }],
    searchOn:{
        type:Date,
        defult:Date.now
    }
})

const User =mongoose.model("User",userschema)
module.exports = User
