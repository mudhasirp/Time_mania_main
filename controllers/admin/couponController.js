const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose")
const loadCoupon = async (req, res) => {
    try {
        const findCoupons = await Coupon.find({})
        return res.render("coupon", {
            coupons: findCoupons
        })

    } catch (error) {
        return res.redirect("/pageerror")
    }
}
const createCoupon = async (req, res) => {
    try {
        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate + "T00:00:00"),
            endDate: new Date(req.body.endDate + "T00:00:00"),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice)
        };

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expiredOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice
        });

        await newCoupon.save();
        return res.redirect("/admin/coupon");
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.redirect("/pageerror");
    }
};
const editCoupon = async (req, res) => {
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({ _id: id })
        res.render("edit-coupon",
            {
                findCoupon: findCoupon
            }
        )
    } catch (error) {
        res.redirect("/pageerror")
    }
}
const updateCoupon = async (req, res) => {
    try {
        const couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);

        const selectedCoupon = await Coupon.findOne({ _id: oid });

        if (selectedCoupon) {
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);

            const updatedCoupon = await Coupon.findOneAndUpdate(
                { _id: oid },
                {
                    $set: {
                        name: req.body.couponName,
                        createdOn: startDate,
                        expiredOn: endDate,
                        offerPrice: parseInt(req.body.offerPrice),
                        minimumPrice: parseInt(req.body.minimumPrice),
                    },
                },
                { new: true }
            );

            if (updatedCoupon) {
                res.send("Coupon updated successfully");
            } else {
                res.status(500).send("Coupon update failed");
            }
        } else {
            res.status(404).send("Coupon not found");
        }
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.redirect("/pageerror");
    }
};
const deleteCoupon = async (req, res) => {
    try {
        const id = req.query.id;
        await Coupon.deleteOne({ _id: id })
        res.status(200).send({ success: true, message: "Coupon deleted successfully" })
    } catch (error) {
        console.log(error)
    }
}
module.exports = {
    loadCoupon, createCoupon, editCoupon, updateCoupon, deleteCoupon
}