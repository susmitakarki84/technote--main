const axios = require('axios');

async function testLogin() {
    console.log('Testing login with correct credentials...');

    try {
        const response = await axios.post('http://localhost:5000/login', {
            email: 'user@example.com',
            password: 'userexample1234@USER'
        });

        console.log('Login successful!');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('Login failed');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data.message);
            if (error.response.data.lockoutTime !== undefined) {
                console.log('Lockout time:', error.response.data.lockoutTime, 'seconds');
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();
