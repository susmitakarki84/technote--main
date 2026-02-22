# DashboardDemo - User Management Dashboard

## Project Overview
DashboardDemo is a comprehensive user management dashboard designed to streamline administrative tasks with a focus on security, data management, and user-friendly interfaces. The application provides robust user authentication, efficient data upload capabilities, and a modern dashboard interface for managing system users and uploaded content.

## Core Technologies
The project leverages a stack of reliable and modern technologies:
- **Backend**: Node.js with Express framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) for secure session management
- **Password Security**: bcrypt for strong password hashing
- **Environment Configuration**: dotenv for managing environment variables
- **Frontend**: HTML5, CSS3 (with custom styling and responsive design)
- **JavaScript**: JavaScript for client-side interactivity
- **Utilities**: Node.js file system (fs) and path modules for file handling

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher) installed on your system
- MongoDB instance (local or cloud-based such as MongoDB Atlas)
- Git for version control (optional but recommended)

### Step-by-Step Installation

1. **Clone or Navigate to Project Directory**
   ```bash
   # Clone the repository (if you have git)
   git clone <repository-url>
   cd dashboarddemo
   
   # Or navigate to the existing project directory
   cd c:/Users/User/Desktop/technotecoredemo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   This will install all required packages including Express, Mongoose, bcrypt, JWT, dotenv, and other dependencies.

3. **Set Up Environment Variables**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   MONGO_URI=mongodb://localhost:27017/dashboarddemo  # or your MongoDB connection string
   PORT=3000  # default port (can be changed)
   JWT_SECRET=your_super_secret_jwt_key_here  # replace with a strong, unique string
   ```

4. **Start the Server**
   ```bash
   node server.js
   ```
   The server will start running on the specified port (default: 3000).

### Creating Initial Admin User
To create an initial admin user, run the `create-test-users.js` script:
```bash
node create-test-users.js
```
This will create a default admin user with the following credentials:
- Email: admin@admin.com
- Password: admin@123

## Project Structure

```
dashboarddemo/
├── server.js                 # Main server file with all endpoints
├── package.json              # Project dependencies and scripts
├── package-lock.json         # Dependency lock file
├── .env                      # Environment variables (not committed)
├── .gitignore                # Git ignore rules
├── create-test-users.js      # Script to create initial admin user
├── global.js                 # Global JavaScript utilities
├── index.html                # Login page
├── dashboard.html            # Main dashboard page
├── semester.html             # Semester management page
├── upload.html               # File upload page
├── style.css                 # Main stylesheet
├── dash.css                  # Dashboard-specific styles
├── sidebar.css               # Sidebar navigation styles
├── upload.css                # Upload page styles
├── middleware/
│   └── auth.js               # Authentication middleware
└── models/
    ├── AuthUser.js           # User model
    └── Material.js           # Material/uploaded content model
```

## Main Features

### 1. User Authentication System
- **Login Page** (`index.html`): Secure login with email and password
- **Logout Functionality**: JWT token invalidation on logout
- **Session Management**: JWT tokens stored in cookies for persistent sessions
- **Password Security**: Bcrypt hashing (10 salt rounds) for password storage

### 2. Dashboard Interface (`dashboard.html`)
- **User Overview**: Statistics and visual representation of system users
- **Quick Actions**: Fast access to common administrative tasks
- **Real-time Updates**: Dynamic content loading based on user data
- **Responsive Design**: Works across desktop and mobile devices

### 3. User Management (`dashboard.html` & `/users` Endpoints)
- **User Listings**: Display all registered users with filtering capabilities
- **User Details**: View comprehensive user information
- **User Creation**: Add new users with specific roles and permissions
- **User Deletion**: Remove users from the system
- **Role Management**: Admin and regular user roles with different privileges

### 4. Data Upload System (`upload.html`)
- **File Upload**: Support for various file types (PDF, images, documents)
- **Batch Upload**: Multiple files can be uploaded simultaneously
- **File Validation**: Check file types and sizes before upload
- **Progress Tracking**: Visual feedback on upload progress
- **File Management**: View, organize, and delete uploaded materials

### 5. Semester Management (`semester.html`)
- **Semester Creation**: Add new academic semesters
- **Semester Overview**: View all active and past semesters
- **Course Management**: Associate courses with specific semesters
- **Schedule Tracking**: Manage semester timelines and deadlines

## API Endpoints

