const express=require('express')
const router=express.Router()
const userController=require('../controlles/user/userController')
const productController=require('../controlles/user/productController')
const addressController=require('../controlles/user/addressController')
const cartController=require('../controlles/user/cartController')
const checkoutController=require('../controlles/user/checkoutController')
const orderController=require('../controlles/user/orderController')
const wishlistController=require('../controlles/user/wishlistController')
const {userAuth}=require('../middleware/auth')
const passport = require('passport')
const paymentController = require('../controlles/user/paymentController')
const { generateInvoice } = require('../controlles/user/invoiceController')


router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)

router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id;  
    res.redirect('/')
})

router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get("/logout",userController.logout);

// Forgot Password route
router.get("/forgot-password", userController.loadForgotPassword);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);

// Product routes
router.get('/productDetails', productController.productDetail);


router.get('/shop', userController.loadShop);

// Profile editing routes
router.get("/profile", userAuth,userController.profile);
router.post("/edit-profile", userAuth,userController.editProfile);
router.post("/change-email", userAuth,userController.changeEmail);
router.post("/change-phone", userAuth,userController.changePhone);

// Password change routes
router.get("/change-password", userAuth,userController.loadChangePassword);
router.post("/change-password", userAuth,userController.changePassword);

// Address routes
router.get('/add-address',userAuth,addressController.loadAddAddress)
router.post('/add-address', userAuth,addressController.addAddress);
router.get('/get-addresses', userAuth,addressController.getUserAddresses);
router.put('/edit-address/:index', userAuth,addressController.editAddress);
router.delete('/delete-address/:index', addressController.deleteAddress);

// Cart routes
router.get('/cart', userAuth,cartController.loadCart);
router.post('/add-to-cart', cartController.addToCart);
router.post('/update-cart', cartController.updateCart);
router.post('/remove-from-cart', cartController.removeFromCart);

// Wishlist routes
router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/toggle-wishlist', wishlistController.toggleWishlist);
router.get('/get-wishlist', wishlistController.getWishlistStatus);
router.get('/wishlist-status/:productId', wishlistController.getWishlistStatus);

// Checkout routes
router.get('/checkout', userAuth, checkoutController.loadCheckout);
router.post('/place-order', userAuth, checkoutController.placeOrder);
router.post('/apply-coupon', userAuth, checkoutController.applyCoupon);
router.post('/remove-coupon', userAuth, checkoutController.removeCoupon);

// Order routes
router.get('/orders', userAuth,orderController.viewOrders);
router.get('/orderDetails/:orderId', userAuth,orderController.viewOrder);
router.post('/cancel-order/:orderId', userAuth,orderController.cancelOrder);
router.get('/orderSuccess',userAuth,orderController.orderSuccess);
router.get('/view-order-item', userAuth, orderController.viewOrderItemDetails);
router.post('/update-order-item-status/:orderId/:itemId', userAuth, orderController.updateOrderItemStatus);
router.get('/get-order-details/:orderId', userAuth, orderController.getOrderDetails);
router.get('/generate-invoice/:orderId', userAuth, generateInvoice);

// Order details API
router.get('/api/orders/:orderId', orderController.getOrderDetails);

// Payment routes
router.post('/create-razorpay-order', userAuth, paymentController.createOrder);
router.post('/verify-payment', userAuth, paymentController.verifyPayment);
router.post('/handle-payment-failure', userAuth, checkoutController.handlePaymentFailure);
router.post('/process-wallet-payment', userAuth, paymentController.processWalletPayment);

// Add this line after other routes
router.get('/search-products', userController.searchProducts);

module.exports = router