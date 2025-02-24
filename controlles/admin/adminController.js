const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const Category = require('../../models/categorySchema'); 


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

        // get all order for summary 
        const orders = await Order.find().populate('orderedItems.product');
        console.log('Total orders found:', orders.length);

        // Calculate summary 
        const summary = {
            totalAmount: 0,
            totalOrders: orders.length,
            totalProductsSold: 0,
            totalDiscount: 0
        };

        // Process orders for summary data
        orders.forEach(order => {
            let orderTotal = 0;
            let orderDiscount = 0;
            
            // Calculate total for non-cancelled and non-returned items
            order.orderedItems.forEach(item => {
                if (item.status !== 'Cancelled' && item.status !== 'Returned') {
                    const itemTotal = (item.price * item.quantity) || 0;
                    orderTotal += itemTotal;
                    summary.totalProductsSold += item.quantity || 0;
                }
            });

            // Only add to total if there are valid items
            if (orderTotal > 0) {
                summary.totalAmount += orderTotal;
                summary.totalDiscount += order.discount || 0;
            }
        });

        

        // Get sales data for the chart
        const salesData = await getSalesData('monthly');
        console.log('Sales data for chart:', salesData);

        // Get top products
        const topProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.status": { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$orderedItems.product",
                    name: { $first: "$productInfo.name" },
                    sales: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 10 }
        ]);

        // Get top categories
        const topCategories = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.status": { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productInfo.category_id",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $group: {
                    _id: "$categoryInfo._id",
                    name: { $first: "$categoryInfo.name" },
                    sales: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 5 }
        ]);

       

        res.render('dashboard', {
            summary,
            salesData,
            topProducts,
            topCategories
        });

    } catch (error) {
        console.error("Error in loadDashboard:", error);
        res.redirect('/admin/error');
    }
};

//  function to get sales data based on period
const getSalesData = async (period) => {
    const now = new Date();
    let startDate;
    let endDate = new Date(now);
    let groupByFormat;

    // Determine the start date and grouping format based on period
    switch(period) {
        case 'yearly':
            startDate = new Date(now.getFullYear() - 4, 0, 1); // Start from 5 years ago
            endDate.setHours(23, 59, 59, 999);
            groupByFormat = {
                $dateToString: { 
                    format: "%Y", 
                    date: "$createdOn"
                }
            };
            break;
        case 'monthly':
            // Calculate exact date 12 months ago
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 11);
            startDate.setDate(1); // First day of that month
            startDate.setHours(0, 0, 0, 0);

            // Set end date to end of current month
            endDate = new Date(now);
            endDate.setDate(1); // First set to first day of current month
            endDate.setMonth(endDate.getMonth() + 1); // Move to first day of next month
            endDate.setDate(0); // Move back to last day of current month
            endDate.setHours(23, 59, 59, 999);

            console.log('Monthly date range:', {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            });

            groupByFormat = {
                $dateToString: { 
                    format: "%Y-%m", 
                    date: "$createdOn"
                }
            };
            break;
        case 'weekly':
            // Calculate start date as 5 weeks ago from the current date
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - (7 * 4)); // Go back 4 weeks (plus current week = 5 weeks)
            startDate.setHours(0, 0, 0, 0);
            startDate.setMinutes(0, 0, 0);
            
            // Set end date to end of current day
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);

            

            // Use week-based format for grouping
            groupByFormat = {
                $dateToString: { 
                    format: "%Y-W%V", // Year and week number
                    date: "$createdOn"
                }
            };
            break;
        case 'daily':
            // Calculate date range for current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);

            

            groupByFormat = {
                $dateToString: { 
                    format: "%Y-%m-%d", // Full date for accurate grouping
                    date: "$createdOn"
                }
            };
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            endDate.setHours(23, 59, 59, 999);
            groupByFormat = {
                $dateToString: { 
                    format: "%Y-%m", 
                    date: "$createdOn"
                }
            };
    }

    try {
        console.log('Fetching sales data from:', startDate, 'to:', endDate);

        // First get the orders with their items
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdOn: { 
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            // Unwind ordered items to handle them individually
            {
                $unwind: "$orderedItems"
            },
            // Match only non-cancelled and non-returned items
            {
                $match: {
                    "orderedItems.status": { 
                        $nin: ['Cancelled', 'Returned']
                    }
                }
            },
            // Group by date and calculate totals only for valid items
            {
                $group: {
                    _id: {
                        date: groupByFormat,
                        orderId: "$_id" // Group by order ID to handle per-order calculations
                    },
                    itemTotal: {
                        $sum: {
                            $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
                        }
                    },
                    productCount: {
                        $sum: "$orderedItems.quantity"
                    }
                }
            },
            // Second group to get final totals per date
            {
                $group: {
                    _id: "$_id.date",
                    totalAmount: {
                        $sum: "$itemTotal"
                    },
                    productCount: {
                        $sum: "$productCount"
                    },
                    orderCount: { 
                        $sum: 1 
                    }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        

        // Generate date range
        const dates = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            let dateKey;
            
            switch(period) {
                case 'yearly':
                    dateKey = currentDate.getFullYear().toString();
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
                case 'monthly':
                    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                    dateKey = `${currentDate.getFullYear()}-${month}`;
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'weekly':
                    // Get ISO week number
                    const weekYear = currentDate.getFullYear();
                    const weekNum = getWeekNumber(currentDate);
                    dateKey = `${weekYear}-W${weekNum.toString().padStart(2, '0')}`;
                    // Move to next week
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'daily':
                    dateKey = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
            }
            
            if (dateKey) {
                dates.push(dateKey);
            }
        }

        // For daily view, ensure we have entries for all days 1-31
        if (period === 'daily') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            dates.length = daysInMonth; // Truncate or extend to match days in month
            
            // Fill any missing dates
            for (let i = 0; i < daysInMonth; i++) {
                if (!dates[i]) {
                    const day = (i + 1).toString().padStart(2, '0');
                    dates[i] = `${now.getFullYear()}-${(now.getMonth()).toString().padStart(2, '0')}-${day}`;
                }
            }
        }

        // Helper function to get ISO week number
        function getWeekNumber(d) {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        }

        // Format labels based on period
        const formatDate = (dateStr) => {
            switch(period) {
                case 'yearly':
                    return dateStr;
                case 'monthly':
                    const [year, month] = dateStr.split('-');
                    const date = new Date(year, parseInt(month) - 1);
                    const currentYear = new Date().getFullYear();
                    return date.getFullYear() === currentYear ? 
                        date.toLocaleDateString('en-US', { month: 'long' }) :
                        date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                case 'weekly':
                    // Parse the week string (format: YYYY-WNN)
                    const matches = dateStr.match(/(\d{4})-W(\d{2})/);
                    if (!matches) return dateStr;
                    
                    const [_, weekYear, weekNum] = matches;
                    const weekIndex = dates.indexOf(dateStr);
                    
                    // If it's the most recent week, show the month name
                    if (weekIndex === dates.length - 1) {
                        return new Date().toLocaleDateString('en-US', { month: 'long' });
                    }
                    // Otherwise show Week 1-4
                    return `Week ${weekIndex + 1}`;
                case 'daily':
                    // Show just the day number
                    // return parseInt(dateStr.split('-')[2]).toString();
                    const dayIndex = dates.indexOf(dateStr);
            return dayIndex !== -1 ? (dayIndex + 1).toString() : dateStr;
                default:
                    return dateStr;
            }
        };

        const result = {
            labels: dates.map(item => formatDate(item)),
            values: dates.map(date => {
                const dataPoint = salesData.find(item => item._id === date) || {
                    totalAmount: 0,
                    productCount: 0,
                    orderCount: 0
                };
                return dataPoint.totalAmount || 0;
            }),
            productCounts: dates.map(date => {
                const dataPoint = salesData.find(item => item._id === date) || {
                    totalAmount: 0,
                    productCount: 0,
                    orderCount: 0
                };
                return dataPoint.productCount || 0;
            })
        };

        console.log('Processed result:', result);
        return result;

    } catch (error) {
        console.error('Error aggregating sales data:', error);
        return {
            labels: [],
            values: [],
            productCounts: []
        };
    }
};

