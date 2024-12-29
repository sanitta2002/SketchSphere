const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');

const cartController = {
    // Load cart page
    loadCart: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const cart = await Cart.findOne({ userId: req.session.user })
                .populate('items.productId', 'name Sale_price product_img writer available_quantity');

            res.render('cart', { cart });
        } catch (error) {
            console.error('Error loading cart:', error);
            res.status(500).render('user/pageNotFound', { error: 'Failed to load cart' });
        }
    },

    // Add to cart
    addToCart: async (req, res) => {
        try {
            console.log('Session:', req.session);
            // Check if user is logged in
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
            }

            const userId = req.session.user;
            const { productId, quantity } = req.body;

            console.log('Adding to cart:', {
                userId,
                productId,
                quantity,
                session: req.session
            });

            // Validate input
            if (!productId || !quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Product ID and quantity are required'
                });
            }

            // Find product
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            // Check stock
            if (product.available_quantity < parseInt(quantity)) {
                return res.status(400).json({
                    success: false,
                    message: 'Not enough stock available'
                });
            }

            // Find or create cart
            let cart = await Cart.findOne({ userId: userId });
            
            if (!cart) {
                // Create new cart
                cart = new Cart({
                    userId: userId,
                    items: []
                });
            }

            // Check if product already in cart
            const existingItemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );

            if (existingItemIndex > -1) {
                // Update existing item
                cart.items[existingItemIndex].quantity += parseInt(quantity);
                cart.items[existingItemIndex].price = product.Sale_price;
                cart.items[existingItemIndex].totalPrice = 
                    cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
            } else {
                // Add new item
                cart.items.push({
                    productId: productId,
                    quantity: parseInt(quantity),
                    price: product.Sale_price,
                    totalPrice: product.Sale_price * parseInt(quantity)
                });
            }

            // Save cart
            await cart.save();

            res.status(200).json({
                success: true,
                message: 'Product added to cart successfully'
            });

        } catch (error) {
            console.error('Error in addToCart:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add product to cart',
                error: error.message
            });
        }
    },

    // Update cart item quantity
    updateCart: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login first' });
            }

            const { productId, quantity } = req.body;
            const cart = await Cart.findOne({ userId: req.session.user });
            
            if (!cart) {
                return res.status(404).json({ success: false, message: 'Cart not found' });
            }

            const item = cart.items.find(item => item.productId.toString() === productId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in cart' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            if (product.available_quantity < quantity) {
                return res.status(400).json({ success: false, message: 'Not enough stock available' });
            }

            item.quantity = parseInt(quantity);
            item.totalPrice = item.price * item.quantity;

            await cart.save();
            res.json({ success: true, message: 'Cart updated successfully' });
        } catch (error) {
            console.error('Error updating cart:', error);
            res.status(500).json({ success: false, message: 'Failed to update cart' });
        }
    },

    // Remove item from cart
    removeFromCart: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login first' });
            }

            const { productId } = req.body;
            const cart = await Cart.findOne({ userId: req.session.user });

            if (!cart) {
                return res.status(404).json({ success: false, message: 'Cart not found' });
            }

            cart.items = cart.items.filter(item => item.productId.toString() !== productId);
            await cart.save();

            res.json({ success: true, message: 'Item removed from cart successfully' });
        } catch (error) {
            console.error('Error removing from cart:', error);
            res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
        }
    }
};

module.exports = cartController;
