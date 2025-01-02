const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');

const orderController = {
    // Get all orders for admin
    getAllOrders: async (req, res) => {
        try {
            const orders = await Order.find()
                .populate({
                    path: 'userId',
                    select: 'name email'
                })
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img Sale_price'
                })
                .sort({ createdOn: -1 });

            res.render('orders', {
                orders,
                pageTitle: 'All Orders',
                admin: req.session.admin
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).render('pageerror', { error: 'Failed to fetch orders' });
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
                    select: 'name product_img Sale_price'
                });

            if (!order) {
                return res.status(404).render('pageerror', { error: 'Order not found' });
            }

            res.render('orderDetail', {
                order,
                pageTitle: 'Order Details',
                admin: req.session.admin
            });
        } catch (error) {
            console.error('Error fetching order details:', error);
            res.status(500).render('pageerror', { error: 'Failed to fetch order details' });
        }
    },

    // Update order status
    updateOrderStatus: async (req, res) => {
        try {
            const { orderId, status } = req.body;
            
            const order = await Order.findByIdAndUpdate(
                orderId,
                { $set: { status: status } },
                { new: true }
            );

            if (!order) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Order not found' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Order status updated successfully',
                newStatus: status
            });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update order status' 
            });
        }
    }
};

module.exports = orderController;
