const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Serve static HTML files
app.use(express.static(path.join(__dirname, '.')));

const AuthUser = require('./models/AuthUser');
const Material = require('./models/Material');
const UserUpload = require('./models/UserUpload');
const authMiddleware = require('./middleware/auth');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

// ============= AUTH ROUTES =============

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        const user = await AuthUser.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is locked out
        const now = new Date();
        if (user.lockUntil && now < user.lockUntil) {
            const timeLeft = Math.ceil((user.lockUntil - now) / 1000); // in seconds
            return res.status(429).json({
                success: false,
                message: `Account locked. Please try again in ${timeLeft} seconds.`,
                lockoutTime: timeLeft,
                isLocked: true
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            // Increment login attempts
            user.loginAttempts += 1;

            // Lockout after 5 failed attempts with exponential backoff
            if (user.loginAttempts >= 5) {
                const attemptCount = Math.floor((user.loginAttempts - 1) / 5); // 0 for first 5 attempts, 1 for next 5, etc.
                const baseLockTime = 300; // 5 minutes for first lockout
                const lockSeconds = baseLockTime * Math.pow(2, attemptCount); // Double lock time each time
                user.lockUntil = new Date(now.getTime() + lockSeconds * 1000);
            }

            await user.save();

            // Calculate remaining attempts
            const remainingAttempts = Math.max(0, 5 - (user.loginAttempts % 5 || 5));
            let message = 'Invalid email or password';
            if (remainingAttempts <= 2) {
                message += ` - ${remainingAttempts} attempts remaining`;
            }

            return res.status(401).json({
                success: false,
                message: message,
                remainingAttempts: remainingAttempts,
                isLocked: !!user.lockUntil,
                lockoutTime: user.lockUntil ? Math.ceil((user.lockUntil - now) / 1000) : null
            });
        }

        // Reset login attempts on successful login
        user.loginAttempts = 0;
        user.lockUntil = null;
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { email, password, role = 'user' } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        const existingUser = await AuthUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new AuthUser({
            email,
            password: hashedPassword,
            role
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            role: user.role
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============= MATERIAL UPLOAD ROUTE (Protected) =============

app.post('/upload-material', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, type, semester, subject, description } = req.body;

        // Validate required fields
        if (!title || !type || !semester || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF file'
            });
        }

        // Upload to imgbb
        const formData = new FormData();
        formData.append('image', req.file.buffer.toString('base64'));

        const imgbbResponse = await axios.post(
            `https://api.imgbb.com/1/upload?key=${process.env.IMG_BB_KEY}`,
            formData,
            {
                headers: formData.getHeaders()
            }
        );

        const fileUrl = imgbbResponse.data.data.url;

        // Create new user upload with uploader info
        const userUpload = new UserUpload({
            title,
            type,
            semester,
            subject,
            description,
            fileName: req.file.originalname,
            fileUrl: fileUrl,
            uploaderEmail: req.user.email,
            uploaderId: req.user.userId,
            status: 'pending' // Default status is pending
        });

        await userUpload.save();

        res.status(201).json({
            success: true,
            message: 'Material uploaded successfully and is pending approval',
            material: {
                id: userUpload._id,
                title: userUpload.title,
                status: userUpload.status,
                uploaderEmail: userUpload.uploaderEmail
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading material'
        });
    }
});

// ============= GET MY UPLOADS (Protected) =============

app.get('/my-materials', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get all materials from both collections with all statuses
        const [userUploads, materials] = await Promise.all([
            UserUpload.find({
                uploaderId: req.user.userId
            }).sort({ uploadedAt: -1 }),
            Material.find({
                uploaderId: req.user.userId
            }).sort({ uploadedAt: -1 })
        ]);

        // Combine and sort all materials
        const allMaterials = [...userUploads, ...materials].sort((a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

        // Apply pagination
        const paginatedMaterials = allMaterials.slice(skip, skip + limit);
        const totalCount = allMaterials.length;
        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            data: paginatedMaterials,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching my materials:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching materials'
        });
    }
});

// ============= UPDATE MATERIAL (Protected - Only Owner) =============

app.put('/materials/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, type, semester, subject, description } = req.body;

        // Find user upload
        const userUpload = await UserUpload.findById(id);

        if (!userUpload) {
            return res.status(404).json({
                success: false,
                message: 'Material not found'
            });
        }

        // Check if user is the owner
        if (userUpload.uploaderId.toString() !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this material'
            });
        }

        // Update fields
        if (title) userUpload.title = title;
        if (type) userUpload.type = type;
        if (semester) userUpload.semester = semester;
        if (subject) userUpload.subject = subject;
        if (description !== undefined) userUpload.description = description;

        await userUpload.save();

        res.json({
            success: true,
            message: 'Material updated successfully',
            material: userUpload
        });

    } catch (error) {
        console.error('Error updating material:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating material'
        });
    }
});

// ============= DELETE MATERIAL (Protected - Only Owner) =============

app.delete('/materials/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find user upload
        const userUpload = await UserUpload.findById(id);

        if (!userUpload) {
            return res.status(404).json({
                success: false,
                message: 'Material not found'
            });
        }

        // Check if user is the owner
        if (userUpload.uploaderId.toString() !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this material'
            });
        }

        await UserUpload.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Material deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting material:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting material'
        });
    }
});

// ============= GET ALL APPROVED MATERIALS (Public) =============

app.get('/materials', async (req, res) => {
    try {
        const semester = req.query.semester;
        const materialFilter = semester ? { semester: semester } : {}; // Material collection has no status field
        const userUploadFilter = { status: 'approved' }; // UserUpload collection has status field

        if (semester) {
            userUploadFilter.semester = semester;
        }

        // Get materials from both collections
        const [materialsFromMaterial, materialsFromUserUpload] = await Promise.all([
            Material.find(materialFilter).sort({ uploadedAt: -1 }),
            UserUpload.find(userUploadFilter).sort({ uploadedAt: -1 })
        ]);

        // Combine and sort all materials
        const allMaterials = [...materialsFromMaterial, ...materialsFromUserUpload].sort((a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

        res.json(allMaterials);

    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching materials'
        });
    }
});

// ============= GET SINGLE MATERIAL BY ID =============

app.get('/materials/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid material ID'
            });
        }

        const material = await UserUpload.findById(id);

        if (!material) {
            return res.status(404).json({
                success: false,
                message: 'Material not found'
            });
        }

        res.json({
            success: true,
            data: material
        });

    } catch (error) {
        console.error('Error fetching material:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching material'
        });
    }
});

// ============= ADMIN: APPROVE/REJECT MATERIAL =============

app.patch('/materials/:id/status', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can approve/reject materials'
            });
        }

        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: approved, rejected, or pending'
            });
        }

        const userUpload = await UserUpload.findByIdAndUpdate(
            id,
            { status: status },
            { new: true }
        );

        if (!userUpload) {
            return res.status(404).json({
                success: false,
                message: 'Material not found'
            });
        }

        res.json({
            success: true,
            message: `Material ${status} successfully`,
            material: userUpload
        });

    } catch (error) {
        console.error('Error updating material status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating material status'
        });
    }
});

// ============= ADMIN: GET ALL MATERIALS (Including Pending) =============

app.get('/admin/materials', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const status = req.query.status; // pending, approved, rejected
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        let filter = {};
        if (status) {
            filter.status = status;
        }

        const materials = await UserUpload.find(filter)
            .sort({ uploadedAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCount = await UserUpload.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            data: materials,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalCount,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        console.error('Error fetching admin materials:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching materials'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});