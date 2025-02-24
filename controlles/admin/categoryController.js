const Category = require('../../models/categorySchema');
const category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const categoryInfo = async(req,res) => {
    try {
        const categories = await Category.find();
        res.render('category', { categories });
    } catch (error) {
        console.log("Error loading categories:", error);
        res.status(500).send('Server error');
    }
}

const addCategory = async (req,res) => {
    const {name, description} = req.body;
    try {
        const existingCategory = await category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
        if(existingCategory) {
            return res.status(400).json({error: "Category already exists"});
        }
        const newCategory = new category({
            name,
            description
        });
        
        await newCategory.save();
        return res.json({message: "Category added successfully"});
    } catch (error) {
        return res.status(500).json({error: "Internal Server Error"});
    }
}

const getListCategory = async (req,res) => {
    try {
        const id = req.query.id;
        await category.findByIdAndUpdate(id, { isListed: false });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error listing category:", error);
        res.status(500).json({ success: false, error: 'Failed to list category' });
    }
}

const getunListCategory = async (req,res) => {
    try {
        const id = req.query.id;
        await category.findByIdAndUpdate(id, { isListed: true });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.status(500).json({ success: false, error: 'Failed to unlist category' });
    }
}

const getEditCategoty = async(req,res) => {
    try {
        const id = req.query.id;
        const categoryData = await category.findOne({_id: id});
        if (!categoryData) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        res.render('edit-category', { category: categoryData });
    } catch (error) {
        console.error("Error getting category:", error);
        res.status(500).json({ success: false, error: 'Failed to get category' });
    }
}

const EditCategoty = async (req,res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const existingCategory = await category.findOne({
            name: categoryName,
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, error: 'Category name already exists' });
        }

        const updatedCategory = await category.findByIdAndUpdate(
            id,
            { 
                name: categoryName,
                description: description
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
}

// Add category offer and update all products in the category
const addCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const { offerPercentage, offerStartDate, offerEndDate } = req.body;

        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            req.session.error = 'Category not found';
            return res.redirect('/admin/category');
        }

        // Update category with offer details
        category.offerPercentage = offerPercentage;
        category.offerStartDate = offerStartDate;
        category.offerEndDate = offerEndDate;
        await category.save();

        // Find all products in this category and update their offer
        const products = await Product.find({ category_id: categoryId });

        req.session.success = 'Category offer added and applied to all products!';
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        req.session.error = 'Failed to add category offer';
        res.redirect('/admin/category');
    }
};

// Remove category offer and update all products
const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;

        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            req.session.error = 'Category not found';
            return res.redirect('/admin/category');
        }

        // Remove offer from category
        category.offerPercentage = 0;
        category.offerStartDate = null;
        category.offerEndDate = null;
        await category.save();

        req.session.success = 'Category offer removed from category and all products!';
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error in removeCategoryOffer:', error);
        req.session.error = 'Failed to remove category offer';
        res.redirect('/admin/category');
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getunListCategory,
    getEditCategoty,
    EditCategoty,
    addCategoryOffer,
    removeCategoryOffer
}