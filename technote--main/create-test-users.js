const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const AuthUser = require('./models/AuthUser');

async function createTestUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        const testUsers = [
            {
                email: 'user@example.com',
                password: 'userexample1234@USER',
                role: 'user'
            },
            {
                email: 'admin@example.com',
                password: 'admin123',
                role: 'admin'
            },
            {
                email: 'superadmin@example.com',
                password: 'superadmin123',
                role: 'superadmin'
            }
        ];

        const hashedUsers = [];
        for (const user of testUsers) {
            const hashedPassword = await bcrypt.hash(user.password, 12);
            hashedUsers.push({
                ...user,
                password: hashedPassword
            });
        }

        await AuthUser.deleteMany({});
        const createdUsers = await AuthUser.insertMany(hashedUsers);

        console.log('Test users created:');
        createdUsers.forEach(user => {
            console.log(`- ${user.email} (${user.role})`);
        });

        await mongoose.disconnect();
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('Error creating test users:', error);
        await mongoose.disconnect();
    }
}

createTestUsers();
