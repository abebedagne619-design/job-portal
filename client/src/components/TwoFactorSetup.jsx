import React, { useState } from 'react';

const TwoFactorSetup = ({ user, onComplete }) => {
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');
    const [step, setStep] = useState('setup');
    const [loading, setLoading] = useState(false);

    const setup2FA = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/2fa/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, email: user.email })
            });
            const data = await res.json();
            setQrCode(data.qrCode);
            setSecret(data.secret);
            setStep('verify');
        } catch (err) {
            console.error('Error setting up 2FA:', err);
            alert('Error setting up 2FA');
        }
        setLoading(false);
    };

    const verify2FA = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, token })
            });
            const data = await res.json();
            
            if (data.verified) {
                alert('2FA enabled successfully!');
                if (onComplete) onComplete();
            } else {
                alert('Invalid token. Please try again.');
            }
        } catch (err) {
            console.error('Error verifying 2FA:', err);
            alert('Error verifying 2FA');
        }
        setLoading(false);
    };

    const styles = {
        container: { padding: '2rem', background: 'rgba(30,60,30,0.8)', borderRadius: '20px', maxWidth: '500px', margin: '0 auto' },
        title: { color: '#2ecc71', marginBottom: '1rem' },
        qrCode: { textAlign: 'center', marginBottom: '1rem' },
        secret: { background: '#0a2a0a', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', marginBottom: '1rem' },
        input: { width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        btn: { width: '100%', padding: '0.8rem', background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }
    };

    if (step === 'setup') {
        return (
            <div style={styles.container}>
                <h2 style={styles.title}>Enable Two-Factor Authentication</h2>
                <p>Add an extra layer of security to your account</p>
                <button style={styles.btn} onClick={setup2FA} disabled={loading}>
                    {loading ? 'Setting up...' : 'Set Up 2FA'}
                </button>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Scan QR Code</h2>
            <div style={styles.qrCode}>
                <img src={qrCode} alt="2FA QR Code" />
            </div>
            <div style={styles.secret}>
                <strong>Secret Key:</strong> {secret}
            </div>
            <p>Enter the 6-digit code from your authenticator app</p>
            <input
                style={styles.input}
                type="text"
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength="6"
            />
            <button style={styles.btn} onClick={verify2FA} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify and Enable'}
            </button>
        </div>
    );
};

export default TwoFactorSetup;