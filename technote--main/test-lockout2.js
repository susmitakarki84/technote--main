const axios = require('axios');

async function testBruteForceProtection() {
    const email = 'user@example.com';
    const wrongPassword = 'wrongpassword123';

    console.log('Testing brute force protection...');

    for (let attempt = 1; attempt <= 6; attempt++) {
        console.log(`\nAttempt ${attempt}:`);
        try {
            const response = await axios.post('http://localhost:5000/login', {
                email: email,
                password: wrongPassword
            }, {
                validateStatus: false // Don't throw errors for non-200 status codes
            });

            console.log('Status:', response.status);
            console.log('Data:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.error('Error:', error);
        }

        // Wait 1 second between attempts to simulate user behavior
        if (attempt < 6) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

testBruteForceProtection().then(() => {
    console.log('\nTest completed');
});
