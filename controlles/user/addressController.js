const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const mongoose = require('mongoose')

const loadAddAddress = async (req, res) => {
    try {
        res.render('add-Address')
    } catch (error) {
        console.log(error)
    }
}

const addAddress = async (req, res) => {
    
    try {
        console.log(req.body)

        const userId = req.session.user;
        

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to add address'
            });
        }

        const {
            name,
            phone,
            addressType,
            landMark,
            city,
            state,
            pincode
        } = req.body;

        // Validate required fields
        if (!name || !phone || !addressType || !landMark || !city || !state || !pincode) {
            
            return res.status(400).json({
                success: false,
                message: 'Please fill all required fields'
            });
        }

        // Validate phone number
        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Validate pincode
        if (!/^[0-9]{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit pincode'
            });
        }

        // Find existing address document for user or create new one
        let userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            userAddress = new Address({
                userId: userId,
                address: []
            });
        }

        // Add new address to array
        const newAddress = {
            name,
            phone,
            addressType,
            landMark,
            city,
            state,
            pincode: parseInt(pincode)
        };

       
        userAddress.address.push(newAddress);

        await userAddress.save();
        console.log('Address saved successfully');
        res.status(200).json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add address',
            error: error.message
        });
    }
};

const getUserAddresses = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to view addresses'
            });
        }

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
            return res.json({ addresses: [] });
        }

        res.json({ addresses: userAddress.address });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
    }
};

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const index = parseInt(req.params.index);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to edit address'
            });
        }

        const {
            name,
            phone,
            addressType,
            landMark,
            city,
            state,
            pincode
        } = req.body;

        // Validate required fields
        if (!name || !phone || !addressType || !landMark || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: 'Please fill all required fields'
            });
        }

        // Validate phone number
        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Validate pincode
        if (!/^[0-9]{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit pincode'
            });
        }

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress || !userAddress.address[index]) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Update the address at the specified index
        userAddress.address[index] = {
            name,
            phone,
            addressType,
            landMark,
            city,
            state,
            pincode: parseInt(pincode)
        };

        await userAddress.save();
        res.status(200).json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        console.error('Error editing address:', error);
        res.status(500).json({ success: false, message: 'Failed to edit address' });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const index = parseInt(req.params.index);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to delete address'
            });
        }

        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress || !userAddress.address[index]) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Remove the address at the specified index
        userAddress.address.splice(index, 1);
        await userAddress.save();

        res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, message: 'Failed to delete address' });
    }
};

module.exports = {
    loadAddAddress,
    addAddress,
    getUserAddresses,
    editAddress,
    deleteAddress
};
