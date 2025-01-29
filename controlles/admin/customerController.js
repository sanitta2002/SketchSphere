const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
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

        // Fetch users with pagination
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('customers', {
            data: users,
            currentPage: page,
            totalPages,
            searchQuery,
            admin: req.session.admin
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', { message: 'Failed to fetch users' });
    }
};

const CustomerBlocked = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        await User.findByIdAndUpdate(id, { isBlocked: true });
        
        return res.status(200).json({ 
            success: true, 
            message: 'User blocked successfully' 
        });
    } catch (error) {
        console.error('Error blocking user:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to block user' 
        });
    }
};

const CustomerunBlocked = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        await User.findByIdAndUpdate(id, { isBlocked: false });
        
        return res.status(200).json({ 
            success: true, 
            message: 'User unblocked successfully' 
        });
    } catch (error) {
        console.error('Error unblocking user:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to unblock user' 
        });
    }
};

module.exports = {
    customerInfo,
    CustomerBlocked,
    CustomerunBlocked
};