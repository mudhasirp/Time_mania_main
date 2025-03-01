const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const Address = require("../models/addressSchema");
const Order = require("../models/orderSchema")
const Coupon = require("../models/couponSchema");
const Wallet = require("../models/walletSchema")
const mongodb = require("mongodb");
const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const path = require('path');

require('dotenv').config();
const mongoose = require("mongoose")

const { razorpayInstance, verifySignature } = require('../config/razorpay');

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Fetch order details
        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate('userId');
    
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        const invoiceNumber = `INV-${new Date().getFullYear()}${order._id.toString().slice(-6)}`;

        const taxRate = 0.12;
        const discountAmount = order.discount || 0; 
        const subtotal = order.totalPrice;
        const taxAmount = subtotal * taxRate;
        const finalAmount = subtotal - discountAmount + taxAmount;

        const shippingAddress = order.address.length > 0 ? order.address[0] : null;
        
        const doc = new PDFDocument({ margin: 30 });
        const invoicePath = path.join(__dirname, `../invoices/invoice_${orderId}.pdf`);
        const writeStream = fs.createWriteStream(invoicePath);

        doc.pipe(writeStream);
        doc.pipe(res);

        doc.font('Times-Bold').fontSize(24).text('INVOICE', { align: 'center' });
        doc.moveDown(2);

        doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).lineWidth(1).stroke();
        doc.moveDown(2);

        doc.font('Times-Bold').fontSize(12).text('Company Information', { align: 'center' }).moveDown(0.5);
        doc.font('Times-Roman').fontSize(10)
            .text('Time Mania', { align: 'center' })
            .text('Thiruval, Panoor, Kerala, India', { align: 'center' })
            .text('Phone: (+91) 6282980763', { align: 'center' })
            .text('Email: mudhasirp9@gmail.com', { align: 'center' })
            .moveDown(2);

        doc.font('Times-Bold').fontSize(12)
            .text(`Invoice No: ${invoiceNumber}`)
            .text(`Order ID: ${order._id}`)
            .text(`Date: ${order.createdOn.toDateString()}`)
            .text(`Customer: ${order.userId.name}`)
            .text(`Email: ${order.userId.email}`)
            .moveDown(2);

        doc.font('Times-Bold').text('Shipping Address:').moveDown(0.5);
        doc.font('Times-Roman')
            .text(`${shippingAddress.name || 'N/A'}`)
            .text(`${shippingAddress.landMark || 'N/A'}`)
            .text(`${shippingAddress.city || 'N/A'}, ${shippingAddress.state || ''} - ${shippingAddress.zip || ''}`)
            .text(`${shippingAddress.state || ''}`)
            .moveDown(2);

        const table = {
            headers: ["Product", "Qty", "Price (₹)", "Total (₹)"],
            rows: order.orderedItems.map(item => [
                item.product.productName,
                item.quantity.toString(),
                item.price.toFixed(2),
                (item.quantity * item.price).toFixed(2),
            ]),
        };

        await doc.table(table, {
            width: 500,
            prepareHeader: () => {
                doc.font('Times-Bold').fontSize(12).fillColor('#000000');
            },
            prepareRow: (row, i) => {
                doc.font('Times-Roman').fontSize(10).fillColor('#000000');
            },
        });

        doc.moveDown(2);

        doc.font('Times-Bold')
            .fontSize(12)
            .text(`Subtotal: ₹${subtotal.toFixed(2)}`, { align: 'right' });
        doc.font('Times-Roman')
            .text(`Discount: -₹${discountAmount.toFixed(2)}`, { align: 'right' });
        doc.font('Times-Bold')
            .text(`Tax (12% GST): ₹${taxAmount.toFixed(2)}`, { align: 'right' });
        doc.font('Times-Bold')
            .text(`Total Amount: ₹${finalAmount.toFixed(2)}`, { align: 'right' });
        doc.moveDown(2);

        doc.font('Times-Italic').fontSize(8)
            .text('Thank you for your business!', 30, doc.page.height - 50, { align: 'center' })
            .text('Terms: Payment due within 7 days', { align: 'center' })
            .text('© 2023 Time Mania. All rights reserved', { align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
            res.download(invoicePath);
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to generate invoice" });
    }
};


