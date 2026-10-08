import React, { useState } from 'react';

const ForgotPassword = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        console.log(`📤 Sending password reset request for email: ${email}`);

        try {
            const res = await fetch('http://localhost:5000/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (res.ok) {
                console.log(`✅ Password reset link sent to: ${email}`);
                setMessage('✅ Password reset link sent to your email!');
                setEmail('');
            } else {
                console.error(`❌ Error: ${data.message || 'Something went wrong'}`);
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            console.error('❌ Network error:', err);
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    const styles = {
        container: { maxWidth: '400px', margin: '2rem auto', padding: '2rem', background: 'rgba(30,60,30,0.8)', borderRadius: '20px' },
        title: { textAlign: 'center', color: '#2ecc71', marginBottom: '1.5rem' },
        input: { width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        btn: { width: '100%', padding: '0.8rem', background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' },
        message: { color: '#2ecc71', textAlign: 'center', marginBottom: '1rem' },
        error: { color: '#ef4444', textAlign: 'center', marginBottom: '1rem' },
        backLink: { textAlign: 'center', marginTop: '1rem', color: '#2ecc71', cursor: 'pointer' }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Forgot Password</h2>
            {message && <div style={styles.message}>{message}</div>}
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit}>
                <input style={styles.input} type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button style={styles.btn} type="submit" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            <div style={styles.backLink} onClick={onBack}>← Back to Login</div>
        </div>
    );
};

export default ForgotPassword;