const Coupon = require('../../models/couponSchema');

const couponController = {
    // Get all coupons page
    getAllCoupons: async (req, res) => {
        try {
            const coupons = await Coupon.find().sort({ createdOn: -1 });
            res.render('coupons', {
                coupons,
                admin: req.session.admin,
                pageTitle: 'Coupons'
            });
        } catch (error) {
            console.error('Error fetching coupons:', error);
            res.status(500).render('error', { message: 'Failed to fetch coupons' });
        }
    },

    // Add new coupon page
    getAddCouponPage: async (req, res) => {
        try {
            res.render('add-coupon', {
                admin: req.session.admin,
                pageTitle: 'Add Coupon'
            });
        } catch (error) {
            console.error('Error loading add coupon page:', error);
            res.status(500).render('error', { message: 'Failed to load add coupon page' });
        }
    },

    // Add new coupon
    addCoupon: async (req, res) => {
        try {
            const { name, expireOn, offerPrice, minimumPrice } = req.body;

            // Validate coupon data
            if (!name || !expireOn || !offerPrice || !minimumPrice) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All fields are required' 
                });
            }

            // Check if coupon with same name exists
            const existingCoupon = await Coupon.findOne({ name: name });
            if (existingCoupon) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Coupon with this name already exists' 
                });
            }

            // Create new coupon
            const newCoupon = new Coupon({
                name,
                expireOn,
                offerPrice,
                minimumPrice
            });

            await newCoupon.save();

            res.status(201).json({ 
                success: true, 
                message: 'Coupon added successfully' 
            });
        } catch (error) {
            console.error('Error adding coupon:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to add coupon' 
            });
        }
    },

    // Edit coupon page
    getEditCouponPage: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);

            if (!coupon) {
                return res.status(404).render('error', { message: 'Coupon not found' });
            }

            res.render('edit-coupon', {
                coupon,
                admin: req.session.admin,
                pageTitle: 'Edit Coupon'
            });
        } catch (error) {
            console.error('Error loading edit coupon page:', error);
            res.status(500).render('error', { message: 'Failed to load edit coupon page' });
        }
    },

    // Update coupon
    updateCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;
            const { name, expireOn, offerPrice, minimumPrice } = req.body;

            // Validate coupon data
            if (!name || !expireOn || !offerPrice || !minimumPrice) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All fields are required' 
                });
            }

            // Check if coupon exists
            const coupon = await Coupon.findById(couponId);
            if (!coupon) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Coupon not found' 
                });
            }

            // Update coupon
            coupon.name = name;
            coupon.expireOn = expireOn;
            coupon.offerPrice = offerPrice;
            coupon.minimumPrice = minimumPrice;

            await coupon.save();

            res.json({ 
                success: true, 
                message: 'Coupon updated successfully' 
            });
        } catch (error) {
            console.error('Error updating coupon:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update coupon' 
            });
        }
    },

    // List/Unlist coupon
    toggleCouponStatus: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);

            if (!coupon) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Coupon not found' 
                });
            }

            coupon.isList = !coupon.isList;
            await coupon.save();

            res.json({ 
                success: true, 
                message: `Coupon ${coupon.isList ? 'listed' : 'unlisted'} successfully`,
                status: coupon.isList
            });
        } catch (error) {
            console.error('Error toggling coupon status:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update coupon status' 
            });
        }
    }
};

module.exports = couponController;