const SHIPPING_RATES = {
    "Andhra Pradesh": 120,
    "Arunachal Pradesh": 150,
    "Assam": 130,
    "Bihar": 120,
    "Chhattisgarh": 120,
    "Goa": 100,
    "Gujarat": 130,
    "Haryana": 120,
    "Himachal Pradesh": 130,
    "Jammu and Kashmir": 180,   
    "Jharkhand": 120,
    "Karnataka": 100,
    "Kerala": 0,
    "Madhya Pradesh": 120,
    "Maharashtra": 120,
    "Manipur": 150,
    "Meghalaya": 150,
    "Mizoram": 150,
    "Nagaland": 150,
    "Odisha": 120,
    "Punjab": 120,
    "Rajasthan": 120,
    "Sikkim": 150,
    "Tamil Nadu": 80,
    "Telangana": 100,
    "Tripura": 150,
    "Uttar Pradesh": 120,
    "Uttarakhand": 120,
    "West Bengal": 120,
  
    "Andaman and Nicobar Islands": 200,
    "Chandigarh": 120,
    "Dadra and Nagar Haveli and Daman and Diu": 150,
    "Delhi": 120,
    "Ladakh": 180,
    "Lakshadweep": 200,
    "Puducherry": 80,
  
    "Default": 150
  };
  const calcshipping=async (req, res) => {
    try {
      const userId = req.session.user; 
      const { addressId } = req.body;
  
      const user = await User.findById(userId);
      if (!user || !user.cart.length) {
        return res.json({ success: false, message: "Cart is empty" });
      }
  
      let subtotal = 0;
      for (let item of user.cart) {
        const product = await Product.findById(item.productId);
        if (product) {
          subtotal += product.salePrice * item.quantity;
        }
      }
  
      const addressData = await Address.findOne({
        userId,
        "address._id": addressId
      });
      if (!addressData) {
        return res.json({ success: false, message: "Address not found" });
      }
  
      const selectedAddress = addressData.address.find(a => a._id.toString() === addressId);
      if (!selectedAddress) {
        return res.json({ success: false, message: "Address not found in the list" });
      }
  
      const userState = selectedAddress.state || "Default";
      const shippingCost = SHIPPING_RATES[userState] ?? SHIPPING_RATES.Default;
  
      const grandTotal = subtotal + shippingCost;
  
      res.json({
        success: true,
        shippingCost,
        grandTotal
      });
    } catch (error) {
      res.json({ success: false, message: "Server error calculating shipping" });
    }
  };
  
