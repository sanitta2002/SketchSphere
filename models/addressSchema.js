const mongoose =require('mongoose')

const addressSchema= new mongoose.Schema({
    userId:{
       type:Schema.Type.ObjectId,
       ref:"User",
       required:true
    },
    address:[{
    addressType:{
        type:String,
        required:true,
    },
   
    name:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    landMark:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    pincode:{
        type:Number,
        required:true
    },
    phone:{
        type:String,
        required:true
    },
  }]
})


const Address =mongoose.model("Address",addressSchema)
module.exports = Address