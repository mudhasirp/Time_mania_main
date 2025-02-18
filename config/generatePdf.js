const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const generatePdf = (orders) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });
        
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Title
        doc.fontSize(24)
           .text('Sales Report', {
               align: 'center'
           });
        doc.moveDown(2);

        // Define column positions and widths
        const columns = {
            orderId: { x: 50, width: 250 },
            date: { x: 300, width: 100 },
            customer: { x: 400, width: 100 },
            amount: { x: 500, width: 100 },
            status: { x: 600, width: 100 }
        };

        // Table Header
        doc.fontSize(12)
           .font('Helvetica-Bold');
        
        doc.text('Order ID', columns.orderId.x, doc.y);
        doc.text('Date', columns.date.x, doc.y);
        doc.text('Customer', columns.customer.x, doc.y);
        doc.text('Amount', columns.amount.x, doc.y);
        doc.text('Status', columns.status.x, doc.y);

        doc.moveDown();
        
        // Add horizontal line after header
        doc.moveTo(50, doc.y)
           .lineTo(700, doc.y)
           .stroke();
        doc.moveDown();

        // Table Rows
        doc.font('Helvetica')
           .fontSize(10);

        orders.forEach((order, index) => {
            const currentY = doc.y;
            
            // Check if we need a new page
            if (currentY > 700) {
                doc.addPage();
            }

            // Print each column with proper positioning
            doc.text(order._id?.toString() || 'N/A', 
                columns.orderId.x, 
                doc.y,
                { width: columns.orderId.width });
                
            doc.text(order.createdOn?.toLocaleDateString() || 'N/A',
                columns.date.x,
                currentY,
                { width: columns.date.width });
                
            doc.text(order.userId?.name || 'N/A',
                columns.customer.x,
                currentY,
                { width: columns.customer.width });
                
            doc.text(`₹${order.finalAmount?.toLocaleString('en-IN') || '0'}`,
                columns.amount.x,
                currentY,
                { width: columns.amount.width });
                
            doc.text(order.status || 'N/A',
                columns.status.x,
                currentY,
                { width: columns.status.width });

            doc.moveDown(0.5);
        });

        // Footer
        doc.fontSize(8)
           .text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 50);

        doc.end();
    });
};
const generateExcel = async (orders) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add headers
    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Product', key: 'product', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Price', key: 'price', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Payment Method', key: 'payment', width: 20 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    // Add data rows
    if (orders && Array.isArray(orders)) {
        orders.forEach(order => {
            // Add a row for each ordered item
            if (order.orderedItems && Array.isArray(order.orderedItems)) {
                order.orderedItems.forEach(item => {
                    worksheet.addRow({
                        orderId: order._id?.toString() || 'N/A',
                        date: order.createdOn?.toLocaleDateString('en-IN') || 'N/A',
                        customer: order.userId?.name || 'N/A',
                        product: item.product?.name || 'N/A',
                        quantity: item.quantity || 0,
                        price: item.price || 0,
                        amount: (item.price || 0) * (item.quantity || 0),
                        discount: order.discount || 0,
                        payment: order.payment?.method || 'N/A',
                        status: order.status || 'N/A'
                    });
                });
            } else {
                // Add a row for orders without items
                worksheet.addRow({
                    orderId: order._id?.toString() || 'N/A',
                    date: order.createdOn?.toLocaleDateString('en-IN') || 'N/A',
                    customer: order.userId?.name || 'N/A',
                    product: 'No items',
                    quantity: 0,
                    price: 0,
                    amount: 0,
                    discount: order.discount || 0,
                    payment: order.payment?.method || 'N/A',
                    status: order.status || 'N/A'
                });
            }
        });
    }

    return workbook.xlsx.writeBuffer();
};




module.exports = {generatePdf,generateExcel}



