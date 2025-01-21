const { models } = require("mongoose")

const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')  
const Cart = require('../../models/cartSchema')
const Wallet = require('../../models/walletSchema')
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
        // Get active categories first
        const activeCategories = await Category.find({ isListed: true });
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        // Fetch products from active categories only
        const products = await Product.find({ 
            isBlocked: false,
            category_id: { $in: activeCategoryIds }
        })
            .populate('category_id')
            .select('name description product_img quantity Regular_price Sale_price offerPrice offerPercentage offerStartDate offerEndDate')
            .sort({ createdAt: -1 })
            .limit(8);

        // Process products with offers
        const processedProducts = products.map(product => {
            const now = new Date();
            const category = product.category_id;
            
            // Get product and category offers
            const productOffer = product.offerPercentage || 0;
            const categoryOffer = category?.offerPercentage || 0;
            
            // Check if offers are valid
            const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
            const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
            
            // Determine which offer is better
            let bestOffer = 0;
            let offerType = 'none';
            
            if (hasValidProductOffer && hasValidCategoryOffer) {
                // Both offers are valid, use the higher one
                if (productOffer >= categoryOffer) {
                    bestOffer = productOffer;
                    offerType = 'product';
                } else {
                    bestOffer = categoryOffer;
                    offerType = 'category';
                }
            } else if (hasValidProductOffer) {
                bestOffer = productOffer;
                offerType = 'product';
            } else if (hasValidCategoryOffer) {
                bestOffer = categoryOffer;
                offerType = 'category';
            }
            
            // Calculate current price with best offer
            let currentPrice = product.Sale_price;
            if (bestOffer > 0) {
                const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                currentPrice = Math.round(product.Sale_price - discountAmount);
            }
            
            return {
                ...product.toObject(),
                currentPrice,
                originalPrice: product.Sale_price,
                offerPercentage: bestOffer,
                hasValidOffer: bestOffer > 0,
                offerType,
                productOffer: hasValidProductOffer ? productOffer : 0,
                categoryOffer: hasValidCategoryOffer ? categoryOffer : 0
            };
        });

        // Get user data if logged in
        let userData = null;
        let cartData = null;
        let wishlistCount = 0;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
            cartData = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
            wishlistCount = userData.wishlist ? userData.wishlist.length : 0;
        }
        
        return res.render('home', {
            products: processedProducts,
            user: userData,
            cart: cartData,
            categories: activeCategories,
            wishlistCount: wishlistCount
        });

    } catch (error) {
        console.error('Error in loadHomepage:', error);
        res.status(500).render('error', { error: 'Failed to load homepage' });
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
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }
        res.render('login', { user: userData });
    } catch (error) {
        console.log(error.message);
        res.render('login', { user: null });
    }
}

