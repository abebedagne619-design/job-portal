import React, { useState, useEffect } from 'react';

const SaveButton = ({ jobId, userId }) => {
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (jobId && userId) {
            checkIfSaved();
        }
    }, [jobId, userId]);

    const checkIfSaved = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // ✅ ትክክለኛው API endpoint (user በtoken ይታወቃል)
            const res = await fetch(`http://localhost:5000/api/saved/check/${jobId}`, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json'
                }
            });
            
            const contentType = res.headers.get("content-type");
            if (res.ok && contentType && contentType.includes("application/json")) {
                const data = await res.json();
                setSaved(data.isSaved || false);
            } else {
                console.warn('Server did not return valid JSON');
            }
        } catch (err) {
            console.error('Error checking saved:', err);
        }
    };

    const toggleSave = async () => {
        if (!userId) return alert("እባክሽ መጀመሪያ Login አድርጊ!");
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            
            if (saved) {
                // ✅ ለማስወገድ - DELETE request with jobId in URL
                const res = await fetch(`http://localhost:5000/api/saved/${jobId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (res.ok) {
                    setSaved(false);
                } else {
                    const error = await res.json();
                    console.error('Remove failed:', error);
                    alert(error.message || 'Failed to remove job');
                }
            } else {
                // ✅ ለማስቀመጥ - POST request with job_id in body
                const res = await fetch('http://localhost:5000/api/saved', {
                    method: 'POST',
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ job_id: jobId })
                });
                
                if (res.ok) {
                    setSaved(true);
                } else {
                    const error = await res.json();
                    console.error('Save failed:', error);
                    alert(error.message || 'Failed to save job');
                }
            }
        } catch (err) {
            console.error('Error toggling save:', err);
            alert('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    // SaveButton.jsx ውስጥ
const token = localStorage.getItem('token');

// ቶከን መኖሩን መፈተሽ
if (!token) {
    console.warn("ቶከን አልተገኘም፣ ተጠቃሚው መግባት አለበት።");
    return;
}

const res = await fetch(`http://localhost:5000/api/saved/check/${jobId}`, {
    headers: {
        'Authorization': `Bearer ${token}`, // በትክክል መላኩን አረጋግጥ
        'Content-Type': 'application/json'
    }
});

    const styles = {
        button: {
            background: saved ? '#ef4444' : '#2ecc71',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            opacity: loading ? 0.7 : 1
        },
        icon: {
            fontSize: '1rem'
        }
    };

    return (
        <button style={styles.button} onClick={toggleSave} disabled={loading}>
            <span style={styles.icon}>
                {loading ? '⏳' : (saved ? '✓' : '📌')}
            </span>
            {loading ? 'Processing...' : (saved ? 'Saved' : 'Save Job')}
        </button>
    );
};

export default SaveButton;