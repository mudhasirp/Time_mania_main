const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        productStatus: {
            type: String,
            enum: ["confirmed", "processing", "shipped", "delivered", "cancelled", "return-requested", "returned","pending"],
            default: "confirmed"
        },
    }],
    address: [{
        name: String,
        phone: String,
        landMark: String,
        city: String,
        state: String,
        addressType: String,
        pincode: String
    }],
    totalPrice: Number,
    finalAmount: Number,
    couponCode: {
        type: String,
        default: null
    },
    discount: {
        type: Number,
        default: 0
    },
    payment: {
        method: {
            type: String,
            enum: ["cod", "razorpay","wallet"],
            default: "cod"
        },
        status: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded", "processing", "Processing"], // Added "Processing"
            default: "pending"
        },
        razorpayDetails: {
            paymentId: String,
            orderId: String,
            signature: String
        }
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "return-requested", "returned", "Processing","paid","completed"], // Added "Processing"
        default: "pending"
    },
    refundDetails: {
        amount: { type: Number, default: 0 },
        razorpayRefundId: String,
        initiatedAt: Date,
        completedAt: Date,
        status: {
            type: String,
            enum: ["pending", "processed", "failed"],
            default: "pending"
        }
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    updatedOn: {
        type: Date,
        default: Date.now
    }, returnReason: {
        type: String, // Save the return reason here
        required: false
      },
      deliveredAt: {
        type: Date
      },
});


orderSchema.pre('save', function(next) {
    this.updatedOn = new Date();
    next();
});
orderSchema.virtual('activeProductsTotal').get(function() {
    return this.orderedItems.reduce((total, item) => {
      return item.productStatus !== 'cancelled' 
        ? total + (item.quantity * item.price)
        : total;
    }, 0);
  });
  
  orderSchema.set('toJSON', { virtuals: true });
  orderSchema.set('toObject', { virtuals: true });
const Order = mongoose.model("Order", orderSchema);
module.exports = Order;


