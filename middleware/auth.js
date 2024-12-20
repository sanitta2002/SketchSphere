const User = require('../models/userSchema')

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.sesssion.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect('/login')
            }
        })
        .catch(error=>{

            console.log("Error in user auth middleware")
            res.status(500).send("Internal Server error")
        })
    }else{
        res.redirect('/login')
    }
}

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect('/admin')
        }
    })
    .catch(error=>{
        console.log("Error in adminAuth middeleware")
        res.status(500).send('Internal Server Error')
    })
}

module.exports={
    userAuth,
    adminAuth

}