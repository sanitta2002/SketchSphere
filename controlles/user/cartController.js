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
                .populate('items.productId', 'name Sale_price product_img writer available_quantity offerPrice offerPercentage offerStartDate offerEndDate');

            let hasInsufficientStock = false;

            if (cart) {
                // Check each item stock and update quantities if necessary
                let needsUpdate = false;
                cart.items = cart.items.map(item => {
                    if (item.productId && item.quantity > item.productId.available_quantity) {
                        hasInsufficientStock = true;
                        item.quantity = item.productId.available_quantity;
                        needsUpdate = true;
                    }

                    // Calculate current price based on offer
                    if (item.productId) {
                        const hasValidOffer = item.productId.offerPrice > 0 && 
                                           new Date(item.productId.offerEndDate) > new Date();
                        item.currentPrice = hasValidOffer ? item.productId.offerPrice : item.productId.Sale_price;
                        item.totalPrice = item.currentPrice * item.quantity;
                    }

                    return item;
                });

                // Update cart in database if quantities were adjusted
                if (needsUpdate) {
                    await cart.save();
                }
                
                // Calculate total after potential quantity adjustments
                cart.total = cart.items.reduce((total, item) => {
                    return total + item.totalPrice;
                }, 0);
            }

            res.render('cart', { cart, hasInsufficientStock });
        } catch (error) {
            console.error('Error loading cart:', error);
            res.status(500).render('user/pageNotFound', { error: 'Failed to load cart' });
        }
    },

    // Add to cart
    addToCart: async (req, res) => {
        try {
            const { productId, quantity } = req.body;
            
            if (!req.session.user) {
                return res.status(401).json({ success: false, message: 'Please login first' });
            }

            // Fetch product details
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            // Check if product is in stock
            if (product.available_quantity < quantity) {
                return res.status(400).json({ success: false, message: 'Not enough stock available' });
            }

            // Calculate current price based on offer
            const hasValidOffer = product.offerPrice > 0 && new Date(product.offerEndDate) > new Date();
            const currentPrice = hasValidOffer ? product.offerPrice : product.Sale_price;

            let cart = await Cart.findOne({ userId: req.session.user });
            
            if (cart) {
                // Check if product already exists in cart
                const existingItem = cart.items.find(item => 
                    item.productId.toString() === productId
                );

                if (existingItem) {
                    // Update existing item
                    const newQuantity = existingItem.quantity + parseInt(quantity);
                    
                    if (newQuantity > 5) {
                        return res.status(400).json({
                            success: false,
                            message: 'Maximum 5 items allowed per product'
                        });
                    }

                    if (newQuantity > product.available_quantity) {
                        return res.status(400).json({
                            success: false,
                            message: 'Not enough stock available'
                        });
                    }
                    
                    existingItem.quantity = newQuantity;
                    existingItem.price = currentPrice;
                    existingItem.totalPrice = currentPrice * newQuantity;
                } else {
                    // Add new item
                    cart.items.push({
                        productId: productId,
                        quantity: parseInt(quantity),
                        price: currentPrice,
                        totalPrice: currentPrice * parseInt(quantity)
                    });
                }
            } else {
                // Create new cart
                cart = new Cart({
                    userId: req.session.user,
                    items: [{
                        productId: productId,
                        quantity: parseInt(quantity),
                        price: currentPrice,
                        totalPrice: currentPrice * parseInt(quantity)
                    }]
                });
            }

            await cart.save();

            res.json({
                success: true,
                message: 'Product added to cart',
                cartCount: cart.items.length
            });
        } catch (error) {
            console.error('Error in addToCart:', error);
            res.status(500).json({ success: false, message: 'Failed to add to cart' });
        }
    },

    // Update cart item quantity
    updateCart: async (req, res) => {
        try {
            const { productId, quantity } = req.body;
            const cart = await Cart.findOne({ userId: req.session.user });
            
            if (!cart) {
                return res.status(404).json({ error: 'Cart not found' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            const cartItem = cart.items.find(item => item.productId.toString() === productId);
            if (!cartItem) {
                return res.status(404).json({ error: 'Item not found in cart' });
            }

            // Validate quantity
            const newQuantity = parseInt(quantity);
            if (newQuantity > product.available_quantity) {
                return res.status(400).json({ 
                    error: 'Insufficient stock',
                    availableQuantity: product.available_quantity 
                });
            }

            // Calculate current price based on offer
            const hasValidOffer = product.offerPrice > 0 && new Date(product.offerEndDate) > new Date();
            const currentPrice = hasValidOffer ? product.offerPrice : product.Sale_price;

            // Update quantity and prices
            cartItem.quantity = newQuantity;
            cartItem.price = currentPrice;
            cartItem.totalPrice = currentPrice * newQuantity;

            // Recalculate cart total
            cart.total = cart.items.reduce((total, item) => {
                return total + item.totalPrice;
            }, 0);

            await cart.save();

            res.json({ 
                success: true, 
                quantity: cartItem.quantity,
                itemTotal: cartItem.totalPrice,
                cartTotal: cart.total,
                currentPrice: currentPrice,
                originalPrice: product.Sale_price,
                offerPercentage: product.offerPercentage
            });
        } catch (error) {
            console.error('Error updating cart:', error);
            res.status(500).json({ error: 'Failed to update cart' });
        }
    },

    // Remove item from cart
    removeFromCart: async (req, res) => {
        try {
            const { productId } = req.body;
            
            if (!req.session.user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Please login first' 
                });
            }

            const cart = await Cart.findOne({ userId: req.session.user });
            if (!cart) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Cart not found' 
                });
            }

            // Remove item from cart
            cart.items = cart.items.filter(item => 
                item.productId.toString() !== productId
            );

            // Recalculate cart total
            cart.total = cart.items.reduce((total, item) => {
                return total + item.totalPrice;
            }, 0);

            await cart.save();

            // If cart is empty, remove it
            if (cart.items.length === 0) {
                await Cart.findByIdAndDelete(cart._id);
            }

            res.json({
                success: true,
                message: 'Item removed from cart',
                cartCount: cart.items.length,
                cartTotal: cart.total
            });
        } catch (error) {
            console.error('Error removing item from cart:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to remove item from cart' 
            });
        }
    }
};

module.exports = cartController;
