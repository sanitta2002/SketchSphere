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
    updateItemStatus: async (req, res) => {
        try {
            const { orderId, itemId } = req.params;
            const { status, rejectReason } = req.body;

            console.log('Updating order status:', { orderId, itemId, status, rejectReason });

            // Find the order
            const order = await Order.findById(orderId).populate('orderedItems.product');
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
