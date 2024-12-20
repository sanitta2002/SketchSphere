const User = require('../../models/userSchema')

const customerInfo = async(req,res)=>{
    try {

        let search="";
        if(req.query.search){
            search=req.query.search
        }

        let page=1;
        if(req.query.page){
            page=req.query.page
        }
        const limit=3
        const userData= await User.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],          
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()
        const count=await User.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ], 

        }).countDocuments();
        res.render("customers", {
            data: userData,
            totalpages: Math.ceil(count / limit), 
            currentPage: page, 
            searchTerm: search, 
        });
        
    } catch (error) {
        res.redirect('/pageerror')
        
    }
}

const CustomerBlocked = async (req,res) => {
    try {
        const id = req.query.id;
        await User.findByIdAndUpdate(id, { isBlocked: true });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error blocking customer:", error);
        res.status(500).json({ success: false, error: 'Failed to block customer' });
    }
}

const CustomerunBlocked = async (req,res) => {
    try {
        const id = req.query.id;
        await User.findByIdAndUpdate(id, { isBlocked: false });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error unblocking customer:", error);
        res.status(500).json({ success: false, error: 'Failed to unblock customer' });
    }
}


module.exports={
    customerInfo,
    CustomerBlocked,
    CustomerunBlocked

}