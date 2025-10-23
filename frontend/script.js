document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageElement = document.getElementById('message');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.style.color = 'green';
                messageElement.textContent = data.message;
                window.location.href = '/success.html';
                // Optionally redirect or update UI on successful login
            } else {
                messageElement.style.color = 'red';
                messageElement.textContent = data.message || 'Login failed';
            }
        } catch (error) {
            console.error('Error:', error);
            messageElement.style.color = 'red';
            messageElement.textContent = 'An error occurred. Please try again.';
        }
    });
});