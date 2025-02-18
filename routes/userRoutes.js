const express = require("express");
const router = express.Router();
const userController = require("../controllers/usercontrollers");
const passport = require("passport");
const productController = require("../controllers/productController")
const { userAuth } = require("../middlewares/auth");
const profileContoller = require("../controllers/profileController")
const cartController = require("../controllers/cartControllers")
const checkoutController = require("../controllers/checkoutController")
const wishlistController = require("../controllers/wishlistController")
const faqController=require("../controllers/faqController")
const { razorpay, verifySignature } = require('../config/razorpay');

router.get("/", userController.loadHomepage);
router.get("/shop", userAuth, userController.loadShoppingPage)
router.get("/filter", userAuth, userController.filterProduct)
router.get("/filterPrice", userAuth, userController.filterByPrice)
router.post("/search", userAuth, userController.searchProducts)
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)
router.get("/auth/google",
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    (req, res) => {
        console.log(" User after login:", req.user);
        console.log("Session Data:", req.session);

        req.session.user = req.user._id;

        res.redirect("/");
    }
);


router.get("/login", userController.loadlogin)
router.get("/pageNotFound", userController.pageNotFound)
router.post("/login", userController.login)
router.get("/logout", userController.logout)

router.get("/productDetails", productController.productDetails)
router.get("/forgot-password", profileContoller.getForgotPassPage)
router.post("/forgot-email-valid", profileContoller.forgotEmailValid)
router.post("/verify-passForgot-otp", profileContoller.verifyForgotPassOtp)
router.get("/reset-password", profileContoller.getResetPassPage)
router.post("/resend-forgot-otp", profileContoller.resendOtp)
router.post("/reset-password", profileContoller.postNewPassword)
router.get("/userProfile", userAuth, profileContoller.userProfile)
router.get("/change-email", userAuth, profileContoller.changeEmail)
router.post("/change-email", userAuth, profileContoller.changeEmailValid)
router.post("/verify-email-otp", userAuth, profileContoller.verifyEmailOtp)
router.post("/update-email", userAuth, profileContoller.updateEmail)
router.get("/change-password", userAuth, profileContoller.changePassword)
router.post("/change-password", userAuth, profileContoller.changePasswordValid)
router.post("/verify-changepassword-otp", userAuth, profileContoller.verifyChangePassOtp)
router.post('/resend-changepassword-otp', userAuth, profileContoller.resendChangePasswordOtp);
router.get("/addAddress", userAuth, profileContoller.addAddress)
router.post("/addAddress", userAuth, profileContoller.postAddAddress)
router.get("/editAddress", userAuth, profileContoller.editAddress);
router.post("/editAddress", userAuth, profileContoller.postEditAddress)
router.post("/editAddressCart", userAuth, profileContoller.postEditAddressCart)
router.get("/deleteAddress", userAuth, profileContoller.deleteAddress)
router.post("/submitrating", userAuth, productController.submitRating)
router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart", userAuth, cartController.addToCart)
router.get("/deleteItem", userAuth, cartController.deleteProduct)
router.post("/changeQuantity", userAuth, cartController.changeQuantity)
router.get("/checkout", userAuth, checkoutController.getCheckoutPage)
router.get("/orderDetails", userAuth, checkoutController.getOrderDetailsPage);
router.post('/orderPlaced', userAuth, checkoutController.orderPlaced)
// In your routes file
router.get('/my-orders', userAuth, checkoutController.getAllOrdersPage);
router.post('/cancelOrder', userAuth, checkoutController.cancelOrder)
router.get("/wishlist", userAuth, wishlistController.loadWishlist)
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist)
router.get("/removeFromWishlist", userAuth, wishlistController.removeProduct)
router.post('/returnOrder', userAuth, checkoutController.returnOrder);
router.post("/applyCoupon", userAuth, checkoutController.applyCoupon);
router.post('/create-razorpay-order', userAuth, checkoutController.createRazorpayOrder);
router.post('/verify-payment', userAuth, checkoutController.verifyPayment);
router.get('/orderSuccess', (req, res) => {
    const orderId = req.query.orderId;
    res.render('orderSuccess', { orderId });
});

router.get('/orderFailure', (req, res) => {
    const orderId = req.query.orderId;
    res.render('orderFailure', { orderId });
});
router.get('/check-wallet', userAuth, checkoutController.wallletcheck)

router.post('/process-wallet-payment', userAuth, checkoutController.processWallet)
router.post('/wishlist/moveAllToCart', userAuth, cartController.moveAllToCart)
router.get("/contact", userAuth, userController.contactUs)
router.post("/create-pending-order",userAuth,checkoutController.createPendingOrder)
router.post('/get-pending-order-details', userAuth,checkoutController.getPendingOrderDetails);
router.get('/download-invoice/:orderId', userAuth,checkoutController.downloadInvoice);
router.get("/getchangePasswordProfile",userAuth,userController.getChangePassword)
router.post("/changePasswordProfile",userAuth,userController.changePassword)
router.get("/faq", userAuth,faqController.getFaqPage);
router.post("/calc-shipping",checkoutController.calcshipping)
router.get("/shipping",(req,res)=>
{
    res.render("shipping")
})
module.exports = router