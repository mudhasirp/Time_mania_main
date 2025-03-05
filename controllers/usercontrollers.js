const User = require("../models/userSchema")
const Category = require("../models/categorySchema")
const Product = require("../models/productSchema")
const Brand = require("../models/brandSchema")
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const mongoose = require('mongoose');

const bcrypt = require("bcrypt")
const Wallet = require("../models/walletSchema")
const loadHomepage = async (req, res) => {
    try {

        
        let userData = null;

        if (req.user) {
            userData = req.user;
        }
        else if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user });
        }

        const categories = await Category.find({ isListed: true });

        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        productData = productData.slice(0, 4);

        res.render("home", {
            user: userData,
            products: productData
        });

    } catch (error) {
        res.status(500).send("Server Error");
    }
};
const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const loadSignup = async (req, res) => {
    try {
        return res.render('signup')
    } catch (error) {
        res.status(500).send("Server Error");
    }
}
function generateOtp() {

    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendverificationemail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth:
            {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b> Your OTP :${otp} </b>`,




        })
        return info.accepted.length > 0
    } catch (error) {
        return false
    }
}
const filterProduct = async (req, res) => {
    try {
        const userId = req.session.user;
        let {
            category: categoryFilter,
            brand: brandFilter,
            minPrice,
            maxPrice,
            sort,
            page = 1
        } = req.query;
        const originalCategorySelection = Array.isArray(categoryFilter) ? categoryFilter : categoryFilter ? [categoryFilter] : [];
        const originalBrandSelection = Array.isArray(brandFilter) ? brandFilter : brandFilter ? [brandFilter] : [];
// In your controller, add this right after you define originalCategorySelection and originalBrandSelection

        const limit = 6;
        const skip = (page - 1) * limit;

        const validateObjectIds = (ids) => {
            if (!ids) return [];
            const idArray = Array.isArray(ids) ? ids : [ids];
            return idArray
                .filter(id => id && id.trim())
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
        };

        const validCategoryIds = validateObjectIds(categoryFilter);
        const validBrandIds = validateObjectIds(brandFilter);

        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (validCategoryIds.length > 0) {
            query.category = { $in: validCategoryIds };
        }

        if (validBrandIds.length > 0) {
            const foundBrands = await Brand.find({ _id: { $in: validBrandIds } });
            const brandNames = foundBrands.map(b => b.brandName);
            query.brand = { $in: brandNames };
        }

        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice && !isNaN(minPrice)) {
                query.salePrice.$gte = Number(minPrice);
            }
            if (maxPrice && !isNaN(maxPrice)) {
                query.salePrice.$lte = Number(maxPrice);
            }
        }

        let sortOption = {};
        switch (sort) {
            case 'popularity':
                sortOption = { quantity: -1 };
                break;
            case 'priceLowToHigh':
                sortOption = { salePrice: 1 };
                break;
            case 'priceHighToLow':
                sortOption = { salePrice: -1 };
                break;
            case 'newArrivals':
                sortOption = { createdAt: -1 };
                break;
            case 'aToZ':
                sortOption = { productName: 1 };
                break;
            case 'zToA':
                sortOption = { productName: -1 };
                break;
            case 'averageRatings':
                sortOption = { rating: -1 };
                break;
            case 'featured':
                query.featured = true;
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        if (userId && (validCategoryIds.length > 0 || validBrandIds.length > 0)) {
            const searchEntry = {
                category: validCategoryIds,
                brand: validBrandIds,
                searchOn: new Date()
            };

            await User.findByIdAndUpdate(
                userId,
                { $push: { searchHistory: searchEntry } },
                { runValidators: true }
            );
        }

        const categories = await Category.find({ isListed: true }).lean();
        const allBrands = await Brand.find({}).lean();
        const userData = userId ? await User.findById(userId) : null;

        res.render("shop", {
            user: userData,
            products,
            category: categories,
            brand: allBrands,
            totalPages,
            currentPage: parseInt(page),
            selectedCategory: originalCategorySelection, // Use original selections here
            selectedBrand: originalBrandSelection,
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            isFiltered: true,
            sort: sort || '',
            totalProducts
        });

    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
const signup = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword, referralCode } = req.body;
        if (password !== cPassword) {
            return res.render("signup", { message: "Passwords do not match" });

        }
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" })
        }
        const findPhone = await User.findOne({ phone });
        if (findPhone) {
            return res.render("signup", { message: "User with this phone number already exists" });
        }
        let referrer = null
        if (referralCode) {
            referrer = await User.findOne({ referralCode: referralCode.trim() })
            if (!referrer) {
                return res.render("signup", { message: "Invalid referral code" })
            }
        }
        const otp = generateOtp();
        const emailsent = await sendverificationemail(email, otp);
        if (!emailsent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp;
       
        req.session.userData = { name, phone, email, password, referrerId: referrer ? referrer._id : null };

        console.log("session send", req.session.userOtp)

        res.render("verify-otp")
        console.log("OTP sent", otp)

    } catch (error) {

    }
}
const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {

    }
}
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        console.log("Full session data:", req.session);
        console.log("OTP received:", otp);
        console.log("Session OTP:", req.session.userOtp);

        if (!req.session.userOtp) {
            return res.status(400).json({ success: false, message: "Session expired, please try again." });
        }

        if (parseInt(otp) === parseInt(req.session.userOtp)) {
            if (!req.session.userData) {
                return res.status(400).json({ success: false, message: "Session expired, please try again." });
            }

            const user = req.session.userData;
            console.log("Before hashing password");
            const passwordHash = await securePassword(user.password);
            console.log("After hashing password:", passwordHash);

            const referralCode = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
            console.log("Generated Referral Code:", referralCode);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                referralCode,
                redeemed: false,
                redeemedUsers: [],
                wallet: null  // ✅ Setting wallet as null initially
            });

            await saveUserData.save().then(() => console.log("User saved successfully!"))
                .catch(err => console.error("Error saving user:", err));

            // ✅ Create a wallet immediately after user creation
            const newWallet = new Wallet({
                userId: saveUserData._id,
                balance: 0,
                transactions: []
            });

            await newWallet.save()
                .then(() => console.log("Wallet created successfully!"))
                .catch(err => console.error("Error creating wallet:", err));

            // ✅ Update user with the created wallet ObjectId
            saveUserData.wallet = newWallet._id;
            await saveUserData.save().catch(err => console.error("Error updating user with wallet:", err));

            if (user.referrerId && mongoose.Types.ObjectId.isValid(user.referrerId)) {
                const referrer = await User.findById(user.referrerId);
                if (referrer) {
                    referrer.redeemedUsers.push(saveUserData._id);
                    referrer.redeemed = true;
                    await referrer.save().catch(err => console.error("Error saving referrer:", err));

                    let referrerWallet = await Wallet.findOne({ userId: referrer._id });
                    if (referrerWallet) {
                        referrerWallet.balance += 100;
                        referrerWallet.transactions.push({
                            type: "credit",
                            amount: 100,
                            description: "Referral bonus"
                        });
                        await referrerWallet.save().catch(err => console.error("Error updating wallet:", err));
                    } else {
                        referrerWallet = new Wallet({
                            userId: referrer._id,
                            balance: 100,
                            transactions: [{
                                type: "credit",
                                amount: 100,
                                description: "Referral bonus"
                            }]
                        });
                        await referrerWallet.save().catch(err => console.error("Error creating wallet:", err));
                    }
                }
            }

            req.session.user = saveUserData._id;
            console.log("Working ✅");
            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
        }
    } catch (error) {
        console.error("Error in verifyOtp:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};


const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" })

        }
        const otp = generateOtp();
        req.session.userOtp = otp;
        const emailSent = await sendverificationemail(email, otp);
        if (emailSent) {
            console.log("Resend Otp", otp);
            res.status(200).json({ success: true, message: "OTP resend succesfully" })
        }
        else {
            res.status(500).json({ success: false, message: "Failer To Resend Otp" })

        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Failer To Resend Otp" })

    }
}
const loadlogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login")
        }
        else {
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("pageNotFound")
    }
}
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({
            isAdmin: 0,
            email: email
        })
        if (!findUser) {
            return res.render("login", { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" })

        }
        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render('login', { message: "Incorrect password" })


        }
        req.session.user = findUser._id;

        res.redirect("/")
    } catch (error) {
        res.render("login", { message: "login failed pls try again" });
    }
}
const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/login");
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;


        let sortOption = {};
        if (req.query.sort === 'popularity') {
            sortOption = { quantity: -1 };
        } else if (req.query.sort === 'priceLowToHigh') {
            sortOption = { salePrice: 1 };
        } else if (req.query.sort === 'priceHighToLow') {
            sortOption = { salePrice: -1 };
        } else if (req.query.sort === 'newArrivals') {
            sortOption = { createdAt: -1 };
        } else if (req.query.sort === 'aToZ') {
            sortOption = { productName: 1 };
        } else if (req.query.sort === 'zToA') {
            sortOption = { productName: -1 };
        } else if (req.query.sort === 'averageRatings') {
            sortOption = { rating: -1 };
        } else if (req.query.sort === 'featured') {
            sortOption = { isBlocked: false, featured: true };
        } else {
            sortOption = { createdAt: -1 };
        }

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        })
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        });

        const totalPages = Math.ceil(totalProducts / limit);
        const brands = await Brand.find({ isBlocked: false });
        const categoriesWithIds = categories.map((category) => ({ _id: category._id, name: category.name }));

        res.render('shop', {
            user: userData,
            products: products,
            category: categoriesWithIds,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: [],  
            selectedBrand: [],
            isFiltered: true, 
            sort: req.query.sort || 'popularity',
            minPrice:  '',
            maxPrice: '',


        });
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};
const searchProducts = async (req, res) => {
    try {
        const userId = req.session.user;
        
        const search = (req.method === 'POST' ? req.body.query : req.query.query) || '';
        
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        // Get filter parameters
        let {
            category: categoryFilter,
            brand: brandFilter,
            minPrice,
            maxPrice,
            sort
        } = req.method === 'POST' ? req.body : req.query;

        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (search && search.trim()) {
            query.productName = { 
                $regex: new RegExp(search.trim(), "i")
            };
        }

        if (categoryFilter) {
            const validCategoryIds = Array.isArray(categoryFilter) 
                ? categoryFilter.filter(id => mongoose.Types.ObjectId.isValid(id))
                : [categoryFilter].filter(id => mongoose.Types.ObjectId.isValid(id));
            
            if (validCategoryIds.length > 0) {
                query.category = { 
                    $in: validCategoryIds.map(id => new mongoose.Types.ObjectId(id)) 
                };
            }
        }

        if (brandFilter) {
            const validBrandIds = Array.isArray(brandFilter)
                ? brandFilter.filter(id => mongoose.Types.ObjectId.isValid(id))
                : [brandFilter].filter(id => mongoose.Types.ObjectId.isValid(id));
            
            if (validBrandIds.length > 0) {
                const foundBrands = await Brand.find({ _id: { $in: validBrandIds } });
                const brandNames = foundBrands.map(b => b.brandName);
                query.brand = { $in: brandNames };
            }
        }

        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice && !isNaN(minPrice)) {
                query.salePrice.$gte = Number(minPrice);
            }
            if (maxPrice && !isNaN(maxPrice)) {
                query.salePrice.$lte = Number(maxPrice);
            }
        }

        let sortOption = {};
        switch (sort) {
            case 'popularity':
                sortOption = { quantity: -1 };
                break;
            case 'priceLowToHigh':
                sortOption = { salePrice: 1 };
                break;
            case 'priceHighToLow':
                sortOption = { salePrice: -1 };
                break;
            case 'newArrivals':
                sortOption = { createdAt: -1 };
                break;
            case 'aToZ':
                sortOption = { productName: 1 };
                break;
            case 'zToA':
                sortOption = { productName: -1 };
                break;
            case 'averageRatings':
                sortOption = { rating: -1 };
                break;
            case 'featured':
                query.featured = true;
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const categories = await Category.find({ isListed: true }).lean();
        const brands = await Brand.find({}).lean();
        const userData = userId ? await User.findById(userId) : null;

        const totalPages = Math.ceil(totalProducts / limit);

        if (req.method === 'POST') {
            const queryString = new URLSearchParams({
                query: search,
                sort: sort || '',
                minPrice: minPrice || '',
                maxPrice: maxPrice || '',
                page: page,
                ...(categoryFilter && { category: categoryFilter }),
                ...(brandFilter && { brand: brandFilter })
            }).toString();
            return res.redirect(`/search?${queryString}`);
        }

        res.render("shop", {
            user: userData,
            products,
            category: categories,
            brand: brands,
            totalPages,
            currentPage: page,
            selectedCategory: Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter],
            selectedBrand: Array.isArray(brandFilter) ? brandFilter : (brandFilter ? [brandFilter] : []),
        
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            isFiltered: true,
            sort: sort || '',
            totalProducts,
            searchQuery: search
        });
        

    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
const changePassword = async (req, res) => {
    try {
        const userId = req.session.user; 
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { oldPassword, newPassword, confirmNewPassword } = req.body;

        if (!newPassword || !confirmNewPassword) {
            return res.status(400).json({ error: 'New password fields are required' });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ error: 'New passwords do not match' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.password) {
            if (!oldPassword) {
                return res.status(400).json({ error: 'Old password is required' });
            }
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Old password is incorrect' });
            }
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();

        return res.json({ message: 'Password changed successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};
const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user })
        const brands = await Brand.find({}).lean()
        const categories = await Category.find({ isListed: true }).lean()

        let findProducts = await Product.find({
            salePrice: { $gt: req.query.gt, $lt: req.query.lt },
            isBlocked: false, quantity: { $gt: 0 }
        }).lean()
        findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage)
        const currentProduct = findProducts.slice(startIndex, endIndex)
        req.session.filteredProducts = findProducts;
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,

        })
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const contactUs = async (req, res) => {
    try {
        res.render("contactUs")

    } catch (error) {
        res.render("page-404")
    }
}
const getChangePassword = async (req, res) => {
    try {
        res.render("passwordChange")
    } catch (error) {
        res.render("page-404")
    }
}
module.exports = {
    loadHomepage, loadSignup, signup, verifyOtp, resendOtp, loadlogin, pageNotFound, login, logout, loadShoppingPage,
    filterProduct, filterByPrice, searchProducts, contactUs, changePassword, getChangePassword
}