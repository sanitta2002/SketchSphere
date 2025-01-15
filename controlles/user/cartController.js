const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');

const cartController = {
    // Load cart page
    loadCart: async (req, res) => {
        try {
            const userId = req.session.user;
            if (!userId) {
                return res.redirect('/login');
            }

            const cart = await Cart.findOne({ userId })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category_id',
                        select: 'name offerPercentage offerEndDate'
                    }
                });

            if (!cart) {
                return res.render('cart', { 
                    cart: { items: [] }, 
                    totalPrice: 0,
                    subtotal: 0, 
                    user: req.session.user 
                });
            }

            // Calculate prices and offers for each item
            const cartItems = cart.items.map(item => {
                const product = item.productId;
                const now = new Date();
                const category = product.category_id;

                // Get product and category offers
                const productOffer = product.offerPercentage || 0;
                const categoryOffer = category?.offerPercentage || 0;
                
                // Check if offers are valid
                const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
                const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
                
                // Determine which offer is better
                let bestOffer = 0;
                let offerType = 'none';
                
                if (hasValidProductOffer && hasValidCategoryOffer) {
                    // Both offers are valid, use the higher one
                    if (productOffer >= categoryOffer) {
                        bestOffer = productOffer;
                        offerType = 'product';
                    } else {
                        bestOffer = categoryOffer;
                        offerType = 'category';
                    }
                } else if (hasValidProductOffer) {
                    bestOffer = productOffer;
                    offerType = 'product';
                } else if (hasValidCategoryOffer) {
                    bestOffer = categoryOffer;
                    offerType = 'category';
                }
                
                // Calculate current price with best offer
                let currentPrice = product.Sale_price;
                if (bestOffer > 0) {
                    const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                    currentPrice = Math.round(product.Sale_price - discountAmount);
                }

                return {
                    ...item.toObject(),
                    currentPrice,
                    originalPrice: product.Sale_price,
                    offerPercentage: bestOffer,
                    offerType,
                    productOffer: hasValidProductOffer ? productOffer : 0,
                    categoryOffer: hasValidCategoryOffer ? categoryOffer : 0,
                    totalPrice: currentPrice * item.quantity
                };
            });

            // Calculate total price
            const subtotal = cartItems.reduce((total, item) => total + item.totalPrice, 0);
            const totalPrice = subtotal; // Add shipping or other costs if needed

            // Create a new cart object with calculated items
            const cartWithOffers = {
                ...cart.toObject(),
                items: cartItems,
                subtotal,
                total: totalPrice
            };

            res.render('cart', {
                cart: cartWithOffers,
                subtotal,
                totalPrice,
                user: req.session.user
            });

        } catch (error) {
            console.error('Error in loadCart:', error);
            res.status(500).render('error', { error: 'Error loading cart' });
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
            const now = new Date();
            const category = product.category_id;
            
            const productOffer = product.offerPercentage || 0;
            const categoryOffer = category?.offerPercentage || 0;
            
            const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
            const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
            
            // Determine which offer is better
            let bestOffer = 0;
            let offerType = 'none';
            
            if (hasValidProductOffer && hasValidCategoryOffer) {
                // Both offers are valid, use the higher one
                if (productOffer >= categoryOffer) {
                    bestOffer = productOffer;
                    offerType = 'product';
                } else {
                    bestOffer = categoryOffer;
                    offerType = 'category';
                }
            } else if (hasValidProductOffer) {
                bestOffer = productOffer;
                offerType = 'product';
            } else if (hasValidCategoryOffer) {
                bestOffer = categoryOffer;
                offerType = 'category';
            }
            
            let currentPrice = product.Sale_price;
            if (bestOffer > 0) {
                const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                currentPrice = Math.round(product.Sale_price - discountAmount);
            }

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
            const userId = req.session.user;

            const cart = await Cart.findOne({ userId })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category_id',
                        select: 'name offerPercentage offerEndDate'
                    }
                });

            if (!cart) {
                return res.status(404).json({ success: false, message: 'Cart not found' });
            }

            const cartItem = cart.items.find(item => item.productId._id.toString() === productId);
            if (!cartItem) {
                return res.status(404).json({ success: false, message: 'Product not found in cart' });
            }

            // Check quantity limits
            const maxLimit = 5;
            const availableQuantity = cartItem.productId.available_quantity;

            if (quantity > maxLimit) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 5 items allowed per product',
                    quantity: Math.min(maxLimit, cartItem.quantity)
                });
            }

            if (quantity > availableQuantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested quantity exceeds available stock',
                    quantity: Math.min(availableQuantity, cartItem.quantity)
                });
            }

            if (quantity < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Quantity cannot be less than 1',
                    quantity: cartItem.quantity
                });
            }

            // Calculate current price with best offer
            const product = cartItem.productId;
            const now = new Date();
            const category = product.category_id;
            
            const productOffer = product.offerPercentage || 0;
            const categoryOffer = category?.offerPercentage || 0;
            
            const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
            const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
            
            // Determine which offer is better
            let bestOffer = 0;
            let offerType = 'none';
            
            if (hasValidProductOffer && hasValidCategoryOffer) {
                // Both offers are valid, use the higher one
                if (productOffer >= categoryOffer) {
                    bestOffer = productOffer;
                    offerType = 'product';
                } else {
                    bestOffer = categoryOffer;
                    offerType = 'category';
                }
            } else if (hasValidProductOffer) {
                bestOffer = productOffer;
                offerType = 'product';
            } else if (hasValidCategoryOffer) {
                bestOffer = categoryOffer;
                offerType = 'category';
            }
            
            let currentPrice = product.Sale_price;
            if (bestOffer > 0) {
                const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
                currentPrice = Math.round(product.Sale_price - discountAmount);
            }

            // Update quantity
            cartItem.quantity = quantity;
            await cart.save();

            // Calculate total price for all items
            let totalPrice = 0;
            cart.items.forEach(item => {
                const itemProduct = item.productId;
                const itemCategory = itemProduct.category_id;
                
                const itemProductOffer = itemProduct.offerPercentage || 0;
                const itemCategoryOffer = itemCategory?.offerPercentage || 0;
                
                const hasValidItemProductOffer = itemProductOffer > 0 && new Date(itemProduct.offerEndDate) > now;
                const hasValidItemCategoryOffer = itemCategoryOffer > 0 && itemCategory && new Date(itemCategory.offerEndDate) > now;
                
                // Determine which offer is better
                let itemBestOffer = 0;
                let itemOfferType = 'none';
                
                if (hasValidItemProductOffer && hasValidItemCategoryOffer) {
                    // Both offers are valid, use the higher one
                    if (itemProductOffer >= itemCategoryOffer) {
                        itemBestOffer = itemProductOffer;
                        itemOfferType = 'product';
                    } else {
                        itemBestOffer = itemCategoryOffer;
                        itemOfferType = 'category';
                    }
                } else if (hasValidItemProductOffer) {
                    itemBestOffer = itemProductOffer;
                    itemOfferType = 'product';
                } else if (hasValidItemCategoryOffer) {
                    itemBestOffer = itemCategoryOffer;
                    itemOfferType = 'category';
                }
                
                let itemCurrentPrice = itemProduct.Sale_price;
                if (itemBestOffer > 0) {
                    const discountAmount = Math.round((itemProduct.Sale_price * itemBestOffer) / 100);
                    itemCurrentPrice = itemProduct.Sale_price - discountAmount;
                }
                
                totalPrice += Math.round(itemCurrentPrice * item.quantity);
            });

            return res.json({
                success: true,
                quantity: cartItem.quantity,
                price: currentPrice,
                total: Math.round(currentPrice * quantity),
                cartTotal: totalPrice,
                offerPercentage: bestOffer,
                maxQuantity: Math.min(maxLimit, availableQuantity)
            });

        } catch (error) {
            console.error('Error in updateCart:', error);
            res.status(500).json({ success: false, message: 'Error updating cart' });
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
