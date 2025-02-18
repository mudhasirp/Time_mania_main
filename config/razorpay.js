// config/razorpay.js
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // From .env
  key_secret: process.env.RAZORPAY_KEY_SECRET, // From .env
});

// Verify payment signature
const verifySignature = (orderId, paymentId, signature) => {
  console.log("working")
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
};

module.exports = {
  razorpayInstance,
  verifySignature,
};