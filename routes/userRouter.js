const express=require('express')
const router=express.Router()
const userController=require('../controlles/user/userController')
const productController=require('../controlles/user/productController')



router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)

router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)

router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get("/logout",userController.logout);

router.get("/productDetails",productController.productDetail); 



module.exports = router