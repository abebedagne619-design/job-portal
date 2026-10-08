import React, { useState } from 'react';
import GoogleLogin from './GoogleLogin';

const Login = ({ onLogin, onSwitch, onForgotPassword }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false); // ለ Button hover ውጤት

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const success = await onLogin(formData);
        if (!success) {
            setError('Invalid email or password');
        }
        setLoading(false);
    };

    const styles = {
        container: { 
            maxWidth: '400px', 
            margin: '2rem auto', 
            padding: '2rem', 
            background: 'rgba(30,60,30,0.9)', // ትንሽ ጠቆር ያለ
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        },
        title: { 
            textAlign: 'center', 
            color: '#2ecc71', 
            marginBottom: '1.5rem',
            fontSize: '1.8rem',
            fontWeight: '600'
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
            border: '1px solid rgba(46,204,113,0.2)', 
            background: '#0a2a0a', 
            color: '#fff',
            outline: 'none',
            fontSize: '1rem',
            boxSizing: 'border-box' // padding ስፋቱን እንዳያበላሸው
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
            background: isHovered ? '#27ae60' : '#2ecc71', // Hover ሲሆን ከለሩ ይቀየራል
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            marginTop: '0.5rem',
            transition: 'background 0.3s ease'
        },
        btnDisabled: {
            opacity: 0.6,
            cursor: 'not-allowed'
        },
        error: { 
            color: '#ff4d4d', 
            background: 'rgba(255, 77, 77, 0.1)',
            padding: '0.5rem',
            borderRadius: '5px',
            textAlign: 'center', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
        },
        switch: { 
            textAlign: 'center', 
            marginTop: '1.5rem', 
            color: '#bbb', 
            cursor: 'pointer',
            fontSize: '0.9rem'
        },
        forgot: { 
            textAlign: 'right', // ወደ ቀኝ ቢሆን ይሻላል
            marginTop: '0.5rem', 
            color: '#2ecc71', 
            cursor: 'pointer', 
            fontSize: '0.85rem' 
        },
        divider: {
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0',
            color: '#888',
            fontSize: '0.8rem'
        },
        dividerLine: {
            flex: 1,
            height: '1px',
            background: 'rgba(46,204,113,0.3)'
        },
        dividerText: {
            padding: '0 1rem'
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Login</h2>
            
            {error && <div style={styles.error}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div style={styles.inputGroup}>
                    <input 
                        style={styles.input} 
                        type="email" 
                        placeholder="Email" 
                        name="email"
                        autoComplete="username" // ማስጠንቀቂያውን ለማጥፋት
                        required 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                </div>
                
                <div style={styles.inputGroup}>
                    <input 
                        style={styles.input} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Password" 
                        name="password"
                        autoComplete="current-password" // ማስጠንቀቂያውን ለማጥፋት
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

                <div style={styles.forgot} onClick={onForgotPassword}>
                    Forgot Password?
                </div>
                
                <button 
                    style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}} 
                    type="submit" 
                    disabled={loading}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
            
            <div style={styles.divider}>
                <div style={styles.dividerLine}></div>
                <span style={styles.dividerText}>OR</span>
                <div style={styles.dividerLine}></div>
            </div>
            
            <GoogleLogin />
            
            <p style={styles.switch} onClick={onSwitch}>
                Don't have an account? <span style={{color: '#2ecc71', fontWeight: 'bold'}}>Register</span>
            </p>
        </div>
    );
};

export default Login;