const loadForgotPassword = async (req, res) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }
        res.render('forgot-password', { user: userData, message: '' });
    } catch (error) {
        console.log(error.message);
        res.render('forgot-password', { user: null, message: '' });
    }
}

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.render('forgot-password', { 
                user: null, 
                message: 'No account found with this email address.' 
            });
        }

        // Generate OTP
        const otp = generateOtp();
        
        // Save OTP to session with expiry
        req.session.resetPasswordOtp = {
            email: email,
            code: otp,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        };

        // Send OTP via email
        await sendVerificationEmail(email, otp);

        // Redirect to reset password page
        return res.render('reset-password', { 
            user: null,
            email: email,
            message: 'Please check your email for the OTP to reset your password.'
        });

    } catch (error) {
        console.error('Error in forgot password:', error);
        return res.render('forgot-password', { 
            user: null, 
            message: 'An error occurred. Please try again.' 
        });
    }
}

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        // Verify OTP
        if (!req.session.resetPasswordOtp || 
            req.session.resetPasswordOtp.email !== email || 
            req.session.resetPasswordOtp.code !== otp ||
            Date.now() > req.session.resetPasswordOtp.expiresAt) {
            return res.render('reset-password', {
                user: null,
                email: email,
                message: 'Invalid or expired verification code. Please try again.'
            });
        }

        // Verify passwords match
        if (newPassword !== confirmPassword) {
            return res.render('reset-password', {
                user: null,
                email: email,
                message: 'Passwords do not match.'
            });
        }

        // Find user and update password
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.render('reset-password', {
                user: null,
                email: email,
                message: 'User not found.'
            });
        }

        // Hash new password
        const passwordHash = await securePassword(newPassword);
        user.password = passwordHash;
        await user.save();

        // Clear reset password OTP from session
        delete req.session.resetPasswordOtp;

        // Redirect to login with success message
        return res.render('login', {
            user: null,
            message: 'Password reset successful. Please login with your new password.'
        });

    } catch (error) {
        console.error('Error in reset password:', error);
        return res.render('reset-password', {
            user: null,
            email: req.body.email,
            message: 'An error occurred while resetting your password. Please try again.'
        });
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

        // Fetch user's wallet
        const wallet = await Wallet.findOne({ userId })
            .sort({ 'transactions.date': -1 });

        console.log('Found orders for profile:', orders.map(o => ({
            id: o._id.toString(),
            orderId: o.orderId,
            status: o.status,
            items: o.orderedItems.length,
            total: o.finalAmount
        })));

        let userData = null;
        let cartData = null;
        let wishlistCount = 0;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
            cartData = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
            wishlistCount = userData.wishlist ? userData.wishlist.length : 0;
        }

        res.render('profile', {
            user,
            orders,
            wallet,
            pageTitle: 'My Profile',
            cart: cartData,
            wishlistCount: wishlistCount
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
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // Get filter parameters
        let selectedCategories = req.query.categories ? req.query.categories.split(',') : [];
        let minPrice = req.query.minPrice || 0;
        let maxPrice = req.query.maxPrice || Number.MAX_SAFE_INTEGER;
        let sortOption = req.query.sortBy || '';
        let searchQuery = req.query.search || '';

        // Build base query
        let query = { isBlocked: false };
        
        // Add category filter
        if (selectedCategories.length > 0) {
            query.category_id = { $in: selectedCategories };
        }

        // Add price filter
        query.Sale_price = { 
            $gte: parseInt(minPrice), 
            $lte: parseInt(maxPrice) 
        };

        // Add search filter
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { writer: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Get active categories
        const categories = await Category.find({ isListed: true });
        
        // Build sort options
        let sortOptions = {};
        switch (sortOption) {
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
                sortOptions = { createdAt: -1 };
        }
        
        // Fetch products with category data
        let products = await Product.find(query)
            .populate('category_id')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        // Process products with offers
        const processedProducts = products.map(product => {
            const now = new Date();
            const category = product.category_id;
            
            // Get product and category offers
            const productOffer = product.offerPercentage || 0;
            const categoryOffer = category?.offerPercentage || 0;
            
            // Check if offers are valid
            const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
            const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
            
            // Determine which offer is better
            let bestOffer = 0;
            let offerType = 'none';
            
            if (hasValidProductOffer && hasValidCategoryOffer) {
                if (productOffer >= categoryOffer) {
                    bestOffer = productOffer;
                    offerType = 'product';
                } else {
                    bestOffer = categoryOffer;
                    offerType = 'category';
                }
            } else if (hasValidProductOffer) {
                bestOffer = productOffer;
                offerType = 'product';
            } else if (hasValidCategoryOffer) {
                bestOffer = categoryOffer;
                offerType = 'category';
            }
            
            // Calculate current price with best offer
            let currentPrice = product.Sale_price;
            if (bestOffer > 0) {
                const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                currentPrice = Math.round(product.Sale_price - discountAmount);
            }
            
            return {
                ...product.toObject(),
                currentPrice,
                originalPrice: product.Sale_price,
                offerPercentage: bestOffer,
                hasValidOffer: bestOffer > 0,
                offerType,
                productOffer: hasValidProductOffer ? productOffer : 0,
                categoryOffer: hasValidCategoryOffer ? categoryOffer : 0
            };
        });

        // Get total count for pagination (using the same query without skip/limit)
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        let userData = null;
        let cartData = null;
        let wishlistCount = 0;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
            cartData = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
            wishlistCount = userData.wishlist ? userData.wishlist.length : 0;
        }

        // Render the shop page
        res.render('shop', {
            products: processedProducts,
            categories,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages,
            selectedCategories,
            selectedPrice: maxPrice || 1000,
            minPrice: minPrice || 0,
            maxPrice: maxPrice || 1000,
            sortBy: sortOption || 'default',
            searchQuery: searchQuery || '',
            cart:cartData,
            wishlistCount: wishlistCount
        });

    } catch (error) {
        console.error('Error in loadShop:', error);
        res.status(500).render('user/500');
    }
};