const getCheckoutPage = async (req, res) => {
    try {
        const user = req.query.userId;
        const findUser = await User.findOne({ _id: user });
        const addressData = await Address.findOne({ userId: user });
        const oid = new mongodb.ObjectId(user);
        const data = await User.aggregate([
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

        const grandTotal = await User.aggregate([
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
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: null,
                    totalPrice: {
                        $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
                    },
                },
            },
        ]);
        const subtotal=grandTotal[0].totalPrice;
        const TAX_RATE=0.12;
        const taxAmount=Math.round(subtotal*TAX_RATE);
        const totalWithTax=subtotal+taxAmount;
        const outOfStockItems = data.filter(item => {
            const product = item.productDetails[0];
            return !product || product.quantity < item.quantity;
        });
         const blockedProducts=data.filter(item=>
         {
            const product=item.productDetails[0];
            return product.isBlocked===true 
         }
         )
        if (outOfStockItems.length > 0||blockedProducts.length>0) {
            
            return res.render("cart", {
                message: "Some items in your cart are no longer available in the desired quantity. Please update your cart.",
                outOfStockItems, 
                user: findUser, 
                data,          
                grandTotal: 0   
            });
        }
        const today = new Date().toISOString();
        const testCoupons = await Coupon.find({ isList: true });
        const userWallet = await Wallet.findOne({ userId: user });

         let shippingCost=0
        const findCoupons = await Coupon.find({
            isList: true,
            createdOn: { $lt: new Date(today) },
            expiredOn: { $gt: new Date(today) },
            minimumPrice: { $lt: grandTotal[0].totalPrice },
            usedBy: { $nin: [oid] }
        });
        if (findUser.cart && findUser.cart.length > 0) {
            res.render("checkout", {
                product: data,
                user: findUser,
                userAddress: addressData,
                grandTotal: totalWithTax,
                Coupons: findCoupons,
                taxAmount,
                subtotal,
        
                Wallet: userWallet,
                razorpayKey: process.env.RAZORPAY_KEY_ID,
                shippingCost,
                
            });
        } else {
            res.redirect("/shop");
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};


const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalPrice } = req.body;
        const userId = req.session.user;

        const coupon = await Coupon.findOne({ name: couponCode });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        const today = new Date();
        if (today < coupon.createdOn || today > coupon.expiredOn) {
            return res.status(400).json({ success: false, message: 'Coupon is not valid at this time' });
        }

        if (totalPrice < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPrice} required` });
        }

        if (coupon.usedBy.includes(userId)) {
            return res.status(400).json({ success: false, message: 'Coupon already used by this user' });
        }

        const discountedPrice = totalPrice - coupon.offerPrice;

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            discountedPrice: discountedPrice,
            offerPrice: coupon.offerPrice
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to apply coupon' });
    }
};
const getAllOrdersPage = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const orders = await Order.find({ userId: userId })
            .populate('orderedItems.product', 'productName productImage salePrice')
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });
        if (orders.length === 0) {
            return res.render("allOrders", {
                orders: [],
                message: "No orders found.",
            });
        }

        res.render("allOrders", {
            orders: orders,
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
const cancelOrder = async (req, res) => {
    const { orderId, productId, reason } = req.body;

    try {
        if (!orderId || (productId && !mongoose.Types.ObjectId.isValid(productId))) {
            return res.status(400).json({ success: false, message: 'Invalid request parameters' });
        }

        const order = await Order.findById(orderId)
            .populate('userId')
            .populate('orderedItems.product', 'price quantity');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const cancellableStates = ['pending', 'confirmed', 'processing'];
        if (!cancellableStates.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled in ${order.status} state`
            });
        }

        let refundAmount = 0;
        const cancellationType = productId ? 'partial' : 'full';

        if (cancellationType === 'full') {

            if (order.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'Order is already cancelled'
                });
            }

            refundAmount = order.finalAmount;
            order.status = 'cancelled';
            const bulkOps = order.orderedItems.map(item => ({
                updateOne: {
                    filter: { _id: item.product._id },
                    update: { $inc: { quantity: item.quantity } }
                }
            }));

            await Product.bulkWrite(bulkOps);

        } else {
            const item = order.orderedItems.find(item =>
                item.product._id.equals(productId) &&
                item.productStatus !== 'cancelled'
            );

            if (!item) {
                return res.status(400).json({
                    success: false,
                    message: 'Item not found or already cancelled'
                });
            }

            if (item.productStatus === 'shipped' || item.productStatus === 'delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot cancel shipped/delivered items'
                });
            }

            refundAmount = item.price * item.quantity;
            item.productStatus = 'cancelled';

            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: item.quantity } },
                { new: true }
            );

            const allCancelled = order.orderedItems.every(
                item => item.productStatus === 'cancelled'
            );

            if (allCancelled) {
                order.status = 'cancelled';
                refundAmount = order.finalAmount;
            }
        }

        if (order.payment.method === 'razorpay' || order.payment.method === 'wallet') {
            const wallet = await Wallet.findOneAndUpdate(
                { userId: order.userId._id },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount: refundAmount,
                            description: `Refund for ${cancellationType} cancellation (Order #${order.orderId})`,
                            orderId: order._id,
                            timestamp: new Date()
                        }
                    }
                },
                { upsert: true, new: true }
            );
        }

        order.refundDetails = {
            amount: refundAmount,
            initiatedAt: new Date(),
            type: cancellationType,
            reason: reason || 'Not specified'
        };

        order.updatedAt = new Date();
        await order.save();



        return res.json({
            success: true,
            message: `${cancellationType === 'full' ? 'Order' : 'Product'
                } cancelled successfully`,
            refundAmount,
            newOrderStatus: order.status
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const returnOrder = async (req, res) => {
    const { orderId, reason } = req.body;

    try {

        const order = await Order.findById(orderId);


        if (!order || order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: 'Return request can only be made for delivered orders'
            });
        }


        const now = new Date();
        const deliveredAt = order.deliveredAt
        const diffDays = (now - deliveredAt) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
            return res.status(400).json({
                success: false,
                message: 'Return request can only be made before 7 days of delivery'
            });
        }


        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Return reason is required'
            });
        }


        order.status = 'return-requested';
        order.returnReason = reason;


        await order.save();

        res.json({
            success: true,
            message: 'Return request submitted for admin approval'
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getOrderDetailsPage = async (req, res) => {
    try {
        const orderId = req.query.id;


        const findOrder = await Order.findOne({ _id: orderId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage salePrice'
            });

        if (!findOrder) {
            return res.redirect("/pageNotFound");
        }


        if (!findOrder.orderedItems || !Array.isArray(findOrder.orderedItems)) {
            return res.status(404).json({ error: "No items found in this order." });
        }

        let totalGrant = findOrder.orderedItems.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        res.render("orderDetails", {
            orders: findOrder,
            totalGrant: totalGrant,
            totalPrice: findOrder.totalPrice,
            discount: findOrder.discount || 0,
            finalAmount: findOrder.finalAmount,
            razorpayKey:process.env.RAZORPAY_KEY_ID

        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const orderPlaced = async (req, res) => {
    try {
        const {
            totalPrice,
            addressId,
            couponCode,
            paymentMethod = 'cod',
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature
        } = req.body;
        if (paymentMethod === 'cod' && totalPrice >= 1000) {
            return res.status(400).json({ error: "Cash on delivery is only available for orders below ₹1000" });
        }
        const userId = req.session.user;
        const findUser = await User.findById(userId);

        if (!findUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const findAddress = await Address.findOne({
            userId: userId,
            "address._id": addressId
        });

        if (!findAddress) {
            return res.status(404).json({ error: "Address not found" });
        }
        const outOfStockItems = [];
       
        for (let cartItem of findUser.cart) {
            const product = await Product.findById(cartItem.productId);
            if (!product || product.quantity < cartItem.quantity) {
                outOfStockItems.push({
                    product: product || { name: "Unknown Product" },
                    requestedQuantity: cartItem.quantity,
                    availableQuantity: product ? product.quantity : 0
                });
            }
        }
        
        if (outOfStockItems.length > 0) {
            return res.render("cart", {
                message: "Some items in your cart are no longer available in the desired quantity. Please update your cart.",
                outOfStockItems, 
                user: findUser, 
                data,  
                grandTotal: 0   
            });
        }

        const desiredAddress = findAddress.address.find(
            (item) => item._id.toString() === addressId.toString()
        );

        let finalAmount = totalPrice;
        let discount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode });

            if (!coupon) {
                return res.status(404).json({ error: "Coupon not found" });
            }

            const today = new Date();
            if (today < coupon.createdOn || today > coupon.expiredOn) {
                return res.status(400).json({ error: "Coupon is not valid at this time" });
            }

            if (totalPrice < coupon.minimumPrice) {
                return res.status(400).json({ error: `Minimum purchase of ₹${coupon.minimumPrice} required` });
            }

            if (coupon.usedBy.includes(userId)) {
                return res.status(400).json({ error: "Coupon already used by this user" });
            }

            discount = coupon.offerPrice;
            finalAmount = totalPrice - discount;

            coupon.usedBy.push(userId);
            await coupon.save();
        }

        if (paymentMethod === 'wallet') {
            const userWallet = await Wallet.findOne({ userId });

            if (!userWallet || userWallet.balance < finalAmount) {
                return res.status(400).json({ error: "Insufficient wallet balance" });
            }

            userWallet.balance -= finalAmount;

            userWallet.transactions.push({
                type: "debit",
                amount: finalAmount,
                description: "Order Payment",
                orderId: null
            });

            await userWallet.save();
        }

        const orderedItems = await Promise.all(
            findUser.cart.map(async (cartItem) => {
                const product = await Product.findById(cartItem.productId);
                if (!product) {
                    throw new Error(`Product not found for ID: ${cartItem.productId}`);
                }
                return {
                    product: product._id,
                    quantity: cartItem.quantity,
                    price: product.salePrice,
                    productStatus: 'confirmed'
                };
            })
        );

        const newOrder = new Order({
            userId: userId,
            orderedItems: orderedItems,
            address: [desiredAddress],
            totalPrice: totalPrice,
            finalAmount: finalAmount,
            couponCode: couponCode ? couponCode : null, 
            discount: discount ? discount : 0, 
            payment: {
                method: paymentMethod,
                status: paymentMethod === 'cod' ? 'pending' : 'paid',
                razorpayDetails: paymentMethod === 'razorpay' ? {
                    paymentId: razorpayPaymentId,
                    orderId: razorpayOrderId,
                    signature: razorpaySignature
                } : null
            },
            status: paymentMethod === 'cod' ? 'pending' : 'confirmed',
            createdOn: Date.now()
        });

        const orderDone = await newOrder.save();

        if (paymentMethod === 'wallet') {
            await Wallet.updateOne(
                { userId },
                { $set: { "transactions.$[elem].orderId": orderDone._id } },
                { arrayFilters: [{ "elem.orderId": null }] }
            );
        }

        await User.updateOne({ _id: userId }, { $set: { cart: [] } });

        for (let item of orderedItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: -item.quantity } }
            );
        }

        res.json({
            success: true,
            order: orderDone,
            orderId: orderDone._id
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to place order",
            details: error.message
        });
    }
};
const getPendingOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId)
            .populate("orderedItems.product");  
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'This order is not pending payment'
            });
        }

        res.json({
            success: true,
            amount: order.finalAmount,
            addressId: order.address[0]._id,
            totalPrice: order.totalPrice,
            orderedItems: order.orderedItems,
            originalOrderId: order._id 
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get order details'
        });
    }
};
const createRazorpayOrder = async (req, res) => {
    try {
        const { amount,addressId, couponCode, totalPrice, finalAmount } = req.body;
        const userId = req.session.user;
        req.session.pendingOrder = {
            addressId,
            couponCode,
            totalPrice,
            finalAmount,
            userId
        };
        

        if (!amount || isNaN(amount)) {
            return res.status(400).json({ 
                error: 'Invalid amount',
                details: 'Amount must be a valid number'
            });
        }
        const findUser = await User.findById(userId);
        if (!findUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const outOfStockItems = [];
        for (let cartItem of findUser.cart) {
            const product = await Product.findById(cartItem.productId);
            if (!product || product.quantity < cartItem.quantity) {
                outOfStockItems.push({
                    product: product || { name: "Unknown Product" },
                    requestedQuantity: cartItem.quantity,
                    availableQuantity: product ? product.quantity : 0
                });
            }
        }

        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                error: "Some products in your cart are out of stock. Please update your cart.",
                outOfStockItems
            });
        }

        const amountInPaise = Math.round(amount);
 
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
        };


        const order = await razorpayInstance.orders.create(options);


        if (!order || !order.id) {
            throw new Error('Failed to create Razorpay order');
        }

        res.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to create order',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
