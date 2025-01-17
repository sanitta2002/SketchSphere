const express=require('express')
const router=express.Router()
const adminController=require('../controlles/admin/adminController')
const {userAuth,adminAuth}=require('../middleware/auth')
const coustomerController= require('../controlles/admin/customerController')
const categoryController = require('../controlles/admin/categoryController')
const productController =require('../controlles/admin/productController')
const orderController = require('../controlles/admin/orderController')
const couponController = require('../controlles/admin/couponController');
const offerController = require('../controlles/admin/offerController')
const multer=require("multer");
const storage=require("../helpers/multer");
const uploads = multer({storage:storage})

router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard)
router.post('/generate-report',adminAuth,adminController.generateReport)
router.get('/logout',adminController.logout)

router.get('/users',adminAuth,coustomerController.customerInfo)
router.get('/blockCustomer',adminAuth,coustomerController.CustomerBlocked)
router.get('/unblockCustomer',adminAuth,coustomerController.CustomerunBlocked)

router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/UnlistCategory',adminAuth,categoryController.getunListCategory)
router.get('/editCategory',adminAuth,categoryController.getEditCategoty)
router.post('/editCategory/:id',adminAuth,categoryController.EditCategoty)

// Category offer routes
router.post('/add-category-offer', adminAuth, categoryController.addCategoryOffer);
router.post('/remove-category-offer', adminAuth, categoryController.removeCategoryOffer);

router.get('/addProducts',productController.getProductAddPage)
router.post('/addProducts',adminAuth,uploads.array("images",4),productController.addproduct)
router.get('/products',adminAuth,productController.getAllProducts)
router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,uploads.array('images',4),productController.editProduct)
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

// Product offer routes
router.get('/products/:id/add-offer', adminAuth, offerController.getAddOffer);
router.post('/products/:id/add-offer', adminAuth, offerController.addOffer);
router.get('/products/:id/remove-offer', adminAuth, offerController.removeOffer);

// Coupon Management Routes
router.get('/coupons', adminAuth, couponController.getAllCoupons);
router.get('/coupons/add', adminAuth, couponController.getAddCouponPage);
router.post('/coupons/add', adminAuth, couponController.addCoupon);
router.get('/coupons/edit/:id', adminAuth, couponController.getEditCouponPage);
router.put('/coupons/edit/:id', adminAuth, couponController.updateCoupon);
router.patch('/coupons/toggle/:id', adminAuth, couponController.toggleCouponStatus);

// Order Management Routes
router.get('/orders', adminAuth, orderController.getAllOrders)
router.get('/order/:orderId', adminAuth, orderController.getOrderDetails)
router.post('/order/:orderId/item/:itemId/status', adminAuth, orderController.updateItemStatus)

// Sales Report Route
// router.post('/generate-report', adminAuth, adminController.generateReport);

module.exports= router