const { models } = require("mongoose")

const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')  

const nodemailer = require('nodemailer')
const env = require("dotenv").config()
const bcrypt = require('bcrypt')


//render error page
const pageNotFound = async (req, res) => {

    try {

        res.render("user/404-page")

    } catch (error) {
        res.redirect('/pageNOtFoud')
        console.log()
    }
}

//render home page
const loadHomepage = async (req, res) => {
    try {
        // Fetch products with all necessary fields
        const products = await Product.find({ isBlocked: false })
            .populate('category_id')
            .select('name description product_img quantity Regular_price Sale_price offerPrice')
            .sort({ createdAt: -1 })
            .limit(8);

        // Get user data if logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }

        return res.render('home', {
            products,
            categories: [],
            user: userData
        });
    } catch (error) {
        console.log("Error loading home page:", error);
        res.status(500).send('server error');
    }
}


const loadSignup = async (req, res) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }
        res.render('signup', { user: userData });
    } catch (error) {
        console.log(error.message);
        res.render('signup', { user: null });
    }
}

// const signup = async(req,res)=>{
//     const {name,email,phone,password}=req.body
//     try{
//        console.log(req.boby)
//         const newUser = new User({name,email,phone,password})
//         await newUser.save();
        
//         return  res.redirect('/signup')

//     }catch(error){
       
//         console.log("Error for save user",error)
//         res.status(500).send("Internal server error")
//     }
// }


function generateOtp() {

    return Math.floor(100000 + Math.random() * 900000).toString()
}
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // use SSL
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD // Use your app-specific password here
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });

        console.log("Email sent successfully:", info.messageId);
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

const signup = async (req, res) => {
    try {

        const { name, email, phone, password, confirmPassword } = req.body
        console.log(req.body)
        console.log(email, password, confirmPassword)
        if (password !== confirmPassword) {
            return res.render('signup', { message: "Passwords do not match" })
        }

        const findUser = await User.findOne({ email })

        if (findUser) {
            console.log("user")
            return res.render("signup", { message: "User with this email already exists" })
        }

        const otp = generateOtp();
        console.log("OTP sent" + otp)
        const emailSend = await sendVerificationEmail(email, otp)

        if (!emailSend) {
            return res.json("email-error")
        }

        // Store OTP with expiration time (5 minutes from now)
        req.session.userOtp = {
            code: otp,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes in milliseconds
        };
        req.session.userData = { name, phone, email, password }

        res.render("verify-otp")
        console.log("OTP sent", otp)
        // res.status(200).json({message:"mail Sent"});

    } catch (error) {

        console.error("signup error" + error)
        res.redirect('/404-page')

    }
}

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;

    } catch (error) {

    }
}




const verifyOtp = async (req, res) => {
    try {
        const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;
        const enteredOtp = `${otp1}${otp2}${otp3}${otp4}${otp5}${otp6}`; // Concatenate OTP inputs
        console.log("Entered OTP:", enteredOtp);

        // Check if OTP exists in session
        if (!req.session.userOtp || !req.session.userOtp.code) {
            return res.status(400).json({ success: false, message: "No OTP found in session." });
        }

        const { code, expiresAt } = req.session.userOtp;

        // Check if OTP has expired
        if (Date.now() > expiresAt) {
            // Clear expired OTP from session
            delete req.session.userOtp;
            return res.status(400).json({ success: false, message: "OTP has expired." });
        }

        // Verify OTP
        if (enteredOtp === code) {
            const user = req.session.userData;
            if (!user) {
                return res.status(400).json({ success: false, message: "User data not found in session." });
            }

            // Hash password
            const passwordHash = await securePassword(user.password);

            // Save user data
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            });

            await saveUserData.save();

            // Clear OTP and user data from session after successful verification
            delete req.session.userOtp;
            delete req.session.userData;

            req.session.user = saveUserData._id;

            console.log("User registered successfully.");
            return res.json({ success: true, message: "OTP verified successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred while verifying OTP." });
    }
};

// Resend OTP Function
const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;

        // Check if email exists in session
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session." });
        }

        const otp = generateOtp(); // Generate a new OTP
        console.log("Generated OTP:", otp);

        // Update OTP in session
        req.session.userOtp = { code: otp, expiresAt: Date.now() + 300000 }; // 5 minutes expiration

        // Send OTP via email
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP successful:", otp);
            return res.status(200).json({ success: true, message: "OTP resent successfully." });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Internal server error while resending OTP." });
    }
};



const loadLogin = async (req, res) => {
    try {
        // Check if user is already logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }
        return res.render('login', { user: userData });
    } catch (error) {
        console.log(error.message);
        res.render('login', { user: null });
    }
}


const login = async (req, res) => {
    try {
        // Get user credentials
        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email })
        if (!findUser) {
            return res.render('login', { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render('login', { message: "User is blocked by admin" })
        }
        const passwordMatch = await bcrypt.compare(password, findUser.password)
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" })
        }
        req.session.user = findUser._id
        res.redirect('/')


    } catch (error) {

        console.error("Login error" + error)
        res.render('login', { message: "login failed. Please try again later" })

    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Seesion destructure error", err.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("logout error", error);
        res.redirect("/PageNotFound")

    }
};

