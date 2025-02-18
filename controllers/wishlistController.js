const User = require("../models/userSchema")
const Product = require("../models/productSchema")



const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        const user = await User.findById(userId);

        const totalItems = user.wishlist.length;
        const totalPages = Math.ceil(totalItems / limit);

        const wishlistIds = user.wishlist.slice((page - 1) * limit, page * limit);

        const products = await Product.find({ _id: { $in: wishlistIds } }).populate("category");


        res.render("wishlist", {
            user,
            wishlist: products,
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;
        const user = await User.findById(userId)
        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ status: false, message: "Product already in Wishlist" })
        }
        user.wishlist.push(productId)
        await user.save()
        return res.status(200).json({ status: true, message: "Product added to wishlist" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, message: "Server Error" })
    }
}
const removeProduct = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId)
        const index = user.wishlist.indexOf(productId)
        user.wishlist.splice(index, 1)
        await user.save()
        return res.redirect("/wishlist")
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, message: "server error" })
    }
}
module.exports = {
    loadWishlist, addToWishlist, removeProduct
}