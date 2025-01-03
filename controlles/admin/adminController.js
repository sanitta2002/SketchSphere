const User=require('../../models/userSchema')
const mongoose=require('mongoose')
const bcrypt=require('bcrypt')


const pageerror = async(req,res)=>{
    res.render('admin-error')
}

const loadLogin = async (req, res) => {
    try {
        res.render('adminlogin');
    } catch (error) {
        console.error("Error rendering login page:", error.message);
        res.status(500).send("Unable to load the login page.");
    }
};


const login = async (req,res)=>{
    try {

        const {email,password}=req.body
        console.log(req.body)
        const admin=await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordsMatch = await bcrypt.compare(password,admin.password)
            if(passwordsMatch){
                req.session.admin = true
                return res.redirect('/admin')
            }else{
                return res.redirect('/adminlogin')
            }
        }else{
            return res.redirect('/adminlogin')
        }
        
    } catch (error) {

        console.log("login error",error)
        return res.redirect('/pageeroor')
        
    }
}


const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            console.log("Rendering dashboard for admin:", req.session.admin);
            res.render("dashboard");
        } catch (error) {
            console.error("Dashboard error:", error);
            res.redirect('/pageerror'); // Redirect to error page
        }
    } else {
        console.log("Admin session not found, redirecting to login.");
        res.redirect('/adminlogin'); // Redirect to login if not authenticated
    }
};



const logout=async(req,res)=>{
    
    try{
        req.session.admin = false
        if (req.session.admin) {
            res.redirect('/admin')
        }else{
            return res.redirect('/admin/login')

        }

    }catch(error){
        console.log("unexpected error during logout",error)
        res.redirect('/pageerror')

    }
}



module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}