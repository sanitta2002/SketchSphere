const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const mongoose = require('mongoose');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema')

const orderController = {
    // View all orders
    viewOrders: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            console.log('Loading orders for user:', req.session.user);
            const userId = new mongoose.Types.ObjectId(req.session.user);
            console.log('Converted user ID to ObjectId:', userId.toString());

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

    // View single order details
    viewOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            console.log('Loading order details for:', orderId);

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

            console.log('Found order:', {
                id: order._id,
                items: order.orderedItems.length,
                total: order.finalAmount
            });

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
            console.log('Loading order success page for:', orderId);

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

            console.log('Found order for success page:', {
                id: order._id,
                items: order.orderedItems.length,
                total: order.finalAmount
            });

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

    // Cancel order
    cancelOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            console.log('Cancelling order:', orderId);

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Update order status
            order.status = 'Cancelled';
            order.orderedItems.forEach(item => {
                item.status = 'Cancelled';
            });

            await order.save();
            console.log('Order cancelled successfully:', orderId);

            res.json({
                success: true,
                message: 'Order cancelled successfully'
            });
        } catch (error) {
            console.error('Error cancelling order:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel order'
            });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressId, paymentMethod } = req.body;
            console.log('this is payment method',paymentMethod)

            // Validate address
            const address = await Address.findById(addressId);
            if (!address) {
                return res.status(400).json({ success: false, message: 'Invalid address' });
            }

            // Get cart items
            const cart = await Cart.findOne({ userId: userId }).populate('items.product');
            if (!cart || !cart.items.length) {
                return res.status(400).json({ success: false, message: 'Cart is empty' });
            }

            // Create order items array
            const orderedItems = cart.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.Sale_price
            }));

            // Calculate total amount
            const totalAmount = cart.items.reduce((total, item) => {
                return total + (item.product.Sale_price * item.quantity);
            }, 0);

            // Create new order
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

            // Get order with populated fields
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

            // Check if the order belongs to the logged-in user
            if (order.userId.toString() !== userId) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            // Send the order details
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

            const order = await Order.findById(orderId)
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img description price Sale_price category_id language brand',
                    populate: {
                        path: 'category_id',
                        select: 'name'
                    }
                });

            if (!order) {
                return res.status(404).render('error', { message: 'Order not found' });
            }

            if (order.userId.toString() !== userId) {
                return res.status(403).render('error', { message: 'Unauthorized access' });
            }

            const orderItem = order.orderedItems.find(item => item._id.toString() === itemId);
            if (!orderItem) {
                return res.status(404).render('error', { message: 'Order item not found' });
            }

            res.render('view-item', {
                orderItem,
                order,
                user: req.session.user
            });

        } catch (error) {
            console.error('Error viewing order item:', error);
            res.status(500).render('error', { message: 'Failed to load order item details' });
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
            });

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Find the specific item
            const orderItem = order.orderedItems.id(itemId);
            if (!orderItem) {
                return res.status(404).json({ success: false, message: 'Order item not found' });
            }

            // Handle inventory for cancellations
            if (status === 'Cancelled' && orderItem.status !== 'Cancelled') {
                await Product.findByIdAndUpdate(
                    orderItem.product,
                    { $inc: { available_quantity: orderItem.quantity } }
                );
            }

            // Update the item status
            orderItem.status = status;
            
            // Add return reason if provided
            if (status === 'Return' && returnReason) {
                orderItem.returnReason = returnReason;
            }

            // Check if all items have the same status
            const allSameStatus = order.orderedItems.every(item => item.status === status);
            if (allSameStatus) {
                order.status = status;
            } else {
                // If items have different statuses, set a composite status
                const hasDelivered = order.orderedItems.some(item => item.status === 'Delivered');
                const hasCancelled = order.orderedItems.some(item => item.status === 'Cancelled');
                const hasReturned = order.orderedItems.some(item => item.status === 'Returned');
                const hasShipped = order.orderedItems.some(item => item.status === 'Shipped');
                const hasProcessing = order.orderedItems.some(item => item.status === 'Processing');

                if (hasDelivered && (hasCancelled || hasReturned)) {
                    order.status = 'Partially Delivered';
                } else if (hasShipped) {
                    order.status = 'Partially Shipped';
                } else if (hasProcessing) {
                    order.status = 'Processing';
                } else {
                    order.status = 'Pending';
                }
            }

            await order.save();

            res.json({ 
                success: true, 
                message: status === 'Cancelled' ? 'Order has been cancelled successfully' : 'Return request has been submitted successfully',
                orderStatus: order.status 
            });

        } catch (error) {
            console.error('Error updating order item status:', error);
            res.status(500).json({ success: false, message: 'Failed to update status' });
        }
    },

    // Function to generate order ID
    generateOrderId: function() {
        return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    }
};

module.exports = orderController;
