const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Wallet = require("../../models/walletSchema")
const getOrder = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filters = {};
        if (req.query.status) {
            filters.status = req.query.status;
        }
        if (req.query.startDate && req.query.endDate) {
            filters.createdOn = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }


        const orders = await Order.find(filters)
            .populate({
                path: 'userId',
                model: 'User',
                select: 'name email phone',
                options: {
                    strictPopulate: false
                }
            })
            .populate({
                path: 'orderedItems.product',
                select: 'productName',
                options: { strictPopulate: false }
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalOrders = await Order.countDocuments(filters);

        // Safe user name handling
        const safeOrders = orders.map(order => ({
            ...order,
            userName: order.userId ? order.userId.name : 'Unknown User',
            productName: order.orderedItems && order.orderedItems.length > 0
                ? order.orderedItems[0].product.productName
                : 'N/A'
        }));

        res.render('orders', {
            orders: safeOrders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders,
            filters: req.query
        });
    } catch (error) {
        console.error('Order Fetch Error:', error);

        res.status(500).render('admin/error', {
            message: 'Error fetching orders',
            error: {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : null
            }
        });
    }
};

const orderDetailsAdmin = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findById(orderId)
            .populate({
                path: 'userId',
                model: 'User',
                select: 'name email phone'
            })
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'productName productImage'
            })
            .lean();

        if (!order) {
            return res.status(404).render('admin/error', {
                message: 'Order not found'
            });
        }
        order.originalTotal = order.orderedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        order.cancelledTotal = order.orderedItems
            .filter(item => item.productStatus === 'cancelled')
            .reduce((acc, item) => acc + (item.quantity * item.price), 0);

        order.activeTotal = order.originalTotal - order.cancelledTotal;



        res.render('order-details', {
            order,
            title: `Order Details - ${order.orderId}`
        });

    } catch (error) {
        console.error('Order Details Error:', error);
        res.status(500).render('admin/error', {
            message: 'Error fetching order details',
            error: error
        });
    }
};
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, productId, reason } = req.body;


        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Order ID'
            });
        }

        const order = await Order.findById(orderId).populate('userId', 'wallet');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const validTransitions = {
            pending: ['processing', 'cancelled'],
            confirmed: ['processing', 'cancelled'],
            processing: ['shipped', 'cancelled'],
            shipped: ['delivered', 'return-requested'],
            delivered: ['return-requested', 'returned'],
            'return-requested': ['returned', 'delivered'],
            cancelled: []
        };


        if (!validTransitions[order.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from ${order.status} to ${status}`
            });
        }

        if (status === 'cancelled' && productId) {
            const product = order.orderedItems.find(
                item => item.product.toString() === productId && item.productStatus !== 'cancelled'
            );

            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: 'Product not found or already cancelled'
                });
            }

            product.productStatus = 'cancelled';
            product.cancellationReason = reason;
            product.cancelledAt = new Date();

            await Product.findByIdAndUpdate(
                productId,
                { $inc: { stock: product.quantity } }
            );

            const allCancelled = order.orderedItems.every(item => item.productStatus === 'cancelled');
            if (allCancelled) {
                order.status = 'cancelled';
            }
        } else {
            order.status = status;
            if (status === 'delivered') {
                order.deliveredAt = new Date();
            }
            if (!order.statusHistory) {
                order.statusHistory = [];
            }
            order.statusHistory.push({
                status,
                changedAt: new Date(),
                changedBy: req.user ? req.user.id : 'admin'
            });

            if (status === 'returned') {
                if (order.payment.method === 'wallet' || order.payment.method === 'razorpay') {
                    const refundAmount = order.finalAmount || order.totalPrice;

                    const wallet = await Wallet.findOneAndUpdate(
                        { userId: order.userId._id },
                        {
                            $inc: { balance: refundAmount },
                            $push: {
                                transactions: {
                                    type: 'credit',
                                    amount: refundAmount,
                                    description: `Refund for return (Order #${order.orderId})`,
                                    orderId: order._id,
                                    timestamp: new Date()
                                }
                            }
                        },
                        { upsert: true, new: true }
                    );

                    console.log('Wallet updated with refund:', wallet);
                }
            }

        }

        order.updatedAt = new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            message: `Order status updated to ${order.status}`,
            data: {
                orderId: order.orderId,
                newStatus: order.status,
                updatedItems: productId
                    ? order.orderedItems.filter(item => item.product.toString() === productId)
                    : order.orderedItems
            }
        });
    } catch (error) {
        console.error('Order Status Update Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


module.exports = {
    orderDetailsAdmin,
    getOrder,
    updateOrderStatus
};