// Route handler for AJAX chart updates
const getSalesChartData = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const period = req.query.period || 'monthly';
        console.log('Fetching sales data for period:', period);
        
        const data = await getSalesData(period);
        console.log('Returning data:', data);
        
        res.json(data);
    } catch (error) {
        console.error("Error getting sales chart data:", error);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
};

const testData = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('orderedItems.product')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            orderCount: await Order.countDocuments(),
            recentOrders: orders.map(order => ({
                id: order._id,
                createdAt: order.createdAt,
                totalPrice: order.totalPrice,
                items: order.orderedItems.map(item => ({
                    product: item.product ? item.product.name : 'Unknown',
                    quantity: Number(item.quantity || 1),
                    price: Number(item.price || item.product?.Sale_price || item.product?.Regular_price || 0)
                }))
            }))
        });
    } catch (error) {
        console.error("Error in testData:", error);
        res.status(500).json({ error: error.message });
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

        

        // Get a sample order to check its structure
        const sampleOrder = await Order.findOne().lean();
        

        // Count orders matching the query
        const totalOrders = await Order.countDocuments(dateQuery);
        
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

const loadSalesReport=async(req,res)=>{
    try{
        res.render('salesReport')
        
    }catch(error){
        console.log("error in loadSalesReport",error)
        res.redirect('/pageerror')
    }
}

//  function to check orders
const testOrders = async (req, res) => {
    try {
        //  total order count
        const totalOrders = await Order.countDocuments();
        
        //  recent order
        const recentOrders = await Order.find()
            .populate('orderedItems.product')
            .sort({ createdAt: -1 })
            .limit(5);

        //  order counts by status
        const ordersByStatus = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $group: {
                    _id: "$orderedItems.status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            totalOrders,
            ordersByStatus,
            recentOrders: recentOrders.map(order => ({
                orderId: order.orderId,
                createdAt: order.createdAt,
                totalPrice: order.totalPrice,
                items: order.orderedItems.map(item => ({
                    product: item.product ? item.product.name : 'Unknown',
                    quantity: item.quantity,
                    price: item.price,
                    status: item.status
                }))
            }))
        });
    } catch (error) {
        console.error("Error in testOrders:", error);
        res.status(500).json({ error: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Items per page
        const skip = (page - 1) * limit;

        // Get search parameter
        const searchQuery = req.query.search || '';

        // Build filter query
        let query = { isAdmin: false }; // Exclude admin users
        
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { phone: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        // Calculate pagination values
        const hasPreviousPage = page > 1;
        const hasNextPage = page < totalPages;
        const previousPage = hasPreviousPage ? page - 1 : null;
        const nextPage = hasNextPage ? page + 1 : null;

        // Fetch users with pagination
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('customers', {
            data: users,
            currentPage: page,
            totalPages,
            hasPreviousPage,
            hasNextPage,
            previousPage,
            nextPage,
            searchQuery,
            admin: req.session.admin
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', { message: 'Failed to fetch users' });
    }
};

module.exports={
    loadLogin,
    login,
    loadDashboard,
    getSalesChartData,
    generateReport,
    logout,
    loadSalesReport,
    testOrders,
    pageerror,
    testData,
    getUsers
}