const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const Product = require('../../models/productSchema')

const orderController = {
    // Get all orders for admin
    getAllOrders: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 7;
            const skip = (page - 1) * limit;

            const totalOrders = await Order.countDocuments();
            const totalPages = Math.ceil(totalOrders / limit);

            const orders = await Order.find()
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
    updateOrderItemStatus: async (req, res) => {
        try {
            const { orderId, itemId } = req.params;
            const { status } = req.body;

            const order = await Order.findById(orderId);
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

            // Determine the overall order status based on item statuses
            const statuses = order.orderedItems.map(item => item.status);
            const uniqueStatuses = [...new Set(statuses)];

            // Set order status based on item statuses
            if (uniqueStatuses.length === 1) {
                // If all items have the same status, use that
                order.status = uniqueStatuses[0];
            } else {
                // If items have mixed statuses, use appropriate status
                if (statuses.every(s => ['Cancelled', 'Returned'].includes(s))) {
                    order.status = 'Cancelled';
                } else if (statuses.some(s => s === 'Processing')) {
                    order.status = 'Processing';
                } else if (statuses.some(s => s === 'Shipped')) {
                    order.status = 'Shipped';
                } else if (statuses.some(s => s === 'Delivered')) {
                    order.status = 'Delivered';
                } else {
                    order.status = 'Pending';
                }
            }

            await order.save();

            res.json({ 
                success: true, 
                message: 'Item status updated successfully',
                orderStatus: order.status,
                itemStatus: orderItem.status
            });

        } catch (error) {
            console.error('Error updating item status:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to update status' });
        }
    }
};

module.exports = orderController;
