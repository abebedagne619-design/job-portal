import React, { useState } from 'react';

const Register = ({ onRegister, onSwitch }) => {
    // 🔔 'role' ወደ formData ተጨምሯል (ዲፎልት 'user' ነው)
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const success = await onRegister(formData);
        if (!success) setError('Registration failed. Email may already exist.');
    };

    const styles = {
        container: { 
            maxWidth: '400px', 
            margin: '2rem auto', 
            padding: '2rem', 
            background: 'rgba(30,60,30,0.8)', 
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        },
        title: { 
            textAlign: 'center', 
            color: '#2ecc71', 
            marginBottom: '1.5rem',
            fontSize: '1.8rem'
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
            fontSize: '1rem',
            marginBottom: '1rem'
        },
        select: {
            width: '100%',
            padding: '0.8rem',
            borderRadius: '8px',
            border: 'none',
            background: '#0a2a0a',
            color: '#2ecc71', // ጎልቶ እንዲታይ
            outline: 'none',
            fontSize: '1rem',
            marginBottom: '1.5rem',
            cursor: 'pointer',
            fontWeight: 'bold'
        },
        label: {
            display: 'block',
            color: '#888',
            marginBottom: '0.5rem',
            fontSize: '0.9rem'
        },
        toggleBtn: { 
            position: 'absolute', 
            right: '12px', 
            top: '40%', // ከማርጅኑ ጋር እንዲገጥም ተስተካክሏል
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
            marginTop: '0.5rem',
            transition: '0.3s'
        },
        error: { 
            color: '#ef4444', 
            textAlign: 'center', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
        },
        switch: { 
            textAlign: 'center', 
            marginTop: '1rem', 
            color: '#888', 
            cursor: 'pointer',
            fontSize: '0.9rem'
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Register</h2>
            {error && <div style={styles.error}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <input 
                    style={styles.input} 
                    type="text" 
                    placeholder="Full Name" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                />
                
                <input 
                    style={styles.input} 
                    type="email" 
                    placeholder="Email" 
                    required 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                />
                
                <div style={styles.inputGroup}>
                    <input 
                        style={styles.input} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Password" 
                        required 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
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

                {/* 🔔 አዲሱ የሚና ምርጫ (Role Selection) */}
                <label style={styles.label}>አካውንትዎ ምን አይነት ይሁን?</label>
                <select 
                    style={styles.select}
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                >
                    <option value="user">ስራ ፈላጊ (Applicant)</option>
                    <option value="employer">አሰሪ (Employer)</option>
                </select>

                <button style={styles.btn} type="submit">Create Account</button>
            </form>
            
            <p style={styles.switch} onClick={onSwitch}>
                Already have an account? Login
            </p>
        </div>
    );
};

export default Register;