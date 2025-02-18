const Order = require("../../models/orderSchema")
const PDFDocument = require("pdfkit");
const fs = require("fs");
const ExcelJS = require("exceljs");
const getSalesReport = async (req, res) => {
    try {
        const { page = 1, day, date } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;

        let query = {};
        let filterFlags = {
            salesToday: false,
            salesWeekly: false,
            salesMonthly: false,
            salesYearly: false
        };

        const setDateFilter = (daysBack = 0) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
            startDate.setHours(0, 0, 0, 0);
            return { $gte: startDate };
        };

        switch (day) {
            case 'salesToday':
                query.createdOn = setDateFilter(0);
                filterFlags.salesToday = true;
                break;
            case 'salesWeekly':
                query.createdOn = setDateFilter(7);
                filterFlags.salesWeekly = true;
                break;
            case 'salesMonthly':
                query.createdOn = setDateFilter(30);
                filterFlags.salesMonthly = true;
                break;
            case 'salesYearly':
                query.createdOn = setDateFilter(365);
                filterFlags.salesYearly = true;
                break;
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            query.createdOn = { $gte: startOfDay, $lte: endOfDay };
        }

        const orders = await Order.find(query)
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'name price'
            })
            .populate('userId', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ createdOn: -1 })
            .lean();

        const allOrders = await Order.find(query).lean();

        const salesMetrics = allOrders.reduce((acc, order) => ({
            totalOrders: acc.totalOrders + 1,
            totalSales: acc.totalSales + (order.totalPrice || 0),
            totalDiscounts: acc.totalDiscounts + (order.discount || 0),
            grandTotal: acc.grandTotal + (order.finalAmount || 0)
        }), {
            totalOrders: 0,
            totalSales: 0,
            totalDiscounts: 0,
            grandTotal: 0
        });

        const totalPages = Math.ceil(salesMetrics.totalOrders / limit);

        res.render('salesReport', {
            data: orders,
            currentPage: parseInt(page),
            totalPages,
            date,
            day,
            ...filterFlags,
            ...salesMetrics
        });

    } catch (error) {
        console.error('Sales Report Error:', error);
        res.status(500).render('error', {
            message: 'Failed to generate sales report',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

const filterSale = async (req, res) => {
    try {
        const { page = 1, day, date, startDate, endDate } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        let query = {};

        if (date) {
            const startOfDay = new Date(`${date}T00:00:00.000Z`);
            const endOfDay = new Date(`${date}T23:59:59.999Z`);
            query.createdOn = { $gte: startOfDay, $lte: endOfDay };
        } else if (startDate && endDate) {
            const startOfRange = new Date(`${startDate}T00:00:00.000Z`);
            const endOfRange = new Date(`${endDate}T23:59:59.999Z`);
            query.createdOn = { $gte: startOfRange, $lte: endOfRange };
        } else if (day) {
            let start = new Date();
            start.setHours(0, 0, 0, 0);
            let end = new Date();
            end.setHours(23, 59, 59, 999);

            switch (day) {
                case 'salesToday':
                    break;
                case 'salesWeekly':
                    start.setDate(start.getDate() - 7);
                    break;
                case 'salesMonthly':
                    start.setMonth(start.getMonth() - 1);
                    break;
                case 'salesYearly':
                    start.setFullYear(start.getFullYear() - 1);
                    break;
                default:
                    return res.status(400).render('error', { message: 'Invalid day filter' });
            }
            query.createdOn = { $gte: start, $lte: end };
        }

        console.log("Generated Query:", JSON.stringify(query, null, 2));

        const orders = await Order.find(query)
            .populate({ path: 'orderedItems.product', model: 'Product', select: 'name price' })
            .populate('userId', 'name email')
            .sort({ createdOn: -1 })
            .lean();

        console.log("Total Orders Found:", orders.length);

        console.log("Orders Found:", orders.length);
        console.log("First Order:", orders[0]);

        const totalOrders = await Order.countDocuments(query);

        const salesMetrics = orders.reduce((acc, order) => ({
            totalOrders: acc.totalOrders + 1,
            totalSales: acc.totalSales + (order.totalPrice || 0),
            totalDiscounts: acc.totalDiscounts + (order.discount || 0),
            grandTotal: acc.grandTotal + (order.finalAmount || 0)
        }), { totalOrders: 0, totalSales: 0, totalDiscounts: 0, grandTotal: 0 });

        const totalPages = Math.ceil(totalOrders / limit);

        res.render('salesReport', {
            data: orders,
            totalPages,
            date,
            startDate,
            endDate,
            day,
            currentPage: parseInt(page),
            salesToday: day === 'salesToday',
            salesWeekly: day === 'salesWeekly',
            salesMonthly: day === 'salesMonthly',
            salesYearly: day === 'salesYearly',
            ...salesMetrics
        });

    } catch (error) {
        console.error('Date Filter Error:', error);
        res.status(500).render('error', {
            message: 'Failed to filter sales by date',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
const getDateRange = (day) => {
    let start, end;
    const now = new Date();

    switch (day) {
        case "salesToday":
            start = new Date(now.setHours(0, 0, 0, 0));
            end = new Date(now.setHours(23, 59, 59, 999));
            break;
        case "salesWeekly":
            start = new Date();
            start.setDate(start.getDate() - 7);
            end = new Date();
            break;
        case "salesMonthly":
            start = new Date();
            start.setMonth(start.getMonth() - 1);
            end = new Date();
            break;
        case "salesYearly":
            start = new Date();
            start.setFullYear(start.getFullYear() - 1);
            end = new Date();
            break;
        default:
            return {};
    }

    return { createdOn: { $gte: start, $lte: end } };
};
const downloadPDF = async (req, res) => {
    try {
        console.log("📌 Full Request Query:", req.query);

        let { day, startDate, endDate } = req.query;
        let query = {};

        const today = new Date();
        let fromDate = null;
        let toDate = today;

        if (day === "salesToday") {
            fromDate = new Date();
        } else if (day === "salesWeekly") {
            fromDate = new Date();
            fromDate.setDate(today.getDate() - 7);
        } else if (day === "salesMonthly") {
            fromDate = new Date();
            fromDate.setMonth(today.getMonth() - 1);
        } else if (day === "salesYearly") {
            fromDate = new Date();
            fromDate.setFullYear(today.getFullYear() - 1);
        }

        if ((!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') && fromDate) {
            startDate = fromDate.toISOString().split("T")[0];
            endDate = toDate.toISOString().split("T")[0];

            console.log(`🔹 Auto-Setting Dates for ${day}: ${startDate} to ${endDate}`);
        }

        if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
            return res.status(400).json({ message: "Start date and end date are required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        query.createdOn = { $gte: start, $lte: end };

        console.log("📌 Filtering Orders Between:", start.toISOString(), "and", end.toISOString());
        console.log("📌 Final Query:", JSON.stringify(query, null, 2));

        const orders = await Order.find(query).populate('userId', 'name email').sort({ createdOn: -1 }).lean();

        console.log(`✅ Total Orders Found: ${orders.length}`);

        if (orders.length === 0) {
            return res.status(404).json({ message: "No orders found for the selected date range." });
        }
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=salesReport.pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.moveDown(1);

        orders.forEach((order, index) => {
            const userName = order.userId?.name || "Unknown User";
            const userEmail = order.userId?.email || "N/A";

            doc.fontSize(14).text(`${index + 1}. Order ID: ${order.orderId}`, { underline: true });
            doc.text(`User: ${userName} (${userEmail})`);
            doc.text(`Total: ₹${order.finalAmount}`);
            doc.text(`Discount: ₹${order.discount || 0}`);
            doc.text(`Order Date: ${order.createdOn.toDateString()}`);
            doc.moveDown(0.5);

            doc.fontSize(12).text(`Ordered Items:`);

            if (!Array.isArray(order.orderedItems) || order.orderedItems.length === 0) {
                doc.text("   No items in this order.");
            } else {
                order.orderedItems.forEach((item, idx) => {
                    doc.text(`   ${idx + 1}. ${item.product?.name || "Unknown Product"} - ₹${item.product?.price || 0} x ${item.quantity}`);
                });
            }

            doc.moveDown(1);
        });

        doc.end();
    } catch (error) {
        console.error("❌ PDF Download Error:", error);
        res.status(500).json({ message: "Error generating PDF" });
    }
};

const downloadExcel = async (req, res) => {
    try {
        console.log("📌 Full Request Query:", req.query);

        let { day, startDate, endDate } = req.query;
        let query = {};

        const today = new Date();
        let fromDate = null;
        let toDate = today;

        if (day === "salesToday") {
            fromDate = new Date();
        } else if (day === "salesWeekly") {
            fromDate = new Date();
            fromDate.setDate(today.getDate() - 7);
        } else if (day === "salesMonthly") {
            fromDate = new Date();
            fromDate.setMonth(today.getMonth() - 1);
        } else if (day === "salesYearly") {
            fromDate = new Date();
            fromDate.setFullYear(today.getFullYear() - 1);
        }

        if ((!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') && fromDate) {
            startDate = fromDate.toISOString().split("T")[0];
            endDate = toDate.toISOString().split("T")[0];

            console.log(`🔹 Auto-Setting Dates for ${day}: ${startDate} to ${endDate}`);
        }

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Start date and end date are required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        query.createdOn = { $gte: start, $lte: end };

        console.log("📌 Filtering Orders Between:", start.toISOString(), "and", end.toISOString());

        const orders = await Order.find(query)
            .populate({ path: "orderedItems.product", model: "Product", select: "name price" })
            .populate("userId", "name email")
            .sort({ createdOn: -1 })
            .lean();

        console.log(`✅ Total Orders Found: ${orders.length}`);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for the selected date range." });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        worksheet.columns = [
            { header: "Order ID", key: "orderId", width: 20 },
            { header: "User Name", key: "userName", width: 20 },
            { header: "User Email", key: "userEmail", width: 25 },
            { header: "Total Amount", key: "finalAmount", width: 15 },
            { header: "Discount", key: "discount", width: 15 },
            { header: "Order Date", key: "createdOn", width: 20 },
            { header: "Product Name", key: "productName", width: 25 },
            { header: "Price", key: "productPrice", width: 15 },
            { header: "Quantity", key: "quantity", width: 10 }
        ];

        orders.forEach(order => {
            if (!Array.isArray(order.orderedItems) || order.orderedItems.length === 0) {
                worksheet.addRow({
                    orderId: order.orderId,
                    userName: order.userId?.name || "Unknown User",
                    userEmail: order.userId?.email || "N/A",
                    finalAmount: order.finalAmount,
                    discount: order.discount || 0,
                    createdOn: order.createdOn.toDateString(),
                    productName: "No Items",
                    productPrice: "-",
                    quantity: "-"
                });
            } else {
                order.orderedItems.forEach(item => {
                    worksheet.addRow({
                        orderId: order.orderId,
                        userName: order.userId?.name || "Unknown User",
                        userEmail: order.userId?.email || "N/A",
                        finalAmount: order.finalAmount,
                        discount: order.discount || 0,
                        createdOn: order.createdOn.toDateString(),
                        productName: item.product?.name || "Unknown Product",
                        productPrice: item.product?.price || 0,
                        quantity: item.quantity
                    });
                });
            }
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=salesReport.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("❌ Excel Download Error:", error);
        res.status(500).json({ message: "Error generating Excel report" });
    }
};



module.exports = {
    getSalesReport, filterSale, downloadPDF, downloadExcel
}