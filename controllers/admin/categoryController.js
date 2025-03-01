const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        res.redirect("/pageerror");
    }
};

const addCategory = async (req, res) => {
    let { name, description } = req.body;
    try {
        const trimmedName = name.trim();
const existingCategory = await Category.findOne({
  name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
});

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }
        const newCategory = new Category({
            name,
            description
        });
        await newCategory.save();
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
};
const getListCategory = async (req, res) => {

    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } })
        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/pageerror")
    }
}
const getUnListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } })
        res.redirect("/admin/category")

    } catch (error) {
        res.redirect("/pageerror")

    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp("^" + categoryName + "$", "i") } 
        });
        
        
        if (existingCategory) {
            return res.status(400).json({ 
                error: true,
                message: "Category already exists. Please choose a different name."
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(id,
            {
                name: categoryName,
                description: description
            }, 
            { new: true }
        );

        if (updatedCategory) {
            return res.status(200).json({
                success: true,
                message: "Category updated successfully"
            });
        } else {
            return res.status(404).json({ 
                error: true,
                message: "Category not found" 
            });
        }
        
    } catch (error) {
        return res.status(500).json({ 
            error: true,
            message: "Internal server error" 
        });
    }
}
const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id });
        res.render("edit-category", { category: category });

    } catch (error) {
        res.redirect("/pagerror")
    }
}
const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        const hasProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: "Some products have a higher product offer." });
        }

        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        for (const product of products) {
            product.productOffer = 0;
            product.salePrice = Math.round(product.regularPrice - (product.regularPrice * (percentage / 100)));
            await product.save();
        }

        res.json({ status: true, message: "Category offer applied successfully!" });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};
const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        for (const product of products) {
            product.salePrice = product.regularPrice;
            product.productOffer = 0;
            await product.save();
        }

        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: 0 } });

        res.json({ status: true, message: "Category offer removed successfully!" });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

















module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnListCategory,
    getEditCategory,
    editCategory, addCategoryOffer, removeCategoryOffer
};