const searchProducts = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const categories = req.query.categories ? req.query.categories.split(',') : [];
        const maxPrice = parseInt(req.query.maxPrice) || 1000;
        const sortBy = req.query.sortBy || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;

        // Build search query
        let query = {
            isBlocked: false,
            Sale_price: { $lte: maxPrice }
        };

        // Add search conditions if search query exists
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                // { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Add category filter if categories are selected
        if (categories.length > 0) {
            query.category_id = { $in: categories };
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
                sortOptions = { createdAt: -1 };
        }

        // Fetch products with category data
        const products = await Product.find(query)
            .populate('category_id')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        // Process products with offers
        const processedProducts = products.map(product => {
            const now = new Date();
            const category = product.category_id;
            
            // Get product and category offers
            const productOffer = product.offerPercentage || 0;
            const categoryOffer = category?.offerPercentage || 0;
            
            // Check if offers are valid
            const hasValidProductOffer = productOffer > 0 && product.offerEndDate && new Date(product.offerEndDate) > now;
            const hasValidCategoryOffer = categoryOffer > 0 && category?.offerEndDate && new Date(category.offerEndDate) > now;
            
            // Get the best offer
            let bestOffer = 0;
            let offerType = null;
            
            if (hasValidProductOffer && hasValidCategoryOffer) {
                if (productOffer >= categoryOffer) {
                    bestOffer = productOffer;
                    offerType = "Product Offer";
                } else {
                    bestOffer = categoryOffer;
                    offerType = "Category Offer";
                }
            } else if (hasValidProductOffer) {
                bestOffer = productOffer;
                offerType = "Product Offer";
            } else if (hasValidCategoryOffer) {
                bestOffer = categoryOffer;
                offerType = "Category Offer";
            }
            
            // Calculate offer price
            let currentPrice = product.Sale_price;
            if (bestOffer > 0) {
                const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                currentPrice = Math.round(product.Sale_price - discountAmount);
            }
            
            return {
                ...product._doc,
                currentPrice,
                offerPercentage: bestOffer,
                hasValidOffer: bestOffer > 0,
                offerType,
                originalPrice: product.Sale_price
            };
        });

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            products: processedProducts,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages
        });

    } catch (error) {
        console.error('Error in searchProducts:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};

// Toggle wishlist
const toggleWishlist = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user) {
            return res.json({
                success: false,
                redirect: true,
                message: 'Please login to add items to wishlist'
            });
        }

        const userId = req.session.user;
        const { productId } = req.body;

        // Find user and check if product exists
        const [user, product] = await Promise.all([
            User.findById(userId),
            Product.findById(productId)
        ]);

        if (!product) {
            return res.json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product is already in wishlist
        const wishlistIndex = user.wishlist.indexOf(productId);
        let action;

        if (wishlistIndex === -1) {
            // Add to wishlist
            user.wishlist.push(productId);
            action = 'added';
        } else {
            // Remove from wishlist
            user.wishlist.splice(wishlistIndex, 1);
            action = 'removed';
        }

        await user.save();

        res.json({
            success: true,
            action,
            message: action === 'added' ? 'Added to wishlist' : 'Removed from wishlist'
        });

    } catch (error) {
        console.error('Error in toggleWishlist:', error);
        res.json({
            success: false,
            message: 'Failed to update wishlist'
        });
    }
};

// Get wishlist items
const getWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({
                success: false,
                message: 'User not logged in'
            });
        }

        const user = await User.findById(req.session.user);
        if (!user) {
            return res.json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            wishlist: user.wishlist
        });

    } catch (error) {
        console.error('Error in getWishlist:', error);
        res.json({
            success: false,
            message: 'Failed to get wishlist'
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
    loadForgotPassword,
    forgotPassword,
    resetPassword,
    login,
    logout,
    profile,
    editProfile,
    changeEmail,
    changePhone,
    loadChangePassword,
    changePassword,
    loadShop,
    searchProducts,
    toggleWishlist,
    getWishlist
}