### Authentication Routes
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/verify-token` - Verify JWT token validity

### User Management Routes (Currently Unprotected)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Material/Upload Routes (Protected with verifyToken)
- `POST /api/materials` - Upload materials
- `GET /api/materials` - Get all materials
- `GET /api/materials/:id` - Get material by ID
- `DELETE /api/materials/:id` - Delete material

### Other Protected Routes
- `GET /api/protected` - Example protected route
- `/api/semesters` - Semester management endpoints

## Key Implementation Details

### Authentication Middleware (`middleware/auth.js`)
Uses JWT tokens to authenticate requests. Tokens are verified using the `jsonwebtoken` library and compared against the secret key from the `.env` file.

### User Model (`models/AuthUser.js`)
Defines user schema with:
- email (unique, required)
- password (hashed)
- role (admin or user)
- other user metadata

### Material Model (`models/Material.js`)
Manages uploaded content with:
- filename
- original name
- file path
- file type
- upload date
- uploader information
- access permissions

### File Upload Handling
Uses Express `multer` middleware for file uploads with:
- Disk storage configuration
- File size limits
- File type validation
- Upload directory management

## Usage Instructions

1. **Accessing the Application**
   Open a web browser and navigate to:
   ```
   http://localhost:3000
   ```

2. **Logging In**
   Use the default admin credentials or create a new user:
   - Email: admin@admin.com
   - Password: admin@123

3. **Navigating the Dashboard**
   Use the sidebar navigation to access different features:
   - Dashboard: Home page with user statistics
   - Semester: Manage academic semesters
   - Upload: Upload and manage materials
   - Logout: Sign out of the system

4. **Uploading Materials**
   - Navigate to the Upload page
   - Click "Choose Files" to select materials
   - Click "Upload" to process files
   - View upload progress and completion status

5. **Managing Users**
   - From the Dashboard, access the Users section
   - Use the Add User form to create new users
   - Click on existing users to view or edit details
   - Use the delete button to remove users

## Troubleshooting

### Common Issues & Solutions

1. **Server Fails to Start**
   - Check if MongoDB is running
   - Verify `.env` file has correct MongoDB URI
   - Ensure port 3000 is not in use

2. **Login Errors**
   - Ensure user exists in database
   - Verify password is correct (case-sensitive)
   - Check JWT secret in `.env` file

3. **File Upload Problems**
   - Check file size limits (default: 5MB)
   - Verify file type is supported
   - Ensure upload directory exists and has write permissions

4. **Database Connection Errors**
   - Check MongoDB service status
   - Verify connection string in `.env` file
   - Ensure MongoDB instance is accessible from your network

### Debugging Tips

- Enable detailed logging in `server.js` for development
- Use browser developer tools to inspect network requests
- Check MongoDB logs for database-related issues
- Monitor Node.js console output for errors

## Security Considerations

1. **Password Hashing**: Uses bcrypt with 10 salt rounds
2. **JWT Expiration**: Tokens expire after 24 hours for security
3. **Cookie Security**: HttpOnly cookies prevent XSS attacks
4. **Input Validation**: Basic validation for user inputs
5. **File Validation**: Checks file types before storing on server

**Note**: The `/users` endpoints are currently unprotected for development purposes. In production environments, these should be secured with authentication middleware.

## Development & Maintenance

### Adding New Features
1. Create a new branch for development
2. Implement feature in a separate file or module
3. Test thoroughly before merging into main branch
4. Update README.md with any new features or changes

### Database Backups
Regularly back up the MongoDB database to prevent data loss. Use `mongodump` for full backups and `mongorestore` for restoration.

### Performance Optimization
- Use indexes on frequently queried fields in MongoDB
- Implement pagination for large datasets
- Optimize file upload handling for better performance
- Enable compression for static files

## Future Enhancements

1. **Role-Based Access Control (RBAC)**: More granular permissions
2. **Advanced Search**: Full-text search for users and materials
3. **File Previews**: Preview uploaded materials (PDF, images)
4. **Analytics Dashboard**: Detailed user and system analytics
5. **Email Notifications**: Automated notifications for key events
6. **Multi-Tenancy**: Support for multiple organizations
7. **API Documentation**: Swagger/OpenAPI documentation
8. **Testing**: Comprehensive unit and integration tests

## License & Contributing

This project is intended for educational and demonstration purposes. Contributions are welcome. Please follow the standard git workflow:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Contact & Support

For questions or support, please reach out through the project's GitHub repository or contact the development team directly.

---

**Version**: 1.0.0  
**Last Updated**: February 2024  
**Developed by**: DashboardDemo Team
#   t e c h n o t e -  
 