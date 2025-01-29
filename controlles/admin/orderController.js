const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema'); // Assuming Wallet model is defined in walletSchema.js

const orderController = {
    // Get all orders for admin
    getAllOrders: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10; // Items per page
            const skip = (page - 1) * limit;

            // Get search and filter parameters
            const searchQuery = req.query.search || '';
            const status = req.query.status || '';

            // Build filter query
            let query = {};
            
            if (searchQuery) {
                query.$or = [
                    { '_id': { $regex: searchQuery, $options: 'i' } },
                    { 'userId.name': { $regex: searchQuery, $options: 'i' } },
                    { 'userId.email': { $regex: searchQuery, $options: 'i' } }
                ];
            }

            if (status) {
                query['orderedItems.status'] = status;
            }

            // Get total count for pagination
            const totalOrders = await Order.countDocuments(query);
            const totalPages = Math.ceil(totalOrders / limit);

            // Calculate pagination values
            const hasPreviousPage = page > 1;
            const hasNextPage = page < totalPages;
            const previousPage = hasPreviousPage ? page - 1 : null;
            const nextPage = hasNextPage ? page + 1 : null;

            // Fetch orders with pagination and filters
            const orders = await Order.find(query)
                .populate({
                    path: 'userId',
                    select: 'name email'
                })
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img Sale_price'
                })
                .sort({ createdOn: -1 })
                .skip(skip)
                .limit(limit);

            res.render('order', {
                orders,
                currentPage: page,
                totalPages,
                hasPreviousPage,
                hasNextPage,
                previousPage,
                nextPage,
                searchQuery,
                status,
                pageTitle: 'All Orders',
                admin: req.session.admin
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).render('error', { message: 'Failed to fetch orders' });
        }
    },

    // View single order details
    getOrderDetails: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const order = await Order.findById(orderId)
                .populate({
                    path: 'userId',
                    select: 'name email'
                })
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img Sale_price category_id'
                })
                .populate('address');

            if (!order) {
                return res.status(404).render('error', { message: 'Order not found' });
            }

            res.render('order-details', {
                order,
                admin: req.session.admin,
                pageTitle: 'Order Details'
            });
        } catch (error) {
            console.error('Error fetching order details:', error);
            res.status(500).render('error', { message: 'Failed to fetch order details' });
        }
    },

    // Update single item status
    updateItemStatus: async (req, res) => {
        try {
            const { orderId, itemId } = req.params;
            const { status, rejectReason } = req.body;

            console.log('Updating order status:', { orderId, itemId, status, rejectReason });

            // Find the order
            const order = await Order.findById(orderId)
                .populate('orderedItems.product')
                .populate('userId');
                
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Update the order's main status
            order.status = status;
            
            // Find the specific item
            const orderItem = order.orderedItems.id(itemId);
            if (!orderItem) {
                return res.status(404).json({ success: false, message: 'Order item not found' });
            }

            const previousStatus = orderItem.status;
            // Update the item status
            orderItem.status = status;
            if (rejectReason) {
                orderItem.rejectReason = rejectReason;
            }

            // Handle return approval or cancellation
            if ((status === 'Returned' && previousStatus !== 'Returned') || 
                (status === 'Cancelled' && previousStatus !== 'Cancelled')) {
                
                // Find the product
                const product = await Product.findById(orderItem.product);
                if (!product) {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }

                // Increase product quantity
                const updateResult = await Product.findByIdAndUpdate(
                    orderItem.product,
                    { $inc: { available_quantity: orderItem.quantity } },
                    { new: true }
                );

                console.log('Product quantity updated:', {
                    productId: orderItem.product._id,
                    quantityRestored: orderItem.quantity,
                    newQuantity: updateResult.available_quantity,
                    reason: status
                });

                // Process refund for both online and COD payments when returning
                if (status === 'Returned') {
                    const refundAmount = orderItem.price * orderItem.quantity;

                    // Add refund to wallet
                    const wallet = await Wallet.findOne({ userId: order.userId });
                    if (!wallet) {
                        const newWallet = new Wallet({
                            userId: order.userId,
                            balance: refundAmount,
                            transactions: [{
                                type: 'credit',
                                amount: refundAmount,
                                description: `Refund for ${status.toLowerCase()} item in order #${order._id}`,
                                orderId: order._id,
                                date: new Date()
                            }]
                        });
                        await newWallet.save();
                    } else {
                        await Wallet.findOneAndUpdate(
                            { userId: order.userId },
                            {
                                $inc: { balance: refundAmount },
                                $push: {
                                    transactions: {
                                        type: 'credit',
                                        amount: refundAmount,
                                        description: `Refund for ${status.toLowerCase()} item in order #${order._id}`,
                                        orderId: order._id,
                                        date: new Date()
                                    }
                                }
                            }
                        );
                    }

                    console.log('Refund processed:', {
                        userId: order.userId,
                        amount: refundAmount,
                        reason: status,
                        orderId: order._id,
                        paymentMethod: order.paymentMethod
                    });
                }
                // For cancellations, only process refund for online payments
                else if (status === 'Cancelled' && order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
                    const refundAmount = orderItem.price * orderItem.quantity;

                    // Add refund to wallet
                    const wallet = await Wallet.findOne({ userId: order.userId });
                    if (!wallet) {
                        const newWallet = new Wallet({
                            userId: order.userId,
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
                    } else {
                        await Wallet.findOneAndUpdate(
                            { userId: order.userId },
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
                    }

                    console.log('Cancellation refund processed:', {
                        userId: order.userId,
                        amount: refundAmount,
                        orderId: order._id,
                        paymentMethod: order.paymentMethod
                    });
                }
            }

            // Save the updated order
            await order.save();

            console.log('Order status updated successfully:', {
                orderId: order._id,
                status: order.status,
                itemStatus: orderItem.status
            });

            res.json({
                success: true,
                message: 'Order status updated successfully',
                status: status
            });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update order status'
            });
        }
    },
};

module.exports = orderController;
