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
            
            
            const userId = new mongoose.Types.ObjectId(req.session.user);// Convert string id to ObjectId
            console.log('Converted user ID to ObjectId:', userId.toString());

           
            const orders = await Order.find({ userId: userId }) // Show regular orders list with populated fields
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img Sale_price'
                })
                .populate({
                    path: 'address',
                    select: 'name street city state pincode mobile'
                })
                .sort({ createdOn: -1 });

            // Get the latest order for success page
            const latestOrder = orders[0];

            if (latestOrder) {
                console.log('Latest order:', {
                    id: latestOrder._id,
                    address: latestOrder.address,
                    items: latestOrder.orderedItems
                });

                // Render order success page - latest order
                res.render('orderSuccess', {
                    order: latestOrder,
                    user: req.session.user,
                    pageTitle: 'Order Successful'
                });
            } else {
                // If no orders redirect to orders page
                res.redirect('/orders');
            }
        } catch (error) {
            console.error('Error viewing orders:', error);
            res.redirect('/');
        }
    },

    // View single order details
    viewOrder: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const orderId = req.params.orderId;
            console.log('Looking for order:', orderId);

            const userId = new mongoose.Types.ObjectId(req.session.user);

            const order = await Order.findOne({ 
                _id: orderId,
                userId: userId
            })
            .populate({
                path: 'orderedItems.product',
                select: 'name product_img Sale_price'
            });

            console.log('Found order:', order ? {
                id: order._id.toString(),
                status: order.status,
                items: order.orderedItems.length,
                hasProducts: order.orderedItems.every(item => item.product)
            } : 'No order found');

            if (!order) {
                return res.redirect('/orders');
            }

            // Filter out any null products and provide default values
            order.orderedItems = order.orderedItems.map(item => ({
                ...item,
                product: item.product || {
                    name: 'Product Unavailable',
                    product_img: ['default.jpeg'],
                    Sale_price: item.price
                }
            }));

            // Get address details
            const userAddresses = await Address.findOne({ userId: userId });
            let orderAddress = null;
            
            if (userAddresses && userAddresses.address) {
                orderAddress = userAddresses.address.find(addr => addr._id.toString() === order.address.toString());
                console.log('Found address:', orderAddress ? {
                    id: orderAddress._id.toString(),
                    name: orderAddress.name,
                    city: orderAddress.city
                } : 'No matching address found');
            }

            res.render('orderDetails', {
                order,
                orderAddress,
                pageTitle: 'Order Details',
                user: req.session.user
            });
        } catch (error) {
            console.error('Error viewing order:', error);
            res.redirect('/orders');
        }
    },

    // Cancel order
    cancelOrder: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login first' });
            }

            const orderId = req.params.orderId;
            const userId = new mongoose.Types.ObjectId(req.session.user);

            const order = await Order.findOne({ 
                _id: orderId,
                userId: userId
            });

            console.log(order)
            //update quantity
            for(item of order.orderedItems){
                await Product.findOneAndUpdate(
                    {_id:item.product},
                    {$inc:{available_quantity : item.quantity}}
                )
               
            }


            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            if (!['Pending', 'Processing'].includes(order.status)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Order cannot be cancelled at this stage' 
                });
            }

            order.status = 'Cancelled';
            await order.save();

            res.json({ success: true, message: 'Order cancelled successfully' });
        } catch (error) {
            console.error('Error cancelling order:', error);
            res.status(500).json({ success: false, message: 'Failed to cancel order' });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressId, paymentMethod } = req.body;

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

    orderSuccess: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            
            // Get order with populated fields
            const order = await Order.findById(orderId)
                .populate({
                    path: 'orderedItems.product',
                    select: 'name product_img Sale_price'
                })
                .populate('address'); // Populate the address field

            if (!order) {
                return res.status(404).redirect('/404');
            }

            // Log for debugging
            console.log('Order:', {
                id: order._id,
                address: order.address,
                items: order.orderedItems.length
            });

            res.render('user/orderSuccess', {
                order: order,
                address: order.address
            });
        } catch (error) {
            console.error('Error in order success:', error);
            res.status(500).json({ success: false, message: 'Failed to load order success page' });
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
                    select: 'name product_img Sale_price'
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
};

// Function to generate order ID
function generateOrderId() {
    return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
}

module.exports = orderController;
