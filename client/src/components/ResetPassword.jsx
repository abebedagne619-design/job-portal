import React, { useState, useEffect } from 'react';

const ResetPassword = ({ onComplete }) => {
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
            console.log('🔐 Reset token found:', tokenParam.substring(0, 20) + '...');
        } else {
            setError('No reset token found');
            console.error('❌ No reset token found in URL');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            console.error('❌ Password mismatch: new and confirm passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            console.error('❌ Password too short: minimum 6 characters required');
            return;
        }
        
        setLoading(true);
        setMessage('');
        setError('');

        console.log('📤 Submitting password reset request');

        try {
            const res = await fetch('http://localhost:5000/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password })
            });
            const data = await res.json();
            
            if (res.ok) {
                console.log('✅ Password reset successfully!');
                setMessage('✅ Password reset successfully! Redirecting to login...');
                setTimeout(() => onComplete(), 2000);
            } else {
                console.error('❌ Error resetting password:', data.message);
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            console.error('❌ Network error:', err);
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    const styles = {
        container: { 
            maxWidth: '400px', 
            margin: '2rem auto', 
            padding: '2rem', 
            background: 'rgba(30,60,30,0.8)', 
            borderRadius: '20px' 
        },
        title: { 
            textAlign: 'center', 
            color: '#2ecc71', 
            marginBottom: '1.5rem' 
        },
        inputGroup: { 
            position: 'relative', 
            marginBottom: '1rem' 
        },
        input: { 
            width: '100%', 
            padding: '0.8rem', 
            paddingRight: '2.8rem', 
            borderRadius: '8px', 
            border: 'none', 
            background: '#0a2a0a', 
            color: '#fff',
            outline: 'none',
            fontSize: '1rem'
        },
        toggleBtn: { 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            background: 'none', 
            border: 'none', 
            color: '#2ecc71', 
            cursor: 'pointer',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        btn: { 
            width: '100%', 
            padding: '0.8rem', 
            background: '#2ecc71', 
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            marginTop: '0.5rem'
        },
        message: { 
            color: '#2ecc71', 
            textAlign: 'center', 
            marginBottom: '1rem' 
        },
        error: { 
            color: '#ef4444', 
            textAlign: 'center', 
            marginBottom: '1rem' 
        }
    };

    if (!token) {
        return (
            <div style={styles.container}>
                <p style={{ color: '#ef4444', textAlign: 'center' }}>Invalid or missing reset token</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Reset Password</h2>
            {message && <div style={styles.message}>{message}</div>}
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit}>
                <div style={styles.inputGroup}>
                    <input 
                        style={styles.input} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="New Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                    <button 
                        type="button" 
                        style={styles.toggleBtn} 
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex="-1"
                    >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                </div>
                <div style={styles.inputGroup}>
                    <input 
                        style={styles.input} 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        placeholder="Confirm Password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                    />
                    <button 
                        type="button" 
                        style={styles.toggleBtn} 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex="-1"
                    >
                        <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                </div>
                <button style={styles.btn} type="submit" disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;