const express=require('express')
const router=express.Router()
const adminController=require('../controlles/admin/adminController')
const {userAuth,adminAuth}=require('../middleware/auth')
const coustomerController= require('../controlles/admin/customerController')
const categoryController = require('../controlles/admin/categoryController')
const productController =require('../controlles/admin/productController')
const orderController = require('../controlles/admin/orderController')

const multer=require("multer");
const storage=require("../helpers/multer");
const uploads = multer({storage:storage})

router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard)
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

router.get('/addProducts',productController.getProductAddPage)
router.post('/addProducts',adminAuth,uploads.array("images",4),productController.addproduct)
router.get('/products',adminAuth,productController.getAllProducts)
router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,uploads.array('images',4),productController.editProduct)
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

// Order Management Routes
router.get('/orders', adminAuth, orderController.getAllOrders)
router.get('/order/:orderId', adminAuth, orderController.getOrderDetails)
router.post('/order/:orderId/item/:itemId/status', adminAuth, orderController.updateOrderItemStatus)

module.exports= router