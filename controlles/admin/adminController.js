const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')


const pageerror = async(req,res)=>{
    res.render('admin-error')
}

const loadLogin = async (req, res) => {
    try {
        res.render('adminlogin');
    } catch (error) {
        console.error("Error rendering login page:", error.message);
        res.status(500).send("Unable to load the login page.");
    }
};


const login = async (req,res)=>{
    try {

        const {email,password}=req.body
        console.log(req.body)
        const admin=await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordsMatch = await bcrypt.compare(password,admin.password)
            if(passwordsMatch){
                req.session.admin = true
                return res.redirect('/admin')
            }else{
                return res.redirect('/adminlogin')
            }
        }else{
            return res.redirect('/adminlogin')
        }
        
    } catch (error) {

        console.log("login error",error)
        return res.redirect('/pageerror')
        
    }
}


const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin/login");
        }

        // Get total stats (all time)
        const totalStats = {
            totalOrders: await Order.countDocuments(),
            totalUsers: await User.countDocuments({ isAdmin: false }),
            totalRevenue: (await Order.aggregate([
                {
                    $match: { 
                        status: { 
                            $nin: ['Cancelled', 'Returned'] 
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { 
                            $sum: "$totalAmount" 
                        }
                    }
                }
            ]))[0]?.total || 0
        };

        // Get query parameters for filtering
        const { startDate, endDate, period } = req.query;
        let query = {};
        let dateQuery = {};

        // Handle date filtering
        if (startDate && endDate) {
            dateQuery = {
                orderDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else if (period) {
            const now = new Date();
            let periodStartDate;

            switch (period) {
                case 'day':
                    periodStartDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    periodStartDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    periodStartDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    periodStartDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    periodStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }

            dateQuery = {
                orderDate: {
                    $gte: periodStartDate,
                    $lte: new Date()
                }
            };
        } else {
            // Default to current month if no filter
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateQuery = {
                orderDate: {
                    $gte: startOfMonth,
                    $lte: now
                }
            };
        }

        query = { ...query, ...dateQuery };

        // Get filtered orders with populated product details
        const orders = await Order.find(query)
            .populate({
                path: 'items.productId',
                select: 'productName brand regularPrice price',
                match: { _id: { $ne: null } }
            })
            .sort({ orderDate: -1 })
            .lean();

        // Calculate summary statistics for filtered period
        let summary = {
            periodOrders: orders.length,
            totalAmount: 0,
            totalDiscount: 0,
            discountBreakdown: {
                couponDiscount: 0,
                count: 0
            },
            statusBreakdown: {
                Delivered: 0,
                Pending: 0,
                Processing: 0,
                Shipped: 0,
                Cancelled: 0,
                Returned: 0
            }
        };

        // Process orders
        orders.forEach(order => {
            // Calculate regular price for each order
            let regularPrice = 0;
            order.items.forEach(item => {
                if (item.productId) {
                    regularPrice += (item.productId.regularPrice || item.productId.price || 0) * item.quantity;
                }
            });
            order.regularPrice = regularPrice;

            // Update status count
            if (summary.statusBreakdown.hasOwnProperty(order.status)) {
                summary.statusBreakdown[order.status]++;
            }

            // Only include non-cancelled orders in financial calculations
            if (order.status !== 'Cancelled' && order.status !== 'Returned') {
                summary.totalAmount += order.totalAmount || 0;
                
                if (order.coupon && order.coupon.discountedAmount) {
                    summary.totalDiscount += order.coupon.discountedAmount;
                    summary.discountBreakdown.couponDiscount += order.coupon.discountedAmount;
                    summary.discountBreakdown.count++;
                }
            }
        });

        // Add total stats to summary
        summary = {
            ...summary,
            ...totalStats
        };

        // Prepare filters for template
        const filters = {
            startDate: startDate || '',
            endDate: endDate || '',
            period: period || ''
        };

        // Get the date range text for display
        let dateRangeText = '';
        if (startDate && endDate) {
            dateRangeText = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
        } else if (period) {
            dateRangeText = period === 'day' ? 'Last 24 Hours' :
                           period === 'week' ? 'Last 7 Days' :
                           period === 'month' ? 'Last 30 Days' :
                           period === 'year' ? 'Last 12 Months' : '';
        } else {
            dateRangeText = 'This Month';
        }

        res.render('dashboard', {
            title: 'Dashboard',
            orders,
            summary,
            filters,
            dateRangeText
        });

    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading dashboard'
        });
    }
};

