const Category = require('../../models/categorySchema');
const category = require('../../models/categorySchema');

const categoryInfo = async(req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1) * limit;
        const categoryData = await category.find({})
            .sort({createdAt: -1})
            .skip(skip)
            .limit(limit);

        const totalCategories = await category.countDocuments();
        const totalPages = Math.ceil(totalCategories/limit);
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
}

const addCategory = async (req,res) => {
    const {name, description} = req.body;
    try {
        const existingCategory = await category.findOne({name});
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

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getunListCategory,
    getEditCategoty,
    EditCategoty
}