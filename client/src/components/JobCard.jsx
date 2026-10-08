import React, { useState, useEffect, memo } from 'react';

// memo መጠቀም ካርዱ ባልተገባ ምክንያት (Re-render) እንዳይሆን ይከላከላል
const JobCard = memo(({ job, user, onApply }) => {
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rating, setRating] = useState(job.rating || 0); 
    const [hover, setHover] = useState(0);

    // የ ID አሰጣጥን ለማቅለል
    const currentJobId = job.id || job.job_id;
    const currentUserId = user?.id || user?.user_id;

    // 1. Check if job is already saved
    useEffect(() => {
        let isMounted = true; 
        
        if (currentUserId && currentJobId) {
            const checkIfSaved = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`http://localhost:5000/api/saved/check/${currentJobId}`, {
                        headers: {
                            'Authorization': token ? `Bearer ${token}` : '',
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!res.ok) throw new Error('Network response was not ok');
                    const data = await res.json();
                    if (isMounted) setSaved(data.saved || data.isSaved || false);
                } catch (err) {
                    console.error('❌ Error checking saved status:', err);
                }
            };
            checkIfSaved();
        }

        return () => { isMounted = false; };
    }, [currentUserId, currentJobId]);

    // 2. Submit Rating
    const submitRating = async (value) => {
        if (!user) return alert("እባክሽን መጀመሪያ Login አድርጊ!");
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:5000/api/ratings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ 
                    job_id: currentJobId,    
                    rating: value 
                })
            });

            const responseData = await res.json();

            if (res.ok) {
                setRating(value);
                alert("ደረጃ ሰጥተሻል! አመሰግናለሁ።");
            } else {
                alert("ስህተት፡ " + (responseData.message || "መረጃውን መላክ አልተቻለም"));
            }
        } catch (err) {
            console.error('❌ Rating error:', err);
            alert("ከሰርቨር ጋር መገናኘት አልተቻለም!");
        }
    };

    // 3. Toggle Save Logic (ተስተካክሏል ✅)
    const toggleSave = async () => {
        if (!user) return alert('⚠️ Please login to save jobs');
        
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            
            if (saved) {
                // ✅ ለማስወገድ - DELETE request with jobId in URL
                const res = await fetch(`http://localhost:5000/api/saved/${currentJobId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json'
                    }
                });

                if (res.ok) {
                    setSaved(false);
                    alert("ስራው ከተቀመጡ ተወግዷል!");
                } else {
                    const errorData = await res.json();
                    alert(errorData.message || "ክዋኔው አልተሳካም");
                }
            } else {
                // ✅ ለማስቀመጥ - POST request
                const res = await fetch('http://localhost:5000/api/saved', {
                    method: 'POST',
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        job_id: currentJobId,
                        title: job.title,
                        company: job.company,
                        location: job.location || 'አዲስ አበባ'
                    })
                });

                if (res.ok) {
                    setSaved(true);
                    alert("ስራው በተሳካ ሁኔታ ተቀምጧል!");
                } else {
                    const errorData = await res.json();
                    alert(errorData.message || "ክዋኔው አልተሳካም");
                }
            }
        } catch (err) {
            console.error('❌ Error toggling save:', err);
            alert("ከሰርቨር ጋር መገናኘት አልተቻለም");
        } finally {
            setSaving(false);
        }
    };

    // 4. Track job view (Analytics)
    useEffect(() => {
        if (currentUserId && currentJobId) {
            const timer = setTimeout(() => {
                const token = localStorage.getItem('token');
                fetch(`http://localhost:5000/api/analytics/track-view`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ 
                        job_id: currentJobId, 
                        user_id: currentUserId 
                    })
                }).catch(() => {}); 
            }, 2000); 
            return () => clearTimeout(timer);
        }
    }, [currentUserId, currentJobId]);

    const styles = {
        card: {
            background: 'rgba(20, 40, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            padding: '1.5rem',
            borderRadius: '15px',
            border: '1px solid rgba(46, 204, 113, 0.25)',
            color: '#fff',
            marginBottom: '1.2rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
        },
        title: { fontSize: '1.4rem', color: '#2ecc71', marginBottom: '0.6rem', fontWeight: '600' },
        company: { color: '#bdc3c7', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' },
        starsContainer: { 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.4rem', 
            margin: '1.2rem 0' 
        },
        buttonGroup: { display: 'flex', gap: '0.8rem', marginTop: '1.2rem' },
        saveBtn: { 
            flex: 1, 
            padding: '0.75rem', 
            background: saved ? 'rgba(231, 76, 60, 0.2)' : 'transparent', 
            border: saved ? '1px solid #e74c3c' : '1px solid #2ecc71',
            color: saved ? '#e74c3c' : '#fff', 
            borderRadius: '10px', 
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s',
            opacity: saving ? 0.6 : 1
        },
        applyBtn: { 
            flex: 1, 
            padding: '0.75rem', 
            background: '#2ecc71', 
            color: '#fff', 
            borderRadius: '10px', 
            cursor: 'pointer', 
            border: 'none',
            fontWeight: '600',
            boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)'
        }
    };

    return (
        <div style={styles.card} className="job-card-hover">
            <h3 style={styles.title}>{job.title}</h3>
            <p style={styles.company}>🏢 {job.company}</p>
            <p style={{color: '#ecf0f1', fontSize: '0.95rem'}}>📍 {job.location || 'አዲስ አበባ'}</p>
            <p style={{color: '#2ecc71', fontWeight: 'bold', marginTop: '8px', fontSize: '1.1rem'}}>
                💰 {job.salary_min && job.salary_max ? `${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} ብር` : (job.salary || 'በስምምነት')}
            </p>
            
            <div style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} 
                        onClick={() => submitRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        style={{ 
                            cursor: 'pointer', 
                            color: (hover || rating || job.rating) >= star ? '#ffc107' : '#333', 
                            fontSize: '1.7rem',
                            transition: 'transform 0.2s ease',
                            transform: (hover === star) ? 'scale(1.2)' : 'scale(1)'
                        }}>
                        ★
                    </span>
                ))}
                <span style={{ marginLeft: '12px', color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    ({Number(rating || job.rating || 0).toFixed(1)})
                </span>
            </div>

            <div style={styles.buttonGroup}>
                <button 
                    style={styles.saveBtn} 
                    onClick={toggleSave} 
                    disabled={saving}
                >
                    {saving ? '⏳...' : saved ? '🗑️ Unsave' : '📌 Save Job'}
                </button>
                <button style={styles.applyBtn} onClick={() => onApply(job)}>
                    📝 Apply Now
                </button>
            </div>
        </div>
    );
});

export default JobCard;