const profile = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Fetch user's orders
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderedItems.product',
                select: 'name product_img Sale_price'
            })
            .sort({ createdOn: -1 });

        console.log('Found orders for profile:', orders.map(o => ({
            id: o._id.toString(),
            orderId: o.orderId,
            status: o.status,
            items: o.orderedItems.length,
            total: o.finalAmount
        })));

        res.render('profile', {
            user,
            orders,
            pageTitle: 'My Profile'
        });
    } catch (error) {
        console.error("Profile page error:", error);
        res.redirect('/pageNotFound');
    }
};

const editProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name },
            { new: true }
        );

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Edit profile error:", error);
        res.status(500).json({ success: false, message: "Failed to update profile" });
    }
};

const changeEmail = async (req, res) => {
    try {
        const userId = req.session.user;
        const { email } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already in use"
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { email },
            { new: true }
        );

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Change email error:", error);
        res.status(500).json({ success: false, message: "Failed to update email" });
    }
};

const changePhone = async (req, res) => {
    try {
        const userId = req.session.user;
        const { phone } = req.body;

        // Check if phone already exists
        const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Phone number already in use"
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { phone },
            { new: true }
        );

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Change phone error:", error);
        res.status(500).json({ success: false, message: "Failed to update phone number" });
    }
};

const loadChangePassword = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        res.render('change-password');
    } catch (error) {
        console.error("Load change password error:", error);
        res.redirect('/profile');
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Check if new password matches confirmation
        if (newPassword !== confirmPassword) {
            return res.json({
                success: false,
                message: "New passwords do not match"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.findByIdAndUpdate(userId, { password: hashedPassword });

        res.json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.json({
            success: false,
            message: "Failed to update password"
        });
    }
};

const loadShop = async (req, res) => {
    try {
        // Get filter parameters from query
        const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : 1000;
        const selectedCategories = req.query.categories ? req.query.categories.split(',') : [];
        const sortBy = req.query.sortBy || '';
        const searchQuery = req.query.search || '';

        // Build filter query
        let filterQuery = {
            isBlocked: false,
            quantity: { $gt: 0 },
            Sale_price: { $lte: maxPrice }
        };

        // Add search query if provided
        if (searchQuery) {
            filterQuery.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { writer: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Add category filter if categories are selected
        if (selectedCategories.length > 0) {
            filterQuery.category_id = { $in: selectedCategories };
        }

        // Fetch all  active categories
        const categories = await Category.find({ isListed: true });

        // Build sort options
        let sortOptions = {};
        switch (sortBy) {
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'az':
                sortOptions = { name: 1 };
                break;
            case 'za':
                sortOptions = { name: -1 };
                break;
            case 'priceHigh':
                sortOptions = { Sale_price: -1 };
                break;
            case 'priceLow':
                sortOptions = { Sale_price: 1 };
                break;
            default:
                sortOptions = { createdAt: -1 }; // Default sort
        }

        // Fetch filtered and sorted products
        const products = await Product.find(filterQuery)
            .populate('category_id')
            .sort(sortOptions);

        // Get user data if logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }

        res.render('shop', {
            products,
            categories,
            selectedPrice: maxPrice,
            selectedCategories,
            sortBy,
            searchQuery,
            user: userData
        });
    } catch (error) {
        console.error("Error in loadShop:", error);
        res.redirect('/pageNotFound');
    }
};

const searchProducts = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : 1000;
        const selectedCategories = req.query.categories ? req.query.categories.split(',').filter(id => id) : [];
        const sortBy = req.query.sortBy || '';

        // Build filter query
        let filterQuery = {
            isBlocked: false,
            quantity: { $gt: 0 },
            Sale_price: { $lte: maxPrice }
        };

        // Add search query if provided
        if (searchQuery) {
            filterQuery.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { writer: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Add category filter if categories are selected
        if (selectedCategories.length > 0) {
            filterQuery.category_id = { $in: selectedCategories };
        }

        // Build sort options
        let sortOptions = {};
        switch (sortBy) {
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'az':
                sortOptions = { name: 1 };
                break;
            case 'za':
                sortOptions = { name: -1 };
                break;
            case 'priceHigh':
                sortOptions = { Sale_price: -1 };
                break;
            case 'priceLow':
                sortOptions = { Sale_price: 1 };
                break;
            default:
                sortOptions = { createdAt: -1 }; // Default sort
        }

        // Fetch filtered and sorted products
        const products = await Product.find(filterQuery)
            .populate('category_id')
            .sort(sortOptions);

        res.json({
            success: true,
            products: products
        });
    } catch (error) {
        console.error("Error in searchProducts:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    profile,
    editProfile,
    changeEmail,
    changePhone,
    loadChangePassword,
    changePassword,
    loadShop,
    searchProducts
}