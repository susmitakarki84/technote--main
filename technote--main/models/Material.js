
const mongoose = require('mongoose');

const Material = mongoose.model('Material', new mongoose.Schema({
    title: String,
    type: String,
    semester: String,
    subject: String,
    description: String,
    fileName: String,
    fileUrl: String,
    uploadedAt: { type: Date, default: Date.now }
}));

module.exports = Material;
