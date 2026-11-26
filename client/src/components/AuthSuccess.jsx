
import React, { useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthSuccess = () => {
    useEffect(() => {
        let isMounted = true;

        const verifyGoogleLogin = async () => {
            try {
                const response = await fetch(`${API_URL}/api/auth/me`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store'
                });

                const data = await response.json();

                if (!response.ok || !data.success || !data.data) {
                    throw new Error('Google authentication verification failed');
                }

                if (isMounted) {
                    sessionStorage.setItem('user', JSON.stringify(data.data));
                    window.location.replace('/');
                }
            } catch (error) {
                console.error('Google login verification error:', error);

                if (isMounted) {
                    sessionStorage.removeItem('user');
                    sessionStorage.removeItem('token');
                    window.location.replace('/login');
                }
            }
        };

        verifyGoogleLogin();

        return () => {
            isMounted = false;
        };
    }, []);

    const styles = {
        container: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#0a3d0a',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        },
        content: {
            textAlign: 'center',
            color: '#fff'
        },
        spinner: {
            fontSize: '3.5rem',
            color: '#2ecc71',
            marginBottom: '1rem'
        },
        text: {
            fontSize: '1.2rem',
            fontWeight: '500'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <i
                    className="fas fa-circle-notch fa-spin"
                    style={styles.spinner}
                ></i>
                <h2 style={styles.text}>Completing sign in...</h2>
                <p style={{ color: '#888' }}>Please wait a moment.</p>
            </div>
        </div>
    );
};

export default AuthSuccess;
