const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const productDetail = async (req, res) => {
    try {
        const productId = req.query.id || req.params.id;
        const product = await Product.findById(productId)
            .populate({
                path: 'category_id',
                select: 'name offerPercentage offerEndDate'
            });

        if (!product) {
            return res.status(404).render('404-page');
        }

        // Calculate current prices based on offers
        const now = new Date();
        const category = product.category_id;
        
        // Get product and category offers
        const productOffer = product.offerPercentage || 0;
        const categoryOffer = category?.offerPercentage || 0;
        
        // Check if offers are valid
        const hasValidProductOffer = productOffer > 0 && new Date(product.offerEndDate) > now;
        const hasValidCategoryOffer = categoryOffer > 0 && category && new Date(category.offerEndDate) > now;
        
        // Get the best offer
        const bestOffer = hasValidProductOffer ? productOffer : (hasValidCategoryOffer ? categoryOffer : 0);
        
        // Calculate offer price
        let currentPrice = product.Sale_price;
        if (bestOffer > 0) {
            const discountAmount = Math.round((product.Sale_price * bestOffer) / 100);
            currentPrice = product.Sale_price - discountAmount;
        }

        // Fetch recommended products from the same category
        const recommendedProducts = await Product.find({
            category_id: product.category_id,
            _id: { $ne: product._id },
            isBlocked: false
        })
        .populate('category_id', 'offerPercentage offerEndDate')
        .limit(4);

        // Calculate offers for recommended products
        const recommendedWithOffers = recommendedProducts.map(recProduct => {
            const recProductOffer = recProduct.offerPercentage || 0;
            const recCategoryOffer = recProduct.category_id?.offerPercentage || 0;
            
            const hasValidRecProductOffer = recProductOffer > 0 && new Date(recProduct.offerEndDate) > now;
            const hasValidRecCategoryOffer = recCategoryOffer > 0 && recProduct.category_id && new Date(recProduct.category_id.offerEndDate) > now;
            
            const recBestOffer = hasValidRecProductOffer ? recProductOffer : (hasValidRecCategoryOffer ? recCategoryOffer : 0);
            
            let recCurrentPrice = recProduct.Sale_price;
            if (recBestOffer > 0) {
                const discountAmount = Math.round((recProduct.Sale_price * recBestOffer) / 100);
                recCurrentPrice = recProduct.Sale_price - discountAmount;
            }
            
            return {
                ...recProduct.toObject(),
                currentPrice: Math.round(recCurrentPrice),
                offerPercentage: recBestOffer,
                hasValidOffer: recBestOffer > 0,
                originalPrice: recProduct.Sale_price
            };
        });
        
        const productWithOffer = {
            ...product.toObject(),
            currentPrice: Math.round(currentPrice),
            offerPercentage: bestOffer,
            hasValidOffer: bestOffer > 0,
            originalPrice: product.Sale_price
        };

        // Get user data if logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        }

        res.render('productDetails', {
            product: productWithOffer,
            recommendedProducts: recommendedWithOffers,
            user: userData
        });
    } catch (error) {
        console.error('Error in productDetail:', error);
        res.status(500).render('error', { error: 'Internal server error' });
    }
};

module.exports = {
    productDetail
};