document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const email = emailInput.value;
    const messageElement = document.getElementById('message');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    try {
        const response = await fetch('/send-reset-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.text();

        if (response.ok) {
            messageElement.textContent = 'If an account exists, a code has been sent to your email. Please check your inbox and enter the code below.';
            messageElement.style.color = 'green';
            forgotPasswordForm.style.display = 'none';
            resetPasswordForm.style.display = 'block';
            // Store email in a hidden field or global variable if needed for the second form submission
            // For simplicity, we'll assume the email input is still accessible or re-entered.
        } else {
            messageElement.textContent = data || 'Error sending reset code.';
            messageElement.style.color = 'red';
        }
    } catch (error) {
        console.error('Error:', error);
        messageElement.textContent = 'An error occurred. Please try again.';
        messageElement.style.color = 'red';
    }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value; // Get email from the first form's input
    const resetCode = document.getElementById('resetCode').value;
    const newPassword = document.getElementById('newPassword').value;
    const resetMessageElement = document.getElementById('resetMessage');

    try {
        const response = await fetch('/reset-password-with-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, resetCode, newPassword }),
        });

        const data = await response.text();

        if (response.ok) {
            resetMessageElement.textContent = 'Password has been reset successfully. You can now log in with your new password.';
            resetMessageElement.style.color = 'green';
            // Optionally redirect to login page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        } else {
            resetMessageElement.textContent = data || 'Error resetting password.';
            resetMessageElement.style.color = 'red';
        }
    } catch (error) {
        console.error('Error:', error);
        resetMessageElement.textContent = 'An error occurred. Please try again.';
        resetMessageElement.style.color = 'red';
    }
});