const mongoose = require('mongoose');

const AuthUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        
        required: false 
    },
   
    name: {
        type: String
    },
    profilePicture: {
        type: String
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'user'],
        default: 'user',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    }
});

const AuthUser = mongoose.model('AuthUser', AuthUserSchema);

module.exports = AuthUser;