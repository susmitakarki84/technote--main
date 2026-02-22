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
            });

            console.log('Success:', response.data);
        } catch (error) {
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Message:', error.response.data.message);
                if (error.response.data.remainingAttempts !== undefined) {
                    console.log('Remaining attempts:', error.response.data.remainingAttempts);
                }
                if (error.response.data.lockoutTime !== undefined) {
                    console.log('Lockout time:', error.response.data.lockoutTime, 'seconds');
                }
            } else {
                console.error('Error:', error.message);
            }
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
