const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose")

const getCartPage = async (req, res) => {
  try {
    const id = req.session.user;
    const user = await User.findOne({ _id: id });
    const productIds = user.cart.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const oid = new mongodb.ObjectId(id);
    let data = await User.aggregate([
      { $match: { _id: oid } },
      { $unwind: "$cart" },
      {
        $project: {
          proId: { $toObjectId: "$cart.productId" },
          quantity: "$cart.quantity",
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "proId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
    ]);
    let quantity = 0;
    for (const i of user.cart) {
      quantity += i.quantity;
    }
    let grandTotal = 0;
    for (let i = 0; i < data.length; i++) {
      if (products[i]) {
        grandTotal += data[i].productDetails[0].salePrice * data[i].quantity;
      }
      req.session.grandTotal = grandTotal;
    }
    console.log(grandTotal)
    res.render("cart", {
      user,
      quantity,
      data,
      grandTotal,
    });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};
const addToCart = async (req, res) => {
  try {
    const id = req.body.productId;
    const userId = req.session.user;
    console.log("User ID:", userId);
    console.log("Product ID:", id);

    const findUser = await User.findById(userId);
    const product = await Product.findById({ _id: id }).lean();

    if (!product) {
      return res.json({ status: "Product not found" });
    }

    if (product.quantity <= 0) {
      return res.redirect(`/productDetails?id=${id}&error=out_of_stock`);
    }
    const cartIndex = findUser.cart.findIndex((item) => item.productId == id);

    if (cartIndex === -1) {
      const quantity = 1;
      await User.findByIdAndUpdate(userId, {
        $addToSet: {
          cart: {
            productId: id,
            quantity: quantity,
          },
        },
      });
      return res.redirect('/cart');
    } else {
      const productInCart = findUser.cart[cartIndex];
      if (productInCart.quantity < product.quantity) {
        const newQuantity = productInCart.quantity + 1;
        await User.updateOne(
          { _id: userId, "cart.productId": id },
          { $set: { "cart.$.quantity": newQuantity } }
        );
        return res.redirect('/cart');
      } else {
        return res.redirect(`/productDetails?id=${id}&error=out_of_stock`);
      }
    }
  } catch (error) {
    console.error(error);
    return res.redirect("/pageNotFound");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    console.log("Deleting product with id:", productId);

    const userId = req.session.user;
    if (!userId) {
      console.log("User session not set");
      return res.redirect("/pageNotFound");
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found");
      return res.redirect("/pageNotFound");
    }

    console.log("User cart before deletion:", user.cart);

    const cartIndex = user.cart.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );
    console.log("Found index:", cartIndex);

    if (cartIndex === -1) {
      console.log("Product not found in cart");
      return res.redirect("/cart");
    }

    user.cart.splice(cartIndex, 1);
    await user.save();

    console.log("Product removed successfully. New cart:", user.cart);
    res.redirect("/cart");
  } catch (error) {
    console.error("Error deleting product:", error);
    res.redirect("/pageNotFound");
  }
};

const changeQuantity = async (req, res) => {
  try {
    console.log("Received request:", req.body);
    console.log("Session User ID:", req.session.user);
    console.log("Received productId:", req.body.productId);
    console.log("Type of productId:", typeof req.body.productId);

    const userId = req.session.user;
    const productId = req.body.productId;
    const count = parseInt(req.body.count);

    if (!userId || !productId) {
      return res.status(400).json({ status: false, error: "Missing data" });
    }

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    const productExistInCart = findUser.cart.find(item => item.productId === productId);
    if (!productExistInCart) {
      return res.status(400).json({ status: false, error: "Product not in cart" });
    }
    console.log("User Cart:", findUser.cart);
    let newQuantity = productExistInCart.quantity + count;
    if (newQuantity < 1) {
      return res.status(400).json({ status: false, error: "Quantity cannot be less than 1" });
    }

    const quantityUpdated = await User.updateOne(
      { _id: userId, "cart.productId": productId },
      { $set: { "cart.$.quantity": newQuantity } }
    );

    if (quantityUpdated.modifiedCount > 0) {
      const grandTotal = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$cart" },
        {
          $addFields: {
            "cart.productId": { $toObjectId: "$cart.productId" }
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "cart.productId",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: null,
            totalPrice: { $sum: { $multiply: ["$cart.quantity", "$productDetails.salePrice"] } }
          }
        }
      ]);

      console.log("GrandTotal:", grandTotal);






      const findProduct = await Product.findOne({ _id: productId });

      res.json({
        status: true,
        quantityInput: newQuantity,
        count: count,
        totalAmount: newQuantity * (findProduct?.salePrice || 0),
        grandTotal: grandTotal[0]?.totalPrice || 0
      });
    } else {
      res.status(400).json({ status: false, error: "Cart not updated" });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ status: false, error: "Server error" });
  }
};
const moveAllToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user || user.wishlist.length === 0) {
      return res.json({ status: "error", message: "Wishlist is empty or user not found." });
    }

    for (let wishlistProductId of user.wishlist) {
      const product = await Product.findById(wishlistProductId).lean();

      if (!product) {
        console.log(`Product with ID ${wishlistProductId} not found.`);
        continue;
      }

      if (product.quantity <= 0) {
        console.log(`Product ${product.name} is out of stock.`);
        continue;
      }

      const cartIndex = user.cart.findIndex(item => item.productId.toString() === wishlistProductId.toString());

      if (cartIndex === -1) {
        await User.findByIdAndUpdate(userId, {
          $addToSet: {
            cart: {
              productId: wishlistProductId,
              quantity: 1,
            },
          },
        });
      } else {
        const productInCart = user.cart[cartIndex];
        if (productInCart.quantity < product.quantity) {
          await User.updateOne(
            { _id: userId, "cart.productId": wishlistProductId },
            { $inc: { "cart.$.quantity": 1 } }
          );
        } else {
          console.log(`Cannot add more of ${product.name}, out of stock.`);
        }
      }
    }

    user.wishlist = [];
    await user.save();

    res.json({ status: "success", message: "All items moved to cart." });

  } catch (error) {
    console.error("Error moving wishlist items to cart:", error);
    res.status(500).json({ status: "error", message: "Internal server error." });
  }
};



module.exports = {
  getCartPage, addToCart, deleteProduct, changeQuantity, moveAllToCart
}