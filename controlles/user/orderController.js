const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const mongoose = require('mongoose');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const Razorpay = require('razorpay');
const HttpStatus = require('../../utils/httpStatus');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const orderController = {
    // View all orders
    viewOrders: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            
            const userId = new mongoose.Types.ObjectId(req.session.user);
            

            const orders = await Order.find({ userId: userId })
                .populate({
                    path: 'orderedItems.product',
                    model: 'Product',
                    select: 'name product_img Sale_price'
                })
                .sort({ createdOn: -1 });

            console.log('Found orders:', orders.map(order => ({
                id: order._id,
                items: order.orderedItems.length,
                total: order.finalAmount
            })));

            res.render('orders', {
                orders,
                user: req.session.user,
                pageTitle: 'My Orders'
            });
        } catch (error) {
            console.error('Error viewing orders:', error);
            res.status(500).render('error', {
                error: 'Failed to load orders'
            });
        }
    },

    //  single order details
    viewOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            

            const order = await Order.findById(orderId)
                .populate({
                    path: 'orderedItems.product',
                    model: 'Product',
                    select: 'name product_img Sale_price'
                });

            if (!order) {
                console.log('Order not found:', orderId);
                return res.status(404).render('error', {
                    error: 'Order not found'
                });
            }

            

            res.render('orderDetails', {
                order,
                user: req.session.user,
                pageTitle: 'Order Details'
            });
        } catch (error) {
            console.error('Error viewing order details:', error);
            res.status(500).render('error', {
                error: 'Failed to load order details'
            });
        }
    },

    // Order success page
    orderSuccess: async (req, res) => {
        try {
            const orderId = req.query.orderId;
            

            const order = await Order.findById(orderId)
                .populate({
                    path: 'orderedItems.product',
                    model: 'Product',
                    select: 'name product_img Sale_price'
                });

            if (!order) {
                
                return res.status(404).render('error', {
                    error: 'Order not found'
                });
            }

            

            res.render('orderSuccess', {
                order,
                user: req.session.user,
                pageTitle: 'Order Successful'
            });
        } catch (error) {
            console.error('Error loading order success page:', error);
            res.status(500).render('error', {
                error: 'Failed to load order success page'
            });
        }
    },

    cancelOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

          

            // the order to cancel
            const order = await Order.findOne({
                _id: orderId,
                userId,
                status: { $nin: ['Cancelled', 'Delivered', 'Returned'] }
            }).populate('orderedItems.product');

            

            if (!order) {
                console.log('Order not found or not cancellable. Query params:', {
                    orderId,
                    userId,
                });
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: 'Order not found or cannot be cancelled'
                });
            }

            //  COD orders
            if (order.paymentMethod === 'COD') {
                order.status = 'Cancelled';
                await order.save();

                // Restore product quantitie
                for (const item of order.orderedItems) {
                    await Product.findByIdAndUpdate(item.product._id, {
                        $inc: { available_quantity: item.quantity }
                    });
                }

                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Order cancelled successfully.'
                });
            }

            // Handle wallet refund
            if (order.paymentMethod === 'wallet' && order.paymentStatus === 'Completed') {
                try {
                    console.log('Processing refund for wallet order:', order._id);
                    
                    // Add refund to wallet
                    let wallet = await Wallet.findOne({ userId }); 
                    const numberOfItems = order.orderedItems.length;
                    const couponAmount = order.couponAmount;
                    const couponDiscount = couponAmount/numberOfItems
                    console.log("couponDiscount",couponDiscount)
                    const refundAmount = order.finalAmount - couponDiscount;

                    if (!wallet) {
                        wallet = new Wallet({
                            userId,
                            balance: refundAmount,
                            transactions: [{
                                type: 'credit',
                                amount: refundAmount,
                                description: `Refund for cancelled order #${order._id}`,
                                orderId: order._id,
                                date: new Date()
                            }]
                        });
                    } else {
                        wallet.balance += refundAmount;
                        wallet.transactions.push({
                            type: 'credit',
                            amount: refundAmount,
                            description: `Refund for cancelled order #${order._id}`,
                            orderId: order._id,
                            date: new Date()
                        });
                    }
                    await wallet.save();
                    console.log('Refunded to wallet:', refundAmount);

                    
                    order.status = 'Cancelled';
                    order.paymentStatus = 'Refunded';
                    await order.save();

                    // Restore product quantitie
                    for (const item of order.orderedItems) {
                        await Product.findByIdAndUpdate(item.product._id, {
                            $inc: { available_quantity: item.quantity }
                        });
                    }

                    return res.status(HttpStatus.OK).json({
                        success: true,
                        message: 'Order cancelled and amount refunded to wallet successfully.'
                    });
                } catch (error) {
                    console.error('Error processing wallet refund:', error);
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                        success: false,
                        message: 'Failed to process refund'
                    });
                }
            }

            // Handle Razorpay refund
            if (order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
                try {
                    console.log('Processing refund for online order:', order._id);
                    
                    
                    let wallet = await Wallet.findOne({ userId }); 
                    const numberOfItems = order.orderedItems.length;
                    const couponAmount = order.couponAmount;
                    const couponDiscount = couponAmount/numberOfItems
                    const refundAmount = order.finalAmount - couponDiscount; // Include offer discount in refund
                    console.log(
                         refundAmount);
                    if (!wallet) {
                        wallet = new Wallet({
                            userId,
                            balance: refundAmount,
                            transactions: [{
                                type: 'credit',
                                amount: refundAmount,
                                description: `Refund for cancelled order #${order._id}`,
                                orderId: order._id,
                                date: new Date()
                            }]
                        });
                        await wallet.save();
                        console.log('Created new wallet with refund:', wallet);
                    } else {
                        wallet = await Wallet.findOneAndUpdate(
                            { userId },
                            {
                                $inc: { balance: refundAmount },
                                $push: {
                                    transactions: {
                                        type: 'credit',
                                        amount: refundAmount,
                                        description: `Refund for cancelled order #${order._id}`,
                                        orderId: order._id,
                                        date: new Date()
                                    }
                                }
                            },
                            { new: true }
                        );
                        console.log('Updated existing wallet with refund:', wallet);
                    }

                    // Then initiate Razorpay refund
                    if (order.paymentDetails?.razorpay_payment_id) {
                        try {
                            console.log('Initiating refund for payment:', order.paymentDetails.razorpay_payment_id);
                            const refund = await razorpay.payments.refund(order.paymentDetails.razorpay_payment_id, {
                                amount: Math.round(order.finalAmount * 100), // Convert to paise
                                speed: 'normal'
                            });
                            console.log('Razorpay refund response:', refund);

                            // Update order refund status
                            order.paymentStatus = 'Refunded';
                            order.refundDetails = {
                                refundId: refund.id,
                                amount: order.finalAmount,
                                status: 'Completed',
                                processedAt: new Date()
                            };
                        } catch (refundError) {
                            console.error('Error with Razorpay refund:', refundError);
                            
                            order.paymentStatus = 'Refunded';
                            order.refundDetails = {
                                amount: order.finalAmount,
                                status: 'Completed',
                                processedAt: new Date(),
                                note: 'Refunded to wallet'
                            };
                        }
                    }

                   
                    order.status = 'Cancelled';
                    await order.save();

                    // Restore product quantitie
                    for (const item of order.orderedItems) {
                        const updateResult = await Product.findByIdAndUpdate(
                            item.product._id,
                            { $inc: { available_quantity: item.quantity } },
                            { new: true }
                        );
                        console.log('Product quantity updated:', {
                            productId: item.product._id,
                            quantityRestored: item.quantity,
                            newQuantity: updateResult.available_quantity
                        });
                    }

                    console.log('Order cancellation and refund completed successfully');
                    res.status(HttpStatus.OK).json({
                        success: true,
                        message: 'Order cancelled successfully. Refund has been added to your wallet.',
                        refundAmount: order.finalAmount
                    });
                } catch (error) {
                    console.error('Error processing refund:', error);
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                        success: false,
                        message: 'Failed to process refund. Please contact support.'
                    });
                }
            } else {
                
                order.status = 'Cancelled';
                await order.save();

               
                for (const item of order.orderedItems) {
                    await Product.findByIdAndUpdate(item.product._id, {
                        $inc: { available_quantity: item.quantity }
                    });
                }

                res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Order cancelled successfully.'
                });
            }
        } catch (error) {
            console.error('Error in cancelOrder:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to cancel order. Please try again later.'
            });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressId, paymentMethod, couponCode } = req.body;
            console.log('this is payment method',paymentMethod)

            // Validate address
            const address = await Address.findById(addressId);
            if (!address) {
                return res.status(400).json({ success: false, message: 'Invalid address' });
            }

           
            const cart = await Cart.findOne({ userId: userId }).populate('items.product');
            if (!cart || !cart.items.length) {
                return res.status(400).json({ success: false, message: 'Cart is empty' });
            }

            // Check stock availability for all products
            for (const item of cart.items) {
                if (!item.product.stock || item.product.stock < item.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Insufficient stock for product: ${item.product.name}. Available: ${item.product.stock || 0}`
                    });
                }
            }

            // Create order items array
            const orderedItems = cart.items.map(item => {
                
                let effectivePrice = item.product.Sale_price;
                if (item.product.offerPrice > 0 && 
                    item.product.offerStartDate <= new Date() && 
                    item.product.offerEndDate >= new Date()) {
                    effectivePrice = item.product.offerPrice;
                }
                
                return {
                    product: item.product._id,
                    quantity: item.quantity,
                    price: effectivePrice
                };
            });

            // Calculate total amount using the effective prices
            const totalAmount = orderedItems.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);

            
            const newOrder = new Order({
                userId: userId,
                orderId: generateOrderId(),
                orderedItems: orderedItems,
                address: addressId,
                totalPrice: totalAmount,
                finalAmount: totalAmount,
                paymentMethod: paymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
                status: 'Processing'
            });

            await newOrder.save();

            // Update product stock quantitie
            for (const item of cart.items) {
                await Product.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear cart after order
            await Cart.findOneAndUpdate(
                { userId: userId },
                { $set: { items: [] } }
            );

            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: newOrder._id
            });

        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({ success: false, message: 'Failed to place order' });
        }
    },

    getOrderDetails: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            
            const order = await Order.findById(orderId)
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img description price Sale_price category_id language brand',
                    populate: {
                        path: 'category_id',
                        select: 'name'
                    }
                })
                .populate('address');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

    
            if (order.userId.toString() !== userId) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            // Send the order detail
            res.json(order);

        } catch (error) {
            console.error('Error getting order details:', error);
            res.status(500).json({ success: false, message: 'Failed to get order details' });
        }
    },

    viewOrderItemDetails: async (req, res) => {
        try {
            const { orderId, itemId } = req.query;
            const userId = req.session.user;

           
            const order = await Order.findOne({ 
                _id: orderId,
                userId 
            }).populate({
                path: 'orderedItems.product',
                select: 'name product_img description price Sale_price category_id language brand',
                populate: {
                    path: 'category_id',
                    select: 'name'
                }
            });

            if (!order) {
                return res.redirect('/pageNotFound');
            }

            // Find specific order item
            const orderItem = order.orderedItems.find(item => 
                item._id.toString() === itemId
            );

            if (!orderItem) {
                return res.redirect('/pageNotFound');
            }

            res.render('view-item', {
                orderItem,
                order,  
                pageTitle: 'Order Item Details',
                user:req.session.user
            });
        } catch (error) {
            console.error('Error in viewOrderItemDetails:', error);
            res.redirect('/pageNotFound');
        }
    },

    updateOrderItemStatus: async (req, res) => {
        try {
            const { orderId, itemId } = req.params;
            const { status, returnReason } = req.body;
            const userId = req.session.user;

            // Find the order
            const order = await Order.findOne({ 
                _id: orderId,
                userId: userId
            }).populate('orderedItems.product');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Find the specific item
            const orderItem = order.orderedItems.id(itemId);
            console.log(`orderItem:`, orderItem);
            if (!orderItem) {
                return res.status(404).json({ success: false, message: 'Order item not found' });
            }

            let refundAmount = 0;

            // Handle return request
            if (returnReason) {
                if (!orderItem.returnReason) {  
                    orderItem.returnReason = returnReason;
                    orderItem.status = 'Delivered';  
                }
            } else {
                // Handle other status updates
                if (status === 'Cancelled' && orderItem.status !== 'Cancelled') {
                    // Calculate refund amount for this item
                    const numberOfItems = order.orderedItems.length;
                    const couponAmount = order.couponAmount;
                    const couponDiscount = couponAmount/numberOfItems
                    refundAmount = orderItem.price * orderItem.quantity - couponDiscount;

                    // Handle refund based on payment method
                    if ((order.paymentMethod === 'online' || order.paymentMethod === 'wallet') && order.paymentStatus === 'Completed') {
                        
                        const wallet = await Wallet.findOne({ userId });
                        if (!wallet) {
                            const newWallet = new Wallet({
                                userId,
                                balance: refundAmount,
                                transactions: [{
                                    type: 'credit',
                                    amount: refundAmount,
                                    description: `Refund for cancelled item in order #${order._id}`,
                                    orderId: order._id,
                                    date: new Date()
                                }]
                            });
                            await newWallet.save();
                            console.log('Created new wallet with refund:', {
                                userId,
                                refundAmount,
                                orderId: order._id
                            });
                        } else {
                            await Wallet.findOneAndUpdate(
                                { userId },
                                {
                                    $inc: { balance: refundAmount },
                                    $push: {
                                        transactions: {
                                            type: 'credit',
                                            amount: refundAmount,
                                            description: `Refund for cancelled item in order #${order._id}`,
                                            orderId: order._id,
                                            date: new Date()
                                        }
                                    }
                                }
                            );
                            console.log('Added refund to existing wallet:', {
                                userId,
                                refundAmount,
                                orderId: order._id
                            });
                        }
                    }

                    // Restore product quantity
                    const updateResult = await Product.findByIdAndUpdate(
                        orderItem.product._id,
                        { $inc: { available_quantity: orderItem.quantity } },
                        { new: true }
                    );
                    console.log('Product quantity updated:', {
                        productId: orderItem.product._id,
                        quantityRestored: orderItem.quantity,
                        newQuantity: updateResult.available_quantity
                    });
                }
                orderItem.status = status;
            }

            // Update order status based on item statuses
            const allItemStatuses = order.orderedItems.map(item => item.status);
            if (allItemStatuses.every(s => s === 'Cancelled')) {
                order.status = 'Cancelled';
            } else if (allItemStatuses.every(s => s === 'Delivered')) {
                order.status = 'Delivered';
            } else if (allItemStatuses.some(s => s === 'Processing')) {
                order.status = 'Processing';
            } else if (allItemStatuses.some(s => s === 'Shipped')) {
                order.status = 'Shipped';
            } else {
                
                order.status = 'Processing';
            }

            await order.save();

            // Only include refundAmount in response for online payments
            const response = {
                success: true,
                message: returnReason ? 
                    'Return request has been submitted successfully' : 
                    'Status updated successfully',
                orderStatus: order.status,
                itemStatus: orderItem.status
            };

            // Add refundAmount only for online payments
            if ((order.paymentMethod === 'online' || order.paymentMethod === 'wallet') && refundAmount > 0) {
                response.refundAmount = refundAmount;
            }

            res.json(response);

        } catch (error) {
            console.error('Error updating item status:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Failed to update status' 
            });
        }
    },

    getOrderStatus: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            const order = await Order.findOne({
                _id: orderId,
                userId
            });

            if (!order) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            res.json({
                success: true,
                status: order.status,
                paymentStatus: order.paymentStatus
            });
        } catch (error) {
            console.error('Error getting order status:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to get order status'
            });
        }
    },

    // Function to generate order ID
    generateOrderId: function() {
        return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    }
};

module.exports = orderController;
