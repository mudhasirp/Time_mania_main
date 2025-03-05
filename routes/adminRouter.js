const express = require("express")
const router = express.Router();
const adminController = require("../controllers/admin/adminController");

const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController");

const productController = require('../controllers/admin/productController')
const customerController = require("../controllers/admin/customerController")
const orderController = require("../controllers/admin/orderContoller")
const couponController = require("../controllers/admin/couponController")
const salesController = require("../controllers/admin/salesController")
const { userAuth, adminAuth, isSessionAdmin } = require("../middlewares/auth")
const multer = require("multer");
const storage = require("../helpers/multer")
const uploads = multer({ storage: storage });
router.get("/pageerror", adminController.pageerror)
router.get("/login", adminController.loadlogin);
router.post("/login", adminController.login)
router.get("/", isSessionAdmin,   adminAuth, adminController.loadDashboard)
router.get("/logout", adminController.logout)
router.get("/users", isSessionAdmin, adminAuth, customerController.customerInfo)
router.get("/blockCustomer", adminAuth, customerController.customerBlocked)
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked)

router.get("/category", isSessionAdmin, adminAuth, categoryController.categoryInfo)
router.post("/addcategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", isSessionAdmin, adminAuth, categoryController.getListCategory)
router.get("/unlistCategory", adminAuth, categoryController.getUnListCategory)
router.get("/editCategory", adminAuth, categoryController.getEditCategory)
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);
router.get("/brands", isSessionAdmin, adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand)
router.get("/blockBrand", adminAuth, brandController.blockBrand)
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand)
router.get("/deleteBrand", adminAuth, brandController.deleteBrand)

router.get("/addproducts", adminAuth, productController.getProductAddPage)
router.post("/addproducts", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/products", isSessionAdmin, adminAuth, productController.getAllProducts);
router.get("/blockProduct", adminAuth, productController.blockProduct)
router.get("/unblockProduct", adminAuth, productController.unblockProduct)
router.get("/editProduct", adminAuth, productController.getEditProduct)
router.post("/editProduct/:id", adminAuth, uploads.array("images", 4), productController.editProduct)
router.post("/deleteImage", adminAuth, productController.deleteSingleImage)

router.get('/orders', isSessionAdmin,adminAuth, orderController.getOrder)


router.get('/order/:orderId', adminAuth, orderController.orderDetailsAdmin)

router.put('/order/:orderId/status', adminAuth, orderController.updateOrderStatus);

router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer)
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer)
router.post("/addProductOffer", adminAuth, productController.addProductOffer)
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer)
router.get("/coupon",isSessionAdmin, adminAuth, couponController.loadCoupon)
router.post("/createCoupon", adminAuth, couponController.createCoupon)
router.get("/editCoupon", adminAuth, couponController.editCoupon)
router.post("/updateCoupon", adminAuth, couponController.updateCoupon)
router.get("/deleteCoupon", adminAuth, couponController.deleteCoupon)
router.get('/salesReport', isSessionAdmin,adminAuth, salesController.getSalesReport)
router.get('/dateWiseFilter', salesController.filterSale)
router.get("/download-pdf", salesController.downloadPDF);
router.get("/download-excel", salesController.downloadExcel);
router.get("/dashboard",isSessionAdmin, adminController.loadDashboard);

module.exports = router