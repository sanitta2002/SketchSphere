const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const CouponUsage = require('../../models/couponUsageSchema');
const mongoose = require('mongoose');

const checkoutController = {
    loadCheckout: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const cart = await Cart.findOne({ userId: req.session.user })
                .populate('items.productId', 'name product_img Sale_price');

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            const totalPrice = cart.items.reduce((total, item) => {
                return total + (item.quantity * item.productId.Sale_price);
            }, 0);

            const userAddress = await Address.findOne({ userId: req.session.user });
            const addresses = userAddress ? userAddress.address : [];

            // Get used coupons from CouponUsage
            const usedCoupons = await CouponUsage.distinct('couponCode', { 
                userId: req.session.user 
            });

            // Get all active coupons
            const allActiveCoupons = await Coupon.find({
                isList: true,
                expireOn: { $gt: new Date() },
                minimumPrice: { $lte: totalPrice }
            });

            // Filter out used coupons
            const activeCoupons = allActiveCoupons.filter(coupon => 
                !usedCoupons.includes(coupon.name.toUpperCase())
            );

            res.render('checkout', {
                cart,
                addresses,
                totalPrice,
                activeCoupons,
                pageTitle: 'Checkout'
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
            // Remove the applied coupon from session
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
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login first' });
            }

            const { addressId, paymentMethod, finalAmount } = req.body;

            const address = await Address.findOne({ userId: req.session.user });
            if (!address) {
                return res.status(400).json({ success: false, message: 'No address found' });
            }

            const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
            if (!selectedAddress) {
                return res.status(400).json({ success: false, message: 'Selected address not found' });
            }

            const cart = await Cart.findOne({ userId: req.session.user })
                .populate('items.productId');

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({ success: false, message: 'Cart is empty' });
            }

            const orderedItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.Sale_price
            }));

            const totalPrice = orderedItems.reduce((total, item) => {
                return total + (item.quantity * item.price);
            }, 0);

            let discountAmount = 0;
            let appliedCoupon = null;
            if (req.session.appliedCoupon) {
                const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
                if (coupon && totalPrice >= coupon.minimumPrice) {
                    discountAmount = Math.min(coupon.offerPrice, totalPrice);
                    appliedCoupon = req.session.appliedCoupon.code;

                    // Record coupon usage
                    await new CouponUsage({
                        userId: req.session.user,
                        couponCode: appliedCoupon
                    }).save();
                }
            }

            const userId = new mongoose.Types.ObjectId(req.session.user);

            // Update product quantities
            for (const item of cart.items) {
                const product = item.productId;
                const newQuantity = product.available_quantity - item.quantity;
                
                if (newQuantity < 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock available for ${product.name}`
                    });
                }
                
                await mongoose.model('Product').findByIdAndUpdate(
                    product._id,
                    { $set: { available_quantity: newQuantity } }
                );
            }

            const order = new Order({
                userId,
                orderedItems,
                totalPrice,
                discountAmount,
                finalAmount: finalAmount || (totalPrice - discountAmount),
                couponCode: appliedCoupon,
                address: {
                    addressType: selectedAddress.addressType,
                    name: selectedAddress.name,
                    city: selectedAddress.city,
                    landMark: selectedAddress.landMark,
                    state: selectedAddress.state,
                    pincode: selectedAddress.pincode,
                    phone: selectedAddress.phone
                },
                status: 'Pending',
                createdOn: new Date(),
                paymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Processing'
            });

            const savedOrder = await order.save();
            if (!savedOrder) {
                throw new Error('Failed to save order');
            }

            cart.items = [];
            await cart.save();

            // Clear the applied coupon from session
            delete req.session.appliedCoupon;

            res.json({
                success: true,
                message: 'Order placed successfully',
                redirectUrl: '/orders'
            });

        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({ success: false, message: 'Failed to place order' });
        }
    }
};

module.exports = checkoutController;
