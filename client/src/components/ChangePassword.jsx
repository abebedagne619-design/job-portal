import React, { useState } from 'react';

const ChangePassword = ({ user, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            console.error('❌ Password mismatch: new and confirm passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            console.error('❌ Password too short: minimum 6 characters required');
            return;
        }

        setLoading(true);
        console.log('📤 Changing password for user:', user.id);

        try {
            const res = await fetch('http://localhost:5000/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    currentPassword,
                    newPassword
                })
            });
            const data = await res.json();

            if (res.ok) {
                console.log('✅ Password changed successfully!');
                setMessage('✅ Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => onClose(), 2000);
            } else {
                console.error('❌ Error changing password:', data.message);
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            console.error('❌ Network error:', err);
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    const styles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        },
        modal: {
            background: '#1a3d1a',
            padding: '2rem',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '450px'
        },
        title: {
            color: '#2ecc71',
            marginBottom: '1.5rem',
            textAlign: 'center'
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
            fontSize: '1.1rem'
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
        cancelBtn: {
            width: '100%',
            padding: '0.8rem',
            background: '#ef4444',
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

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 style={styles.title}>Change Password</h2>
                {message && <div style={styles.message}>{message}</div>}
                {error && <div style={styles.error}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.inputGroup}>
                        <input
                            style={styles.input}
                            type={showCurrent ? 'text' : 'password'}
                            placeholder="Current Password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                        <button type="button" style={styles.toggleBtn} onClick={() => setShowCurrent(!showCurrent)}>
                            <i className={`fas ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                    <div style={styles.inputGroup}>
                        <input
                            style={styles.input}
                            type={showNew ? 'text' : 'password'}
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                        <button type="button" style={styles.toggleBtn} onClick={() => setShowNew(!showNew)}>
                            <i className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                    <div style={styles.inputGroup}>
                        <input
                            style={styles.input}
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <button type="button" style={styles.toggleBtn} onClick={() => setShowConfirm(!showConfirm)}>
                            <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                    <button style={styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Changing...' : 'Change Password'}
                    </button>
                    <button style={styles.cancelBtn} type="button" onClick={onClose}>
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePassword;