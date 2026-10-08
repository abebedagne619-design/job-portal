import React, { useState, useEffect } from 'react';

const Recommendations = ({ user }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [skills, setSkills] = useState('');
    const [editingSkills, setEditingSkills] = useState(false);
    const [savingSkills, setSavingSkills] = useState(false);

    useEffect(() => {
        // user መኖሩን እና id እንዳለው ቀድሞ ማረጋገጥ (TypeError ለመከላከል)
        if (user && user.id) {
            console.log(`🚀 Recommendations page opened for user: ${user.id}`);
            fetchRecommendations();
            fetchSkills();
        }
    }, [user]);

    // 1. ወደ Python AI Server (5001) ጥያቄ ይልካል
    const fetchRecommendations = async () => {
    if (!user || !user.id) return;

    try {
        setLoading(true);
        console.log("📡 Requesting recommendations via Node.js...");
        
        // ክህሎቶቹን ወደ Array እንቀይራቸዋለን
        const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(s => s) : [];

        const res = await fetch(`http://localhost:5000/api/recommendations/skills`, {
            method: 'POST', // Node.js ላይ POST ነው ያደረግነው
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: user.id, 
                skills: skillsArray 
            }) 
        });

        if (!res.ok) throw new Error("Server error");

        const data = await res.json();
        console.log("🤖 AI Response:", data);

        setRecommendations(Array.isArray(data) ? data : []);
        setLoading(false);
    } catch (err) {
        console.error('❌ Error:', err);
        setRecommendations([]);
        setLoading(false);
    }
};

    // 2. ችሎታዎችን ከ Node.js (5000) ማምጣት
   const fetchSkills = async () => {
    if (!user || !user.id) return;
    try {
        // Node.js ላይ /api/recommendations/skills/:userId መሆኑን አረጋግጥ
        const res = await fetch(`http://localhost:5000/api/recommendations/skills/${user.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            setSkills(data.join(', '));
        }
    } catch (err) {
        console.error('❌ Error fetching skills:', err);
    }
};

    // 3. ችሎታዎችን ወደ Node.js (5000) መላክ
    const saveSkills = async () => {
        if (!user || !user.id) return;
        setSavingSkills(true);
        const skillsArray = skills.split(',').map(s => s.trim()).filter(s => s);
        try {
            const res = await fetch('http://localhost:5000/api/recommendations/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, skills: skillsArray })
            });
            
            if (res.ok) {
                setEditingSkills(false);
                fetchRecommendations(); 
            }
        } catch (err) {
            console.error('❌ Error saving skills:', err);
        }
        setSavingSkills(false);
    };

    // 4. Feedback ወደ Python AI Server (5001) ይልካል
    const sendFeedback = async (jobId, feedback) => {
    if (!user || !user.id) return;
    try {
        await fetch('http://localhost:5000/api/recommendations/skills', { // ወደ Node.js
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: user.id, 
                job_id: jobId, 
                feedback: feedback 
            })
        });
        alert(`${feedback === 'like' ? 'Liked! 👍' : 'Disliked! 👎'} - AI will learn from this.`);
    } catch (err) {
        console.error('❌ Feedback error:', err);
    }
};

    const styles = {
        container: { padding: '2rem 5%', color: '#fff' },
        title: { fontSize: '2rem', marginBottom: '1rem', color: '#2ecc71' },
        skillsSection: { background: 'rgba(30,60,30,0.8)', padding: '1.5rem', borderRadius: '15px', marginBottom: '2rem', textAlign: 'center' },
        editBtn: { padding: '0.6rem 1.5rem', background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' },
        card: { background: 'rgba(20,40,20,0.9)', padding: '1.5rem', borderRadius: '15px', border: '1px solid #2ecc71', position: 'relative' },
        feedbackContainer: { display: 'flex', gap: '15px', marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' },
        likeBtn: { background: '#2ecc71', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', flex: 1 },
        dislikeBtn: { background: '#e74c3c', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', flex: 1 },
        matchBadge: { position: 'absolute', top: '10px', right: '10px', background: '#2ecc71', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }
    };

    // ገና ዳታው ሳይመጣ TypeError እንዳይፈጠር ቀድሞ መፈተሽ
    if (!user) {
        return <div style={{textAlign: 'center', padding: '5rem', color: '#2ecc71'}}>ተጠቃሚ በመፈለግ ላይ...</div>;
    }

    if (loading) {
        return <div style={{textAlign: 'center', padding: '5rem', color: '#2ecc71'}}>🤖 AI የሥራ ጥቆማዎችን በማዘጋጀት ላይ...</div>;
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}><center>🤖 AI Job Recommendations</center></h1>
            
            <div style={styles.skillsSection}>
                <h3>የእርስዎ ክህሎቶች (Your Skills)</h3>
                {editingSkills ? (
                    <textarea 
                        style={{width: '80%', padding: '10px', background: '#000', color: '#fff', borderRadius: '8px', border: '1px solid #2ecc71', minHeight: '100px'}}
                        value={skills} 
                        onChange={(e) => setSkills(e.target.value)} 
                        placeholder="ለምሳሌ፦ react, nodejs, python"
                    />
                ) : <p style={{fontSize: '1.2rem', color: '#2ecc71'}}>{skills || 'ክህሎት አልተገኘም ✨'}</p>}
                <br/>
                <button 
                    style={styles.editBtn} 
                    onClick={editingSkills ? saveSkills : () => setEditingSkills(true)}
                    disabled={savingSkills}
                >
                    {savingSkills ? 'በመመዝገብ ላይ...' : (editingSkills ? 'ለውጦችን መዝግብ' : 'ክህሎቶችን አስተካክል')}
                </button>
            </div>

            <div style={styles.grid}>
                {recommendations.length > 0 ? (
                    recommendations.map(job => (
                        <div key={job.id} style={styles.card}>
                            {job.similarity_score !== undefined && (
                                <span style={styles.matchBadge}>
                                    {(job.similarity_score * 100).toFixed(0)}% Match
                                </span>
                            )}
                            <h3 style={{color: '#fff'}}>{job.title}</h3>
                            <p style={{color: '#2ecc71', fontWeight: 'bold'}}>{job.company}</p>
                            <p style={{fontSize: '0.9rem', color: '#ccc'}}>{job.location}</p>
                            <p style={{fontSize: '0.8rem', color: '#2ecc71'}}>{job.type} | {job.salary}</p>
                            
                            <div style={styles.feedbackContainer}>
                                <button style={styles.likeBtn} onClick={() => sendFeedback(job.id, 'like')}>
                                    👍 Like
                                </button>
                                <button style={styles.dislikeBtn} onClick={() => sendFeedback(job.id, 'dislike')}>
                                    👎 Dislike
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>
                        <p>ምንም አይነት የሥራ ጥቆማ አልተገኘም። እባክዎ ክህሎቶችን ይጨምሩ ወይም ሌሎች ስራዎችን ይመልከቱ።</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Recommendations;