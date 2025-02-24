const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const CouponUsage = require('../../models/couponUsageSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema'); 
const mongoose = require('mongoose');

const checkoutController = {
    loadCheckout: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const user = await User.findById(req.session.user);
            const cart = await Cart.findOne({ userId: req.session.user })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category_id',
                        select: 'name offerPercentage offerEndDate'
                    }
                });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            //  wallet balance
            const wallet = await Wallet.findOne({ userId: req.session.user });
            const walletBalance = wallet ? wallet.balance : 0;
            user.walletBalance = walletBalance;

            // Calculate  best offer
            const cartItems = cart.items.map(item => {
                const product = item.productId;
                const now = new Date();
                const category = product.category_id;

               
                const productOffer = product.offerPercentage || 0;
                const categoryOffer = category?.offerPercentage || 0;

               
                const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
                const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;

                // better is 
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
                let discountAmount = 0;
                if (bestOffer > 0) {
                    discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                    currentPrice = Math.round(product.Sale_price - discountAmount);
                }

                return {
                    ...item.toObject(),
                    currentPrice,
                    originalPrice: product.Sale_price,
                    offerPercentage: bestOffer,
                    offerType,
                    productOffer: hasValidProductOffer ? productOffer : 0,
                    categoryOffer: hasValidCategoryOffer ? categoryOffer : 0,
                    totalPrice: currentPrice * item.quantity,
                    discountAmount: discountAmount
                };
            });

            
            const subtotal = cartItems.reduce((total, item) => total + item.totalPrice, 0);

            const userAddress = await Address.findOne({ userId: req.session.user });
            const addresses = userAddress ? userAddress.address : [];

            
            const usedCoupons = await CouponUsage.distinct('couponCode', {
                userId: req.session.user
            });

            
            const allActiveCoupons = await Coupon.find({
                isList: true,
                expireOn: { $gt: new Date() },
                minimumPrice: { $lte: subtotal }
            });

            // Filter out used coupons
            const activeCoupons = allActiveCoupons.filter(coupon =>
                !usedCoupons.includes(coupon.name.toUpperCase())
            );

            res.render('checkout', {
                cart: {
                    ...cart.toObject(),
                    items: cartItems
                },
                addresses,
                subtotal,
                activeCoupons,
                pageTitle: 'Checkout',
                user
            });
        } catch (error) {
            console.error('Error loading checkout:', error);
            res.status(500).render('error', { error: 'Failed to load checkout page' });
        }
    },

    applyCoupon: async (req, res) => {
        try {
            const { couponCode, totalAmount } = req.body;
            const userId = req.session.user;

            // Check if user already has an active coupon in their current checkout session
            if (req.session.appliedCoupon) {
                return res.json({
                    success: false,
                    message: 'A coupon is already applied. Please remove it first to apply a different coupon.'
                });
            }

            const coupon = await Coupon.findOne({
                name: couponCode.toUpperCase(),
                isList: true,
                expireOn: { $gt: new Date() }
            });

            if (!coupon) {
                return res.json({
                    success: false,
                    message: 'Invalid or expired coupon code'
                });
            }

            if (totalAmount < coupon.minimumPrice) {
                return res.json({
                    success: false,
                    message: `Minimum purchase amount of ₹${coupon.minimumPrice} required`
                });
            }

            // Check if coupon has been used before
            const couponUsage = await CouponUsage.findOne({
                userId,
                couponCode: couponCode.toUpperCase()
            });

            if (couponUsage) {
                return res.json({
                    success: false,
                    message: 'You have already used this coupon before'
                });
            }

            const discount = Math.min(coupon.offerPrice, totalAmount);
            

            // Store the applied coupon in session
            req.session.appliedCoupon = {
                code: coupon.name,
                discount: discount,
                couponId: coupon._id
            };

            return res.json({
                success: true,
                message: 'Coupon applied successfully!',
                discount,
                couponId: coupon._id
            });

        } catch (error) {
            console.error('Error applying coupon:', error);
            return res.json({
                success: false,
                message: 'Failed to apply coupon'
            });
        }
    },

    removeCoupon: async (req, res) => {
        try {
            
            delete req.session.appliedCoupon;

            return res.json({
                success: true,
                message: 'Coupon removed successfully'
            });
        } catch (error) {
            console.error('Error removing coupon:', error);
            return res.json({
                success: false,
                message: 'Failed to remove coupon'
            });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const {
                addressId,
                paymentMethod,
                couponCode,
                totalPrice,
                finalAmount,
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } = req.body;

            
            if (!totalPrice || !finalAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Total price and final amount are required'
                });
            }

            // Validate address
            const userAddress = await Address.findOne({
                userId: req.session.user,
                'address._id': addressId
            });

            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid address selected'
                });
            }

            // Get cart items first
            const cart = await Cart.findOne({ userId: req.session.user })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category_id',
                        select: 'name offerPercentage offerEndDate'
                    }
                });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            
            const orderItems = cart.items.map(item => {
                const product = item.productId;
                const now = new Date();
                const category = product.category_id;

                
                const productOffer = product.offerPercentage || 0;
                const categoryOffer = category?.offerPercentage || 0;

             
                const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
                const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;

                
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

                
                let currentPrice = product.Sale_price;
                let discount = 0;
                if (bestOffer > 0) {
                    discount = Math.round((product.Sale_price * bestOffer) / 100);
                    currentPrice = Math.round(product.Sale_price - discount);
                }

                return {
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: currentPrice,
                    totalPrice: currentPrice * item.quantity,
                    discount: discount
                };
            });

            // Calculate order total and total discount
            const orderTotal = orderItems.reduce((total, item) => total + item.totalPrice, 0);
            const itemsDiscount = orderItems.reduce((total, item) => total + (item.discount * item.quantity), 0);

           
            const couponDiscount = req.session.appliedCoupon ? req.session.appliedCoupon.discount : 0;
            const totalDiscount = itemsDiscount + couponDiscount;

            
            for (const cartItem of cart.items) {
                const product = await Product.findById(cartItem.productId._id);
                if (!product) {
                    return res.status(400).json({
                        success: false,
                        message: `Product ${cartItem.productId.name} not found`
                    });
                }
                if (product.available_quantity < cartItem.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.name}. Only ${product.available_quantity} available.`
                    });
                }
            }

            
            const order = new Order({
                userId: req.session.user,
                orderedItems: orderItems,
                address: userAddress.address.find(addr => addr._id.toString() === addressId),
                paymentMethod: paymentMethod,
                totalPrice: totalPrice,
                discount: totalDiscount,
                finalAmount: finalAmount,
                paymentStatus: paymentMethod === 'online' ? 'Processing' : 'Pending',
                status: 'Pending',
                couponCode: couponCode || null,
                couponAmount: couponDiscount
            });

            // If online payment, add payment details
            if (paymentMethod === 'online') {
                if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                    console.error('Missing payment details:', { razorpay_payment_id, razorpay_order_id, razorpay_signature });
                    return res.status(400).json({
                        success: false,
                        message: 'Payment information missing'
                    });
                }
                order.paymentDetails = {
                    razorpay_payment_id,
                    razorpay_order_id,
                    razorpay_signature
                };
            }

            
            await order.save();

            // Update product quantitie
            if (paymentMethod === 'COD') {
                const updatePromises = cart.items.map(async (item) => {
                    return Product.findByIdAndUpdate(
                        item.productId._id,
                        { $inc: { available_quantity: -item.quantity } },
                        { new: true }
                    );
                });

                try {
                    const updatedProducts = await Promise.all(updatePromises);
                    
                } catch (error) {
                    console.error('Error updating product quantities:', error);
                    
                }
            }
            
            if (paymentMethod === 'COD') {
                await Cart.findOneAndUpdate(
                    { userId: req.session.user },
                    { $set: { items: [] } }
                );
            }

            // If there was a coupon used, record it
            if (couponCode) {
                await CouponUsage.create({
                    userId: req.session.user,
                    couponCode: couponCode.toUpperCase(),
                    usedAt: new Date()
                });
                // Clear the applied coupon
                delete req.session.appliedCoupon;
            }

            res.json({
                success: true,
                orderId: order._id,
                message: 'Order placed successfully'
            });

        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to place order'
            });
        }
    },

    handlePaymentFailure: async (req, res) => {
        try {
            const {
                addressId,
                paymentMethod,
                couponCode,
                totalPrice,
                finalAmount,
                razorpay_payment_id,
                razorpay_order_id,
                error_description
            } = req.body;
        
            // Get cart items
            const cart = await Cart.findOne({ userId: req.session.user })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category_id',
                        select: 'name offerPercentage offerEndDate'
                    }
                });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

           
            const orderItems = cart.items.map(item => {
                const product = item.productId;
                const now = new Date();
                const category = product.category_id;

                
                const productOffer = product.offerPercentage || 0;
                const categoryOffer = category?.offerPercentage || 0;

              
                const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
                const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;

                
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

               
                let currentPrice = product.Sale_price;
                let discount = 0;
                if (bestOffer > 0) {
                    discount = Math.round((product.Sale_price * bestOffer) / 100);
                    currentPrice = Math.round(product.Sale_price - discount);
                }

                return {
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: currentPrice,
                    totalPrice: currentPrice * item.quantity,
                    discount: discount
                };
            });

           
            const userAddress = await Address.findOne({
                userId: req.session.user,
                'address._id': addressId
            });

            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid address selected'
                });
            }

            const selectedAddress = userAddress.address.find(addr => addr._id.toString() === addressId);

            // Calculate total discount
            const itemsDiscount = orderItems.reduce((total, item) => total + (item.discount * item.quantity), 0);
            const couponDiscount = req.session.appliedCoupon ? req.session.appliedCoupon.discount : 0;
            const totalDiscount = itemsDiscount + couponDiscount;

            
            const order = new Order({
                userId: req.session.user,
                orderedItems: orderItems,
                address: selectedAddress,
                paymentMethod: 'online',
                totalPrice: totalPrice,
                discount: totalDiscount,
                finalAmount: finalAmount,
                paymentStatus: 'Pending',
                status: 'Pending',
                couponCode: couponCode || null,
                couponDiscount: couponDiscount,
                paymentDetails: {
                    razorpay_payment_id,
                    razorpay_order_id,
                    error_description
                }
            });

            
            await order.save();

            

            res.json({
                success: true,
                orderId: order._id,
                message: 'Order marked as failed'
            });

        } catch (error) {
            console.error('Error handling payment failure:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to handle payment failure'
            });
        }
    }

};

module.exports = checkoutController;
