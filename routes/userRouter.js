const express=require('express')
const router=express.Router()
const userController=require('../controlles/user/userController')
const productController=require('../controlles/user/productController')
const addressController=require('../controlles/user/addressController')
const cartController=require('../controlles/user/cartController')
const checkoutController=require('../controlles/user/checkoutController')
const orderController=require('../controlles/user/orderController')
const passport = require('passport')


router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)

router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})


router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get("/logout",userController.logout);

router.get("/productDetails",productController.productDetail); 

router.get('/shop', userController.loadShop);

// Profile editing routes
router.get("/profile", userController.profile);
router.post("/edit-profile", userController.editProfile);
router.post("/change-email", userController.changeEmail);
router.post("/change-phone", userController.changePhone);

// Password change routes
router.get("/change-password", userController.loadChangePassword);
router.post("/change-password", userController.changePassword);

// Address routes
router.get('/add-address',addressController.loadAddAddress)
router.post('/add-address', addressController.addAddress);
router.get('/get-addresses', addressController.getUserAddresses);
router.put('/edit-address/:index', addressController.editAddress);
router.delete('/delete-address/:index', addressController.deleteAddress);

// Cart routes
router.get('/cart', cartController.loadCart);
router.post('/add-to-cart', cartController.addToCart);
router.post('/update-cart', cartController.updateCart);
router.post('/remove-from-cart', cartController.removeFromCart);

// Checkout routes
router.get('/checkout', checkoutController.loadCheckout);
router.post('/place-order', checkoutController.placeOrder);

// Order routes
router.get('/orders', orderController.viewOrders);
router.get('/orderDetails/:orderId', orderController.viewOrder);
router.post('/cancel-order/:orderId', orderController.cancelOrder);
router.get('/orderSuccess/:orderId',orderController.orderSuccess);

// Order details API
router.get('/api/orders/:orderId', orderController.getOrderDetails);

module.exports = router