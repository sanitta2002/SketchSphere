const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order.orderId}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add company logo and header
        doc.fontSize(20).text('SketchSphere', { align: 'center' });
        doc.fontSize(12).text('Your Art Supply Store', { align: 'center' });
        doc.moveDown();

        // Add a line separator
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        doc.moveDown();

        // Add invoice details
        doc.fontSize(14).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Invoice Date: ${new Date(order.createdOn).toLocaleDateString()}`);
        doc.text(`Order ID: ${order.orderId}`);
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.moveDown();

        // Add customer details
        doc.fontSize(12).text('Bill To:');
        doc.fontSize(10)
           .text(order.address.name)
           .text(order.address.landMark)
           .text(`${order.address.city}, ${order.address.state} ${order.address.pincode}`)
           .text(`Phone: ${order.address.phone}`);
        doc.moveDown();

        // Add items table
        const tableTop = doc.y;
        doc.fontSize(10);

        // Add table headers
        doc.text('Item', 50, tableTop)
           .text('Quantity', 250, tableTop)
           .text('Price', 350, tableTop)
           .text('Total', 500, tableTop);

        // Add a line below headers
        doc.moveTo(50, doc.y + 5)
           .lineTo(550, doc.y + 5)
           .stroke();

        let tableY = doc.y + 15;

        // Add items with proper price calculations
        order.orderedItems.forEach(item => {
            const itemPrice = item.price || 0;  // Handle undefined price
            const itemTotal = itemPrice * item.quantity;
            
            doc.text(item.product.name, 50, tableY)
               .text(item.quantity.toString(), 250, tableY)
               .text(`₹${itemPrice}`, 350, tableY)
               .text(`₹${itemTotal}`, 500, tableY);
            tableY += 20;
        });

        // Add a line after items
        doc.moveTo(50, tableY)
           .lineTo(550, tableY)
           .stroke();
        
        tableY += 20;

        // Add totals
        doc.text('Subtotal:', 350, tableY)
           .text(`₹${order.totalPrice}`, 500, tableY);
        tableY += 20;

      

        doc.fontSize(12)
           .text('Final Amount:', 350, tableY)
           .text(`₹${order.finalAmount}`, 500, tableY);

        // Add footer
        doc.fontSize(10)
           .text('Thank you for shopping with SketchSphere!', 50, 700, { align: 'center' })
           .text('For any queries, please contact support@sketchsphere.com', { align: 'center' });

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Failed to generate invoice' });
    }
};

module.exports = {
    generateInvoice
};
