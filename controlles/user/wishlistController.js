const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
// Load wishlist page
const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        
        if (!userId) {
            return res.redirect('/login');
        }

        // First get the user
        const user = await User.findById(userId);
        // Then fetch the products from the wishlist IDs
        const wishlistItems = await Product.find({ _id: { $in: user.wishlist } });

        console.log('Wishlist Items:', wishlistItems); 

        const cartData = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
        const wishlistCount = user.wishlist ? user.wishlist.length : 0;

        res.render('wishlist', {
            wishlistItems,
            user: req.session.user,
            cart: cartData,
            wishlistCount: wishlistCount
        });
    } catch (error) {
        console.error("Load wishlist error:", error);
        res.status(500).render('error', {
            message: "Error loading wishlist",
            error: error
        });
    }
};

// Add or remove product from wishlist
const toggleWishlist = async (req, res) => {
    try {
        
        const { productId } = req.body;
        const userId = req.session.user;

       
       
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to add items to wishlist"
            });
        }

        // Verify that the product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const user = await User.findById(userId);
        // console.log("user",user)
        //  const wishlistCount=  user.wishlist.length
        


        const productIndex = user.wishlist.indexOf(productId);
   
        if (productIndex === -1) {
            // Add to wishlist
            user.wishlist.push(productId);
            await user.save();
            const wishlistCount=  user.wishlist.length
            res.json({
                success: true,
                message: "Product added to wishlist",
                action: "added",
                wishlistCount:wishlistCount
            });
        } else {
            // Remove from wishlist
            user.wishlist.splice(productIndex, 1);
            await user.save();
            const wishlistCount=  user.wishlist.length
            res.json({
                success: true,
                message: "Product removed from wishlist",
                action: "removed",
                wishlistCount:wishlistCount
            });
        }
    } catch (error) {
        console.error("Toggle wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating wishlist",
            error: error.message
        });
    }
};

// Get wishlist status for a product
const getWishlistStatus = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user;

        if (!userId) {
            return res.status(200).json({
                success: true,
                inWishlist: false
            });
        }

        const user = await User.findById(userId);
        const inWishlist = user.wishlist.includes(productId);

        

        res.json({
            success: true,
            inWishlist
        });
    } catch (error) {
        console.error("Get wishlist status error:", error);
        res.status(500).json({
            success: false,
            message: "Error checking wishlist status",
            error: error.message
        });
    }
};

module.exports = {
    loadWishlist,
    toggleWishlist,
    getWishlistStatus
};
