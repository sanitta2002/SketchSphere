const Product = require('../../models/productSchema');

const offerController = {
    // Render add offer form
    getAddOffer: async (req, res) => {
        try {
            const productId = req.params.id;
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.render('add-offer', { product });
        } catch (error) {
            console.error('Error in getAddOffer:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Add offer product
    addOffer: async (req, res) => {
        try {
            const productId = req.params.id;
            const { discountPercentage, startDate, endDate } = req.body;

            const product = await Product.findById(productId);
            if (!product) {
                req.session.error = 'Product not found';
                return res.redirect('/admin/products');
            }

            // Calculate discounted price
            const salePrice = product.Sale_price;
            const discountAmount = (salePrice * discountPercentage) / 100;
            const offerPrice = salePrice - discountAmount;

            // Update product with offer
            product.offerPrice = offerPrice;
            product.offerPercentage = discountPercentage;
            product.offerStartDate = new Date(startDate);
            product.offerEndDate = new Date(endDate);

            await product.save();
            req.session.success = 'Offer added successfully!';
            res.redirect('/admin/products');
        } catch (error) {
            console.error('Error in addOffer:', error);
            req.session.error = 'Failed to add offer';
            res.redirect('/admin/products');
        }
    },

    // Remove offer from produ
    removeOffer: async (req, res) => {
        try {
            const productId = req.params.id;
            const product = await Product.findById(productId);
            
            if (!product) {
                req.session.error = 'Product not found';
                return res.redirect('/admin/products');
            }

            // Remove offer 
            product.offerPrice = 0;
            product.offerPercentage = 0;
            product.offerStartDate = null;
            product.offerEndDate = null;

            await product.save();
            req.session.success = 'Offer removed successfully!';
            res.redirect('/admin/products');
        } catch (error) {
            console.error('Error in removeOffer:', error);
            req.session.error = 'Failed to remove offer';
            res.redirect('/admin/products');
        }
    }
};

module.exports = offerController;