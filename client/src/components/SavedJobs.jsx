import React, { useState, useEffect } from 'react';

const SavedJobs = ({ user }) => {
    const [savedJobs, setSavedJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    // ተጠቃሚው ካለ ብቻ ዳታውን እንዲያመጣ useEffect እናስተካክለው
    useEffect(() => {
        if (user && user.id) {
            fetchSavedJobs();
        }
    }, [user]);

    const fetchSavedJobs = async () => {
    try {
        const token = localStorage.getItem('token'); // ቶከኑን መውሰድ

        // 1. አድራሻውን አስተካክዪ (በሰርቨርሽ ላይ ያለው /api/saved ስለሆነ)
        const res = await fetch(`http://localhost:5000/api/saved`, {
            headers: {
                'Authorization': `Bearer ${token}` // ቶከኑን መላክ
            }
        });

        // 2. የ JSON ቼክ ማድረጊያው (ያንቺው ኮድ)
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            throw new TypeError("Oops, we didn't get JSON from the server!");
        }

        const data = await res.json();
        setSavedJobs(data);
    } catch (err) {
        console.error('Error fetching saved jobs:', err);
        setSavedJobs([]); 
    } finally {
        setLoading(false);
    }
};
    const removeSaved = async (jobId) => {
        if (!window.confirm('Are you sure you want to remove this job?')) return;
        
        try {
            const res = await fetch('http://localhost:5000/api/saved', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, jobId: jobId })
            });

            if (res.ok) {
                // ዳታውን እንደገና ከመጥራት ይልቅ ከስቴቱ ላይ ቀጥታ መቀነስ ይቻላል (ለፍጥነት)
                setSavedJobs(savedJobs.filter(job => job.job_id !== jobId));
            }
        } catch (err) {
            console.error('Error removing saved job:', err);
        }
    };

    const styles = {
        container: { padding: '2rem 5%', minHeight: '80vh' },
        title: { fontSize: '2rem', marginBottom: '2rem', color: '#2ecc71', borderBottom: '2px solid #2ecc71', display: 'inline-block' },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' },
        card: { 
            background: 'rgba(30,60,30,0.9)', 
            padding: '1.5rem', 
            borderRadius: '15px', 
            border: '1px solid rgba(46,204,113,0.3)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'transform 0.3s ease'
        },
        jobTitle: { color: '#fff', fontSize: '1.3rem', marginBottom: '0.5rem' },
        company: { color: '#2ecc71', fontWeight: 'bold', marginBottom: '1rem' },
        info: { color: '#bdc3c7', fontSize: '0.9rem', margin: '5px 0' },
        removeBtn: { 
            padding: '0.6rem 1.2rem', 
            background: '#ef4444', 
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            cursor: 'pointer', 
            marginTop: '1.2rem',
            width: '100%',
            fontWeight: 'bold'
        },
        loading: { textAlign: 'center', padding: '5rem', color: '#2ecc71', fontSize: '1.5rem' },
        noData: { textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '15px' }
    };

    if (loading) {
        return <div style={styles.loading}>⌛ Loading your saved jobs...</div>;
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>📚 Saved Jobs ({savedJobs.length})</h1>
            
            {savedJobs.length === 0 ? (
                <div style={styles.noData}>
                    <p style={{fontSize: '1.2rem', color: '#bdc3c7'}}>No saved jobs yet.</p>
                    <p>Click the "Save" icon on any job post to see it here!</p>
                </div>
            ) : (
                <div style={styles.grid}>
                {savedJobs.map(job => (
    /* key ላይ job.saved_id ብታደርገው ይመረጣል (ከ SQL Query ጋር እንዲመሳሰል) */
    <div key={job.saved_id || job.id} style={styles.card}>
        <h3 style={styles.jobTitle}>{job.title}</h3>
        <p style={styles.company}>🏢 {job.company}</p>
        <p style={styles.info}>📍 {job.location || 'Remote'}</p>
        
        {/* Salary መጨመር ከፈለግክ (በ SQL Query ውስጥ ስለጨመርነው ይመጣል) */}
        <p style={styles.info}>💰 {job.salary || 'Negotiable'}</p>
        
        <p style={{...styles.info, fontStyle: 'italic', fontSize: '0.8rem'}}>
            Saved on: {new Date(job.saved_at).toLocaleDateString()}
        </p>
        
        <button 
            style={styles.removeBtn} 
            onClick={() => removeSaved(job.job_id)}
        >
            🗑️ Remove from Saved
        </button>
    </div>
))}
                </div>
            )}
        </div>
    );
};

export default SavedJobs;