const product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const Language = require('../../models/languageSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { name } = require('ejs')

const getProductAddPage = async (req, res) => {
    try {

        const categor = await Category.find({ isListed: true })
        res.render('addproduct', {
            cat: categor,

        })

    } catch (error) {

        res.redirect('/pageeeror')

    }

}

const addproduct = async (req, res) => {
    try {
        const products = req.body;
        console.log("Received product data:", products);

        // Validate required fields
        if (!products.description || products.description.trim() === '') {
            
            return res.status(400).json({ error: "Description is required" });
        }

        if (!products.category) {
            console.log("Category is missing");
            return res.status(400).json({ error: "Category is required" });
        }

        const productExists = await product.findOne({
            name: products.productName,
        });

        if (productExists) {
            return res.status(400).json({ error: "Product already exists" });
        }

        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json({ error: "Invalid category name" });
        }

        const images = [];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = path.join(
                    "public",
                    "uploads",
                    "re-image",
                    req.files[i].filename
                );
                const resizedImagePath = path.join(
                    "public",
                    "uploads",
                    "re-image",
                    `resized-${req.files[i].filename}`
                );

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(`resized-${req.files[i].filename}`);
            }
        }

        const newProduct = new product({
            name: products.productName,
            description: products.description.trim(),
            category_id: categoryId._id,
            Regular_price: products.regularPrice || 0,
            Sale_price: products.salePrice || 0,
            available_quantity: products.quantity || 0,
            product_img: images,
            Published_Date: products.Published_Date || null,
            writer: products.writer || null,
            cover_Artist: products.cover_Artist || null,
            language: products.language || null,
            isBlocked: false
        });

        await newProduct.save();
        console.log("Product saved successfully");
        req.session.successMessage = "Product added successfully!";
        return res.redirect("/admin/products");

    } catch (error) {
        console.error("Error saving product:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: Object.values(error.errors).map(err => err.message).join(', ')
            });
        }
        return res.redirect("/admin/pageerror");
    }
};

const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let query = {};
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }

        const totalProducts = await product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await product.find(query)
            .populate('category_id')
            .skip(skip)
            .limit(limit);

        const successMessage = req.session.successMessage;
        delete req.session.successMessage;  // Clear the message after use

        res.render('products', {
            data: products,
            currentPage: page,
            totalPages: totalPages,
            successMessage: successMessage
        });
    } catch (error) {
        console.error(error);
        res.redirect('/pageeeror');
    }
};

const blockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        await product.findByIdAndUpdate(id, { isBlocked: true });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error blocking product:", error);
        res.status(500).json({ success: false, error: 'Failed to block product' });
    }
}

const unblockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        await product.findByIdAndUpdate(id, { isBlocked: false });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.status(500).json({ success: false, error: 'Failed to unblock product' });
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const productData = await product.findOne({ _id: id });
        const categories = await Category.find({});
        
        console.log("Product Data for Edit:", productData);
        console.log("Product Language:", productData.language);
        
        res.render("editProduct", {
            product: productData,
            cat: categories,
        });
    } catch (error) {
        console.error("Error fetching product for editing:", error);
        res.redirect('/admin/pageerror');
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        
        console.log("Edit Product Data:", data);
        console.log("Language value:", data.language);

        // Update fields
        const updateFields = {
            name: data.productName,
            description: data.description,
            Regular_price: data.regularPrice,
            Sale_price: data.salePrice,
            available_quantity: data.quantity,
            Published_Date: data.Published_Date || null,
            writer: data.writer || null,
            cover_Artist: data.cover_Artist || null,
            language: data.language || null
        };

        console.log("Update Fields:", updateFields);

        // Handle image uploads
        if (req.files && req.files.length > 0) {
            const images = [];
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = path.join(
                    "public",
                    "uploads",
                    "re-image",
                    req.files[i].filename
                );
                const resizedImagePath = path.join(
                    "public",
                    "uploads",
                    "re-image",
                    `resized-${req.files[i].filename}`
                );

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(`resized-${req.files[i].filename}`);
            }

            if (images.length > 0) {
                updateFields.product_img = images;
            }
        }

        // Find category ID
        const categoryData = await Category.findOne({ name: data.category });
        if (categoryData) {
            updateFields.category_id = categoryData._id;
        }

        await product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect('/admin/products');
    } catch (error) {
        console.error("Error updating product:", error);
        res.redirect('/admin/pageerror');
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameTOServer, productIdToServer } = req.body;
        console.log("Deleting image:", imageNameTOServer, "from product:", productIdToServer);

        // Find the product and remove the image from the array
        const productData = await product.findById(productIdToServer);
        if (!productData) {
            return res.json({ success: false, message: 'Product not found' });
        }

        // Remove the image from product_img array
        const updatedProduct = await product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { product_img: imageNameTOServer } },
            { new: true }
        );

        if (!updatedProduct) {
            return res.json({ success: false, message: 'Failed to update product' });
        }

        // Delete the physical image file
        const imagePath = path.join("public", "uploads", "re-image", imageNameTOServer);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameTOServer} deleted successfully`);
            return res.json({ success: true, message: 'Image deleted successfully' });
        } else {
            console.log(`Image ${imageNameTOServer} not found in filesystem`);
            return res.json({ success: true, message: 'Image reference removed from product' });
        }
    } catch (error) {
        console.error("Error deleting image:", error);
        return res.json({ success: false, message: 'Server error while deleting image' });
    }
};

module.exports = {
    getProductAddPage,
    addproduct,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}