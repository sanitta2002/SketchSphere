const { MongoOIDCError } = require('mongodb')
const mongoose=require('mongoose')
const env =require('dotenv').config()


//Function to connect to MongoDB using Mongoose
const connectDB=async()=>{

    try{

        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Db connected")

    }catch (error) {

       console.log("DB connection error",error.message)
       process.exit(1) //Exit the process with a failure code (1) to indicate a critical error

    }
}

module.exports = connectDB