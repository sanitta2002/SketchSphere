const mongoose =require('mongoose')
const {v4: uuidv4}= require(uuid)

const orderSChema= new mongoose.Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderedItems:[{
        product:{
            type:Schema.Type.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
             type:Number,
             default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
       type:Schema.Type.ObjectId,
       ref:"User",
       required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned']
    },
    createdOn:{
        type:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        defult:false
    },


})

const Order= mongoose.model("Order",orderSChema)
module.exports=Order