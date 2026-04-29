const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // इमेल/पासवर्डको लागि
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library'); // गुगल लगइनको लागि
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

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

// ==========================================
// १. इमेल र पासवर्ड लगइन (पुरानो)
// ==========================================

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
        
        // यदि गुगलबाट बनेको अकाउन्ट हो र पासवर्ड छैन भने रोक्ने
        if (user && !user.password) {
             return res.status(401).json({ 
                 success: false, 
                 message: 'This account uses Google Login. Please click the Google button below.' 
             });
        }

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
                const attemptCount = Math.floor((user.loginAttempts - 1) / 5);
                const baseLockTime = 300; // 5 minutes
                const lockSeconds = baseLockTime * Math.pow(2, attemptCount);
                user.lockUntil = new Date(now.getTime() + lockSeconds * 1000);
            }

            await user.save();

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
            user: { email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { email, password, role = 'user' } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide both email and password' });
        }

        const existingUser = await AuthUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new AuthUser({
            email, password: hashedPassword, role
        });

        await user.save();

        res.status(201).json({ success: true, message: 'User registered successfully', role: user.role });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==========================================
// २. गुगल लगइन (नयाँ)
// ==========================================

app.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'No token provided' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let user = await AuthUser.findOne({ email });
        
        if (!user) {
            user = new AuthUser({
                email: email, role: 'user', name: name, profilePicture: picture
            });
            await user.save();
        }

        const now = new Date();
        if (user.lockUntil && now < user.lockUntil) {
            const timeLeft = Math.ceil((user.lockUntil - now) / 1000);
            return res.status(429).json({ success: false, message: `Account locked. Please try again in ${timeLeft} seconds.` });
        }

        const authToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET, { expiresIn: '7d' }
        );

        res.json({
            success: true, message: 'Login successful', token: authToken,
            user: { email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Google Login error:', error);
        res.status(401).json({ success: false, message: 'Invalid Google authentication' });
    }
});

// ==========================================
// ३. तपाईंका पुराना सबै API Routes जस्ताको तस्तै 
// ==========================================

// ============= MATERIAL UPLOAD ROUTE (Protected) =============
app.post('/upload-material', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, type, semester, subject, description } = req.body;

        if (!title || !type || !semester || !subject) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a PDF file' });
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const bucketName = process.env.SUPABASE_BUCKET || 'Tech note Org';
        
        const { data: supabaseData, error: supabaseError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, req.file.buffer, {
                contentType: 'application/pdf', upsert: false
            });

        if (supabaseError) {
            console.error('Supabase upload error:', supabaseError);
            return res.status(500).json({ success: false, message: 'Error uploading file to storage' });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(bucketName).getPublicUrl(fileName);

        const fileUrl = publicUrl;

        const userUpload = new UserUpload({
            title, type, semester, subject, description,
            fileName: req.file.originalname, fileUrl: fileUrl,
            uploaderEmail: req.user.email, uploaderId: req.user.userId,
            status: 'pending' 
        });

        await userUpload.save();

        res.status(201).json({
            success: true, message: 'Material uploaded successfully and is pending approval',
            material: { id: userUpload._id, title: userUpload.title, status: userUpload.status, uploaderEmail: userUpload.uploaderEmail }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Error uploading material' });
    }
});

// ============= GET MY UPLOADS (Protected) =============
app.get('/my-materials', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [userUploads, materials] = await Promise.all([
            UserUpload.find({ uploaderId: req.user.userId }).sort({ uploadedAt: -1 }),
            Material.find({ uploaderId: req.user.userId }).sort({ uploadedAt: -1 })
        ]);

        const allMaterials = [...userUploads, ...materials].sort((a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

        const paginatedMaterials = allMaterials.slice(skip, skip + limit);
        const totalCount = allMaterials.length;
        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true, data: paginatedMaterials,
            pagination: {
                currentPage: page, totalPages: totalPages, totalItems: totalCount, itemsPerPage: limit,
                hasNextPage: page < totalPages, hasPreviousPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching my materials:', error);
        res.status(500).json({ success: false, message: 'Error fetching materials' });
    }
});

// ============= UPDATE MATERIAL (Protected - Only Owner) =============
app.put('/materials/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, type, semester, subject, description } = req.body;

        const userUpload = await UserUpload.findById(id);

        if (!userUpload) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        if (userUpload.uploaderId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'You are not authorized to update this material' });
        }

        if (title) userUpload.title = title;
        if (type) userUpload.type = type;
        if (semester) userUpload.semester = semester;
        if (subject) userUpload.subject = subject;
        if (description !== undefined) userUpload.description = description;

        await userUpload.save();

        res.json({ success: true, message: 'Material updated successfully', material: userUpload });

    } catch (error) {
        console.error('Error updating material:', error);
        res.status(500).json({ success: false, message: 'Error updating material' });
    }
});

// ============= DELETE MATERIAL (Protected - Only Owner) =============
app.delete('/materials/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userUpload = await UserUpload.findById(id);

        if (!userUpload) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        if (userUpload.uploaderId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this material' });
        }

        await UserUpload.findByIdAndDelete(id);

        res.json({ success: true, message: 'Material deleted successfully' });

    } catch (error) {
        console.error('Error deleting material:', error);
        res.status(500).json({ success: false, message: 'Error deleting material' });
    }
});

// ============= GET ALL APPROVED MATERIALS (Public) =============
app.get('/materials', async (req, res) => {
    try {
        const semester = req.query.semester;
        const materialFilter = semester ? { semester: semester } : {}; 
        const userUploadFilter = { status: 'approved' }; 

        if (semester) {
            userUploadFilter.semester = semester;
        }

        const [materialsFromMaterial, materialsFromUserUpload] = await Promise.all([
            Material.find(materialFilter).sort({ uploadedAt: -1 }),
            UserUpload.find(userUploadFilter).sort({ uploadedAt: -1 })
        ]);

        const allMaterials = [...materialsFromMaterial, ...materialsFromUserUpload].sort((a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

        res.json(allMaterials);

    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching materials' });
    }
});

// ============= GET SINGLE MATERIAL BY ID =============
app.get('/materials/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid material ID' });
        }

        const material = await UserUpload.findById(id);

        if (!material) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        res.json({ success: true, data: material });

    } catch (error) {
        console.error('Error fetching material:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching material' });
    }
});


app.patch('/materials/:id/status', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admins can approve/reject materials' });
        }

        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be: approved, rejected, or pending' });
        }

        const userUpload = await UserUpload.findByIdAndUpdate(
            id, { status: status }, { new: true }
        );

        if (!userUpload) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        res.json({ success: true, message: `Material ${status} successfully`, material: userUpload });

    } catch (error) {
        console.error('Error updating material status:', error);
        res.status(500).json({ success: false, message: 'Error updating material status' });
    }
});

// ============= ADMIN: GET ALL MATERIALS (Including Pending) =============
app.get('/admin/materials', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const status = req.query.status; 
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
            success: true, data: materials,
            pagination: { currentPage: page, totalPages: totalPages, totalItems: totalCount, itemsPerPage: limit }
        });

    } catch (error) {
        console.error('Error fetching admin materials:', error);
        res.status(500).json({ success: false, message: 'Error fetching materials' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});