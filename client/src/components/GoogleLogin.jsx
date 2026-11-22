
import React from 'react';
import { API_URL } from '../config/api';

const GoogleLogin = () => {
    const handleGoogleLogin = () => {
        window.location.href = `${API_URL}/auth/google`;
    };

    return (
        <button
            type="button"
            onClick={handleGoogleLogin}
            className="google-btn"
            style={{
                width: '100%',
                padding: '0.8rem',
                background: '#fff',
                color: '#333',
                border: '1px solid #ddd',
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
            }}
        >
            <i className="fab fa-google"></i>
            Sign in with Google
        </button>
    );
};

export default GoogleLogin;
