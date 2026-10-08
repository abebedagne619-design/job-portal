import React from 'react';

const GoogleLogin = () => {
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:5000/auth/google';
    };

    const styles = {
        button: {
            width: '100%',
            padding: '0.8rem',
            background: '#fff',
            color: '#333',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.8rem',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'all 0.3s ease',
            marginTop: '0.5rem'
        },
        icon: {
            fontSize: '1.2rem'
        }
    };

    return (
        // Login.jsx ውስጥ መሆን ያለበት በተን
<button 
    onClick={() => window.location.href = 'http://localhost:5000/auth/google'}
    className="google-btn"
>
    <i className="fab fa-google"></i> Sign in with Google
</button>
    );
};

export default GoogleLogin;