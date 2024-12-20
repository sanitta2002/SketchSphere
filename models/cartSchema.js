const mongoose =require('mongoose')

const cartSchema= new mongoose.Schema({
    userId:{
        type:Schema.Type.ObjectId,
        ref:"User",
        required:true
    },
    items:[{
        productId:{
            type:Schema.Type.ObjectId,
            ref:'Product',
            required:true
        },
        quantity:{
            type:Number,
            default:1,
        },
        price:{
            type:Number,
            required:true
        },
        totalPrice:{
            type:Number,
            required:true
        },
        status:{
            type: String,
            default:"Placed"
        },
        concellationsReason:{
            type:String,
            defult:"none"
        }
    }]
})
const Cart=mongoose.model("Cart",cartSchema)
module.exports=Cart