const generateReport = async (req, res) => {
    try {
        console.log('Received report request:', req.body);
        
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 10;
        const { reportType, startDate, endDate, exportType } = req.body;

        // First check if we have any orders at all
        const totalOrdersInDb = await Order.countDocuments({});
        console.log('Total orders in database:', totalOrdersInDb);

        // Default query with no date filter
        let dateQuery = {};

        const now = new Date();
        console.log('Current time:', now);

        if (reportType && reportType !== 'all') {
            switch (reportType) {
                case 'daily': {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59, 999);
                    
                    dateQuery = {
                        createdOn: {
                            $gte: startOfDay,
                            $lte: endOfDay
                        }
                    };

                    console.log('Daily query range:', {
                        start: startOfDay.toISOString(),
                        end: endOfDay.toISOString()
                    });
                    break;
                }

                case 'weekly': {
                    const startOfWeek = new Date();
                    startOfWeek.setDate(now.getDate() - 7);
                    startOfWeek.setHours(0, 0, 0, 0);
                    
                    dateQuery = {
                        createdOn: {
                            $gte: startOfWeek,
                            $lte: now
                        }
                    };

                    console.log('Weekly query range:', {
                        start: startOfWeek.toISOString(),
                        end: now.toISOString()
                    });
                    break;
                }

                case 'yearly': {
                    const startOfYear = new Date();
                    startOfYear.setFullYear(now.getFullYear() - 1);
                    startOfYear.setHours(0, 0, 0, 0);
                    
                    dateQuery = {
                        createdOn: {
                            $gte: startOfYear,
                            $lte: now
                        }
                    };

                    console.log('Yearly query range:', {
                        start: startOfYear.toISOString(),
                        end: now.toISOString()
                    });
                    break;
                }

                case 'custom': {
                    if (startDate && endDate) {
                        const startDateTime = new Date(startDate);
                        startDateTime.setHours(0, 0, 0, 0);
                        const endDateTime = new Date(endDate);
                        endDateTime.setHours(23, 59, 59, 999);
                        
                        dateQuery = {
                            createdOn: {
                                $gte: startDateTime,
                                $lte: endDateTime
                            }
                        };

                        console.log('Custom query range:', {
                            start: startDateTime.toISOString(),
                            end: endDateTime.toISOString()
                        });
                    }
                    break;
                }
            }
        }

        console.log('Using date query:', JSON.stringify(dateQuery, null, 2));

        // Get a sample order to check its structure
        const sampleOrder = await Order.findOne().lean();
        console.log('Sample order structure:', JSON.stringify(sampleOrder, null, 2));

        // Count orders matching the query
        const totalOrders = await Order.countDocuments(dateQuery);
        console.log('Orders matching query:', totalOrders);

        if (totalOrders === 0) {
            return res.json({
                success: true,
                summary: {
                    totalSales: 0,
                    totalAmount: 0,
                    totalDiscounts: 0,
                    netSales: 0
                },
                details: [],
                pagination: {
                    page: 1,
                    limit,
                    totalPages: 0,
                    totalItems: 0,
                    hasNextPage: false,
                    hasPrevPage: false,
                    startIndex: 0,
                    endIndex: 0
                }
            });
        }

        // Calculate pagination
        const totalPages = Math.ceil(totalOrders / limit);
        const skip = (page - 1) * limit;

        // Get orders based on whether it's for export or display
        let orders;
        if (exportType === 'excel' || exportType === 'pdf') {
            // Get all orders for export without pagination
            orders = await Order.find(dateQuery)
                .populate('userId', 'name email')
                .populate('orderedItems.product', 'name Regular_price Sale_price')
                .sort({ createdOn: -1 })
                .lean();
        } else {
            // Get paginated orders for display
            orders = await Order.find(dateQuery)
                .populate('userId', 'name email')
                .populate('orderedItems.product', 'name Regular_price Sale_price')
                .sort({ createdOn: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
        }

        // console.log(`Retrieved ${orders.length} orders`);
        if (orders.length > 0) {
            console.log('Sample processed order:', orders[0]);
        }

        // Calculate summary from all orders (not just paginated ones)
        const summary = {
            totalSales: totalOrders,
            totalAmount: 0,
            totalDiscounts: 0,
            netSales: 0
        };

        orders.forEach(order => {
            summary.totalAmount += Number(order.totalPrice || 0);
            summary.totalDiscounts += Number(order.discount || 0);
            summary.netSales += Number(order.finalAmount || 0);
        });

        // Format summary numbers
        summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;
        summary.totalDiscounts = Math.round(summary.totalDiscounts * 100) / 100;
        summary.netSales = Math.round(summary.netSales * 100) / 100;

        // Process orders for display
        const details = orders.map(order => ({
            date: order.createdOn,
            orderId: order.orderId,
            customer: {
                name: order.userId?.name || 'N/A',
                email: order.userId?.email || 'N/A'
            },
            items: (order.orderedItems || []).map(item => ({
                name: item.product?.name || 'Product Not Found',
                quantity: Number(item.quantity || 1),
                price: Number(item.price || item.product?.Sale_price || item.product?.Regular_price || 0)
            })),
            amount: Number(order.totalPrice || 0),
            discount: Number(order.discount || 0),
            netAmount: Number(order.finalAmount || 0),
            paymentMethod: order.paymentMethod || 'COD',
            status: order.status || 'Pending'
        }));

        console.log('Sending response with details length:', details.length);

        res.json({
            success: true,
            summary,
            details,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: totalOrders,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limit, totalOrders)
            }
        });

    } catch (error) {
        console.error('Error in generateReport:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
};

const logout=async(req,res)=>{
    
    try{
        req.session.admin = false
        if (req.session.admin) {
            res.redirect('/admin')
        }else{
            return res.redirect('/admin/login')

        }

    }catch(error){
        console.log("unexpected error during logout",error)
        res.redirect('/pageerror')

    }
}



module.exports={
    loadLogin,
    login,
    loadDashboard,
    logout,
    pageerror,
    generateReport
}