const verifyPayment = async (req, res) => {

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId,originalOrderId ,couponCode,
        totalPrice,
        finalAmount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        try {
            const pendingOrder = await createPendingOrder(req.session.user, addressId);
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required payment fields',
                orderId: pendingOrder._id
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to create pending order' 
            });
        }
    }

    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const userAddress = await Address.findOne({ 
            userId, 
            "address._id": addressId 
        });
        if (!userAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }

        const selectedAddress = userAddress.address.find(
            addr => addr._id.toString() === addressId
        );

        const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (originalOrderId) {
            const existingOrder = await Order.findById(originalOrderId);
            
            if (!existingOrder) {
                return res.status(404).json({
                    success: false,
                    message: 'Original order not found'
                });
            }

            existingOrder.status = 'confirmed';
            existingOrder.payment = {
                method: 'razorpay',
                status: 'paid',
                razorpayDetails: {
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    signature: razorpay_signature
                }
            };

            existingOrder.orderedItems.forEach(item => {
                item.productStatus = 'confirmed';
            });

            const savedOrder = await existingOrder.save();

            for (let item of existingOrder.orderedItems) {
                await Product.findByIdAndUpdate(
                    item.product, 
                    { $inc: { quantity: -item.quantity } }
                );
            }

            return res.json({
                success: true,
                orderId: savedOrder._id
            });
        }

        const orderedItems = await Promise.all(
            user.cart.map(async (item) => {
                const product = await Product.findById(item.productId);
                if (!product) {
                    throw new Error(`Product not found for ID: ${item.productId}`);
                }
                return {
                    product: product._id,
                    quantity: item.quantity,
                    price: product.salePrice,
                    productStatus: isValid ? 'confirmed' : 'pending'
                };
            })
        );

        const totalPrice = orderedItems.reduce(
            (acc, item) => acc + (item.price * item.quantity), 
            0
        );
        const tax=totalPrice*0.12

        const orderData = {
            userId: userId,
            orderedItems: orderedItems,
            address: [selectedAddress],
            totalPrice: totalPrice,
            finalAmount,
            couponCode: couponCode,
            discount: Math.abs(totalPrice - (finalAmount-tax)),
            
            payment: {
                method: 'razorpay',
                status: isValid ? 'paid' : 'pending',
                razorpayDetails: {
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    signature: razorpay_signature
                }
            },
            status: isValid ? 'confirmed' : 'pending',
            createdOn: new Date()
        };

        let savedOrder;
        if (couponCode) {
            await Coupon.findOneAndUpdate(
                { name: couponCode },
                { $addToSet: { usedBy: pendingOrder.userId } }
            );
        }

        const existingPendingOrder = await Order.findOne({
            userId: userId,
            'payment.razorpayDetails.orderId': razorpay_order_id,
            status: 'pending'
        });

        if (existingPendingOrder) {
            existingPendingOrder.set(orderData);
            savedOrder = await existingPendingOrder.save();
        } else {
            const newOrder = new Order(orderData);
            savedOrder = await newOrder.save();
        }

        if (isValid) {
          
            await User.updateOne({ _id: userId }, { $set: { cart: [] } });
            for (let item of orderedItems) {
                await Product.findByIdAndUpdate(
                    item.product, 
                    { $inc: { quantity: -item.quantity } }
                );
            }
            return res.json({ 
                success: true, 
                orderId: savedOrder._id 
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed; order saved as pending',
                orderId: savedOrder._id
            });
        }
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to process payment verification', 
            details: error.message 
        });
    }
};
const createPendingOrder = async (req, res) => {
    try {
        let { addressId, discount, totalPrice, finalAmount } = req.body;
        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.cart || user.cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const orderedItems = await Promise.all(user.cart.map(async (item) => {
            const product = await Product.findById(item.productId);
            if (!product) {
                throw new Error(`Product not found for ID: ${item.productId}`);
            }
            return {
                product: product._id,
                quantity: item.quantity,
                price: product.salePrice,
                productStatus: 'pending'
            };
        }));

    
        totalPrice = orderedItems.reduce(
            (acc, item) => acc + (item.price * item.quantity),
            0
        );

        const userAddress = await Address.findOne({
            userId,
            "address._id": addressId
        });

        if (!userAddress) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const selectedAddress = userAddress.address.find(
            addr => addr._id.toString() === addressId
        );

        const finalAmountWithDiscount = totalPrice - discount;

        const orderData = {
            userId,
            orderedItems,
            address: [selectedAddress],
            totalPrice,
            finalAmount,
            discount:totalPrice-finalAmount,
            payment: {
                method: 'razorpay',
                status: 'pending',
                razorpayDetails: {}
            },
            status: 'pending',
            createdOn: new Date()
        };

        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();

        await User.updateOne({ _id: userId }, { $set: { cart: [] } });

        return res.json({
            success: true,
            orderId: savedOrder._id
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to create pending order',
            details: error.message
        });
    }
};


const wallletcheck = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ balance: user.wallet });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
}
const processWallet = async (req, res) => {
    try {
        const { amount, addressId } = req.body;
        const userId = req.session.user;
        const user = await User.findById(userId);

        if (user.wallet < amount) {
            return res.json({ success: false, message: 'Insufficient wallet balance' });
        }


        user.wallet -= amount;
        await user.save();


        const address = await Address.findById(addressId);

        if (!address) {
            return res.status(400).json({ success: false, message: "Address not found" });
        }


        const newOrder = new Order({
            userId: user._id,
            address: [address],
            finalAmount: amount,
            payment: { method: 'wallet', status: 'paid' },
            status: 'confirmed'
        });

        await newOrder.save();

        res.json({ success: true, newBalance: user.wallet, orderId: newOrder._id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



module.exports = { getCheckoutPage, getOrderDetailsPage, orderPlaced, getAllOrdersPage, cancelOrder, returnOrder, applyCoupon, verifyPayment, createRazorpayOrder, wallletcheck, processWallet,createPendingOrder ,getPendingOrderDetails,downloadInvoice,calcshipping};
