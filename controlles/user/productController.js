const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const productDetail = async (req, res) => {
    try {
        const productId = req.query.id;
        
        // Fetch the product with populated category
        const product = await Product.findById(productId)
            .populate('category_id')
            .populate('genre_id');

        if (!product) {
            return res.status(404).render('user/404-page');
        }

        // Fetch recommended products from the same category
        const recommendedProducts = await Product.find({
            category_id: product.category_id,
            _id: { $ne: product._id }, // Exclude current product
            isBlocked: false,
            quantity: { $gt: 0 }
        })
        .limit(4)
        .select('name product_img Sale_price offerPrice');

        // Get user data if logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }

        res.render('productDetails', {
            product,
            recommendedProducts,
            user: userData
        });

    } catch (error) {
        console.error('Error in product detail:', error);
        res.status(500).render('user/404-page');
    }
};

module.exports = {
    productDetail
};