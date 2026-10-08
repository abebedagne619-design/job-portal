import React, { useState } from 'react';

const ApplyForm = ({ job, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        cover_letter: '',
        cv: null
    });
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
        if (!formData.cover_letter.trim()) newErrors.cover_letter = 'Cover letter is required';
        return newErrors;
    };

    const handleChange = (e) => {
        if (e.target.name === 'cv') {
            const file = e.target.files[0];
            if (file && file.size > 5 * 1024 * 1024) {
                console.error('❌ File too large! Maximum size is 5MB');
                return;
            }
            setFormData({ ...formData, cv: file });
        } else {
            setFormData({ ...formData, [e.target.name]: e.target.value });
            // Clear error when user starts typing
            if (errors[e.target.name]) {
                setErrors({ ...errors, [e.target.name]: '' });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form
        const newErrors = validate();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            console.error('❌ Form validation failed:', newErrors);
            return;
        }
        
        setSubmitting(true);
        
        const formDataToSend = new FormData();
        formDataToSend.append('job_id', job.id);
        formDataToSend.append('name', formData.name);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('phone', formData.phone);
        formDataToSend.append('cover_letter', formData.cover_letter);
        if (formData.cv) {
            formDataToSend.append('cv', formData.cv);
        }
        
        console.log('📤 Submitting application for job:', job.id);
        
        try {
            // onSubmit ውጤቱን (true/false) እስኪመልስ ድረስ እንጠብቃለን
            const success = await onSubmit(job.id, formDataToSend);
            
            if (success === true) { // ውጤቱ በትክክል true መሆኑን እናረጋግጣለን
                console.log('✅ Application submitted successfully!');
                onClose();
            } else {
                console.error('❌ Failed to submit application');
            }
        } catch (err) {
            console.error('❌ Error during submission:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        },
        modal: { background: '#1a3d1a', padding: '2rem', borderRadius: '20px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' },
        title: { color: '#2ecc71', marginBottom: '1rem' },
        input: { width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        inputError: { 
            width: '100%', 
            padding: '0.8rem', 
            marginBottom: '0.25rem', 
            borderRadius: '8px', 
            border: '1px solid #ef4444', 
            background: '#0a2a0a', 
            color: '#fff' 
        },
        fileInput: { width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        textarea: { width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff', minHeight: '100px' },
        textareaError: { 
            width: '100%', 
            padding: '0.8rem', 
            marginBottom: '0.25rem', 
            borderRadius: '8px', 
            border: '1px solid #ef4444', 
            background: '#0a2a0a', 
            color: '#fff', 
            minHeight: '100px' 
        },
        btn: { padding: '0.8rem', background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', marginRight: '0.5rem' },
        cancelBtn: { padding: '0.8rem', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' },
        errorText: { color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem', marginLeft: '0.5rem' }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 style={styles.title}>Apply for: {job?.title}</h2>
                <form onSubmit={handleSubmit}>
                    <input 
                        style={errors.name ? styles.inputError : styles.input} 
                        type="text" 
                        name="name" 
                        placeholder="Full Name" 
                        required 
                        value={formData.name} 
                        onChange={handleChange} 
                    />
                    {errors.name && <div style={styles.errorText}>{errors.name}</div>}
                    
                    <input 
                        style={errors.email ? styles.inputError : styles.input} 
                        type="email" 
                        name="email" 
                        placeholder="Email" 
                        required 
                        value={formData.email} 
                        onChange={handleChange} 
                    />
                    {errors.email && <div style={styles.errorText}>{errors.email}</div>}
                    
                    <input 
                        style={styles.input} 
                        type="tel" 
                        name="phone" 
                        placeholder="Phone" 
                        value={formData.phone} 
                        onChange={handleChange} 
                    />
                    
                    <textarea 
                        style={errors.cover_letter ? styles.textareaError : styles.textarea} 
                        name="cover_letter" 
                        placeholder="Cover Letter" 
                        value={formData.cover_letter} 
                        onChange={handleChange} 
                    />
                    {errors.cover_letter && <div style={styles.errorText}>{errors.cover_letter}</div>}
                    
                    <input 
                        style={styles.fileInput} 
                        type="file" 
                        name="cv" 
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" 
                        onChange={handleChange} 
                    />
                    <small style={{ color: '#aaa' }}>Supported: PDF, DOC, DOCX, JPG, PNG (Max 5MB)</small>
                    
                    <div style={{ marginTop: '1rem' }}>
                        <button style={styles.btn} type="submit" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Application'}
                        </button>
                        <button style={styles.cancelBtn} type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApplyForm;