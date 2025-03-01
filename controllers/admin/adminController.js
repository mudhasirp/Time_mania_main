const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Product = require("../../models/productSchema")
const LedgerEntry = require('../../models/ledgerSchema');

const pageerror = async (req, res) => {
    res.render("admin-error")
}

const loadlogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login", { message: null })
}
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password)
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin")
            } else {
                return res.redirect("/login")
            }
        }
        else {
            return res.redirect("/login")
        }

    } catch (error) {
        return res.redirect("/pageerror")


    }
}
const loadDashboard = async (req, res) => {
    try {
        const { filter } = req.query;
        
        let startDate, endDate;
        const now = new Date();
        
        if (filter === "yearly") {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else if (filter === "monthly") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdOn = { $gte: startDate, $lte: endDate };
        }

        const ordersByDate = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: filter === "yearly" ? "%Y-%m" : "%Y-%m-%d",
                            date: "$createdOn"
                        }
                    },
                    orderCount: { $sum: 1 },
                    totalRevenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        
        const bestSellingProducts = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            { 
                $group: { 
                    _id: "$orderedItems.product",
                    totalQuantity: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            { 
                $lookup: { 
                    from: "products", 
                    localField: "_id", 
                    foreignField: "_id", 
                    as: "product"
                }
            },
            { $unwind: "$product" }
        ]);

       
        const bestSellingCategories = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
              $lookup: {
                from: "products",
                localField: "orderedItems.product",
                foreignField: "_id",
                as: "productData"
              }
            },
            { $unwind: "$productData" },
            {
              $group: {
                _id: "$productData.category",  
                totalSold: { $sum: "$orderedItems.quantity" }
              }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: "categories",      
                localField: "_id",       
                foreignField: "_id",     
                as: "categoryData"
              }
            },
            { $unwind: "$categoryData" },
            {
              $project: {
                name: "$categoryData.name",
                totalSold: 1
              }
            }
          ]);
          

      
        const bestSellingBrands = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productData"
                }
            },
            { $unwind: "$productData" },
            {
                $group: {
                    _id: "$productData.brand",
                    totalSold: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        
        const ledgerBook = await Order.find(dateFilter)
            .select("orderId userId totalPrice payment.status createdOn")
            .populate("userId", "name email");

        res.render("dashboard", {
            bestSellingProducts,
            bestSellingCategories,
            bestSellingBrands,
            ledgerBook,
            filter,
            ordersByDate,
        });
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

const logout = async (req, res) => {

    try {
        req.session.destroy(err => {
            if (err) {
                return res.redirect("/pageerror")
            }

            res.redirect("/admin/login")
        }
        )
    } catch (error) {
        res.redirect("/pageerror")
    }
}
module.exports =
{
    
    loadlogin, login, loadDashboard, pageerror, logout
}