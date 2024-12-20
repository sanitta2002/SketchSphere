const mongoose =require('mongoose')

const bannerSchema= new mongoose.Schema({
    image:{
        type:string,
        required:true
    },
    titile:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    link:{
        type:String,
    },
    startDate:{
       type:Date,
       required:true
    },
    endDate:{
        type:Date,
        required:true
    }
})
 
const Banner = mongoose.model("Banner",bannerSchema)
models.exports =Banner