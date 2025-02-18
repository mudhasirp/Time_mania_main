const Product = require("../models/productSchema");
const category = require("../models/categorySchema");
const User = require("../models/userSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        const product = await Product.findById(productId).populate('category');
        const findCategory = product.category;

        const suggestedProducts = await Product.find({ category: findCategory._id })
            .limit(3)
            .exec();

        res.render("product-details", {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: findCategory,
            suggestedProducts: suggestedProducts,
            averageRating: product.rating,
            ratingCount: product.ratingCount || 0
        });
    } catch (error) {
        console.log("Error fetching product details:", error);
        res.redirect("/pageNotFound");
    }
};

const submitRating = async (req, res) => {
    try {
        const { productId, rating } = req.body;
        const userId = req.session.user;

        if (rating < 1 || rating > 5) {
            return res.redirect(`/product-details?id=${productId}&error=Rating must be between 1 and 5`);
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const totalRatings = product.rating * product.ratingCount || 0;
        const newRatingCount = (product.ratingCount || 0) + 1;
        const newAverageRating = (totalRatings + rating) / newRatingCount;

        const validAverageRating = Math.min(5, Math.max(1, newAverageRating));

        product.rating = validAverageRating;
        product.ratingCount = newRatingCount;

        await product.save();

        res.redirect(`/productDetails?id=${productId}&success=Rating submitted successfully`);
    } catch (error) {
        console.log("Error submitting rating:", error);

        res.redirect(`/productDetails?id=${productId}&error=Something went wrong. Please try again later.`);
    }
};


module.exports = {
    productDetails,
    submitRating
};
