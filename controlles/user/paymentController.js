const Razorpay = require('razorpay');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const paymentController = {
    createOrder: async (req, res) => {
        try {
            const { finalAmount } = req.body;
            console.log('Creating Razorpay order for amount:', finalAmount);

            if (!finalAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Amount is required'
                });
            }

            // Get cart items and check stock
            const cart = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
            if (!cart || !cart.items.length) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cart is empty' 
                });
            }

            // Check stock availability for all products
            for (const item of cart.items) {
                const availableStock = item.productId.available_quantity || 0;
                if (availableStock < item.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Insufficient stock for product: ${item.productId.name}. Available: ${availableStock}`
                    });
                }
            }

            const options = {
                amount: Math.round(finalAmount * 100), // Convert to paise
                currency: 'INR',
                receipt: 'order_' + Date.now()
            };

            console.log('Creating Razorpay order with options:', options);
            const order = await razorpay.orders.create(options);
            console.log('Razorpay order created:', order);

            res.json({
                success: true,
                key_id: process.env.RAZORPAY_KEY_ID,
                order: order
            });
        } catch (error) {
            console.error('Error creating Razorpay order:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create order'
            });
        }
    },

    processWalletPayment: async (req, res) => {
        try {
            const userId = req.session.user;
            const { finalAmount, orderId } = req.body;

            // Find user's wallet
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                return res.status(400).json({
                    success: false,
                    message: 'Wallet not found'
                });
            }

            // Check if wallet has sufficient balance
            if (wallet.balance < finalAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Find the order
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Deduct amount from wallet
            wallet.balance -= finalAmount;
            wallet.transactions.push({
                type: 'debit',
                amount: finalAmount,
                description: `Payment for order #${order._id}`,
                orderId: order._id
            });
            await wallet.save();

            // Update order status
            order.paymentStatus = 'Completed';
            order.status = 'Processing';
            await order.save();

            // Clear  cart
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            // Update product quantities
            for (const item of order.orderedItems) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { available_quantity: -item.quantity } }
                );
            }

            res.json({
                success: true,
                message: 'Payment processed successfully',
                orderId: order._id
            });
        } catch (error) {
            console.error('Error processing wallet payment:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to process wallet payment'
            });
        }
    },

    verifyPayment: async (req, res) => {
        try {
            console.log('Starting payment verification with data:', {
                ...req.body,
                razorpay_signature: '***' // Hide signature in logs
            });

            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                order_id
            } = req.body;

            // Validate required fields
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
                console.error('Missing payment verification details');
                return res.status(400).json({
                    success: false,
                    message: 'Missing payment verification details'
                });
            }

            // Verify signature
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature !== expectedSign) {
                console.error('Invalid signature');
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }

            // Find the order
            const order = await Order.findById(order_id);
            if (!order) {
                console.error('Order not found:', order_id);
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Update order status and payment details
            order.paymentStatus = 'Completed';
            order.status = 'Processing';
            order.paymentDetails = {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            };
            await order.save();
            console.log('Order updated with payment details:', order._id);

            // clear cart
            const cartResult = await Cart.findOneAndUpdate(
                { userId: req.session.user },
                { $set: { items: [] } },
                { new: true }
            );
            

            // Update product quantitie
            const updatePromises = order.orderedItems.map(async (item) => {
                
                return Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { available_quantity: -item.quantity } },
                    { new: true }
                );
            });
    
            try {
                const updatedProducts = await Promise.all(updatePromises);
                
            } catch (error) {
                console.error('Error updating product quantities:', error);
                
            }

            res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to verify payment'
            });
        }
    }
};

module.exports = paymentController;
