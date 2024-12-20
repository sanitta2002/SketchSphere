// const multer = require('multer')
// const path= require('path')

// const storage = multer.diskStorage({
//     destination:(req,file,cb)=>{
//         cb(null,path.join(__dirname,"../public/uploads/re-image"))
//     },
//     filename:(req,file,cb)=>{
//         cb(null,Date.now()+"-"+fileLoader.originalname)
//     }
// })

// module.exports=storage

// const multer = require("multer")
// const path = require("path");

// const storage = multer.diskStorage({
//     destination:(req,file,cb)=>{
//         cb(null,path.join(__dirname,"../public/uploads/re-image"))
//     },
//     filename:(req,file,cb)=>{
//         cb(null,Date.now()+"-"+File.originalname+".jpg");
//     }
// })

const multer = require('multer');
const path = require('path');

// Set up storage
const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
               cb(null,path.join(__dirname,"../public/uploads/re-image"))
          },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

// Multer middleware
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/; // Allowed file types
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed!'));
        }
    },
}).fields([{ name: 'productName', maxCount: 5 }]); // Match field name from the form


module.exports=storage;