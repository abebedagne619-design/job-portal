
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

const Recommendations = ({ user }) => {
    const { language } = useLanguage();
    const isAmharic = language === 'am';

    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [skills, setSkills] = useState('');
    const [editingSkills, setEditingSkills] = useState(false);
    const [savingSkills, setSavingSkills] = useState(false);
    const [cvFile, setCvFile] = useState(null);
    const [uploadingCv, setUploadingCv] = useState(false);

    useEffect(() => {
        if (user && user.id) {
            fetchRecommendations();
            fetchSkills();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchRecommendations = async () => {
        if (!user || !user.id) return;

        try {
            setLoading(true);

            const skillsArray = skills
                ? skills.split(',').map(s => s.trim()).filter(s => s)
                : [];

            const res = await fetch(
                'http://localhost:5000/api/recommendations/skills',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        skills: skillsArray
                    })
                }
            );

            if (!res.ok) {
                throw new Error('Server error');
            }

            const data = await res.json();
            setRecommendations(Array.isArray(data) ? data : []);

        } catch (err) {
            console.error('Error fetching recommendations:', err);
            setRecommendations([]);
        } finally {
            setLoading(false);
        }
    };

    const uploadCV = async () => {
        if (!cvFile || !user?.id) {
            alert(
                isAmharic
                    ? 'እባክዎ PDF ፋይል ይምረጡ!'
                    : 'Please select a PDF file!'
            );
            return;
        }

        if (cvFile.type !== 'application/pdf') {
            alert(
                isAmharic
                    ? 'እባክዎ PDF ፋይል ብቻ ይምረጡ!'
                    : 'Please select a PDF file only!'
            );
            return;
        }

        setUploadingCv(true);

        const formData = new FormData();
        formData.append('cv', cvFile);
        formData.append('userId', user.id);

        try {
            const res = await fetch(
                'http://localhost:5000/api/recommendations/cv',
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (res.ok) {
                const data = await res.json();

                setRecommendations(Array.isArray(data) ? data : []);

                alert(
                    isAmharic
                        ? 'CV በተሳካ ሁኔታ ተጭኗል! አዲስ የሥራ ምክረ ሐሳቦች ተዘጋጅተዋል።'
                        : 'CV uploaded successfully! New job recommendations are ready.'
                );
            } else {
                const err = await res.json();

                alert(
                    isAmharic
                        ? `ስህተት፦ ${err.error || 'CV መጫን አልተሳካም'}`
                        : `Error: ${err.error || 'CV upload failed'}`
                );
            }
        } catch (err) {
            console.error('CV upload error:', err);

            alert(
                isAmharic
                    ? 'CV መጫን አልተቻለም።'
                    : 'Could not upload CV.'
            );
        } finally {
            setUploadingCv(false);
        }
    };

    const fetchSkills = async () => {
        if (!user || !user.id) return;

        try {
            const token = sessionStorage.getItem('token');

            const res = await fetch(
                `http://localhost:5000/api/users/${user.id}/skills`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!res.ok) {
                throw new Error('Failed to fetch skills');
            }

            const data = await res.json();

            if (Array.isArray(data)) {
                setSkills(data.join(', '));
            }
        } catch (err) {
            console.error('Error fetching skills:', err);
        }
    };

    const saveSkills = async () => {
        if (!user || !user.id) return;

        setSavingSkills(true);

        const skillsArray = skills
            .split(',')
            .map(s => s.trim())
            .filter(s => s);

        try {
            const res = await fetch(
                'http://localhost:5000/api/recommendations/skills',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        skills: skillsArray
                    })
                }
            );

            if (res.ok) {
                setEditingSkills(false);
                await fetchRecommendations();

                alert(
                    isAmharic
                        ? 'ክህሎቶችዎ በተሳካ ሁኔታ ተቀምጠዋል።'
                        : 'Your skills have been saved successfully.'
                );
            } else {
                alert(
                    isAmharic
                        ? 'ክህሎቶችን ማስቀመጥ አልተሳካም።'
                        : 'Failed to save skills.'
                );
            }
        } catch (err) {
            console.error('Error saving skills:', err);

            alert(
                isAmharic
                    ? 'ክህሎቶችን ማስቀመጥ አልተቻለም።'
                    : 'Could not save skills.'
            );
        } finally {
            setSavingSkills(false);
        }
    };

    const sendFeedback = async (jobId, feedback) => {
        if (!user || !user.id) return;

        try {
            const res = await fetch(
                'http://localhost:5000/api/recommendations/skills',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        job_id: jobId,
                        feedback: feedback
                    })
                }
            );

            if (!res.ok) {
                throw new Error('Feedback request failed');
            }

            alert(
                feedback === 'like'
                    ? (isAmharic
                        ? 'ወደዱት! 👍 AI ምርጫዎን ይማራል።'
                        : 'Liked! 👍 AI will learn from this.')
                    : (isAmharic
                        ? 'አልወደዱትም! 👎 AI ምርጫዎን ይማራል።'
                        : 'Disliked! 👎 AI will learn from this.')
            );
        } catch (err) {
            console.error('Feedback error:', err);

            alert(
                isAmharic
                    ? 'አስተያየቱን መላክ አልተሳካም።'
                    : 'Failed to send feedback.'
            );
        }
    };

    const styles = {
        container: {
            padding: '2rem 5%',
            color: '#fff'
        },
        title: {
            fontSize: '2rem',
            marginBottom: '1rem',
            color: '#2ecc71',
            textAlign: 'center'
        },
        skillsSection: {
            background: 'rgba(30,60,30,0.8)',
            padding: '1.5rem',
            borderRadius: '15px',
            marginBottom: '2rem',
            textAlign: 'center'
        },
        editBtn: {
            padding: '0.6rem 1.5rem',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            marginTop: '15px',
            fontWeight: 'bold'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
        },
        card: {
            background: 'rgba(20,40,20,0.9)',
            padding: '1.5rem',
            borderRadius: '15px',
            border: '1px solid #2ecc71',
            position: 'relative'
        },
        feedbackContainer: {
            display: 'flex',
            gap: '15px',
            marginTop: '15px',
            borderTop: '1px solid #333',
            paddingTop: '10px'
        },
        likeBtn: {
            background: '#2ecc71',
            border: 'none',
            color: 'white',
            padding: '8px 15px',
            borderRadius: '5px',
            cursor: 'pointer',
            flex: 1
        },
        dislikeBtn: {
            background: '#e74c3c',
            border: 'none',
            color: 'white',
            padding: '8px 15px',
            borderRadius: '5px',
            cursor: 'pointer',
            flex: 1
        },
        matchBadge: {
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#2ecc71',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '0.8rem'
        }
    };

    if (!user) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '5rem',
                color: '#2ecc71'
            }}>
                {isAmharic ? 'ተጠቃሚው አልተገኘም።' : 'User not found.'}
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '5rem',
                color: '#2ecc71'
            }}>
                {isAmharic
                    ? '🤖 የAI የሥራ ምክረ ሐሳቦችን በማዘጋጀት ላይ...'
                    : '🤖 Preparing AI job recommendations...'}
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>
                🤖 {isAmharic
                    ? 'የAI የሥራ ምክረ ሐሳቦች'
                    : 'AI Job Recommendations'}
            </h1>

            <div style={styles.skillsSection}>
                <h3>
                    {isAmharic ? 'የእርስዎ ክህሎቶች' : 'Your Skills'}
                </h3>

                {editingSkills ? (
                    <textarea
                        style={{
                            width: '80%',
                            padding: '10px',
                            background: '#000',
                            color: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #2ecc71',
                            minHeight: '100px'
                        }}
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder={
                            isAmharic
                                ? 'ለምሳሌ፦ React, Node.js, Python'
                                : 'e.g. React, Node.js, Python'
                        }
                    />
                ) : (
                    <p style={{
                        fontSize: '1.2rem',
                        color: '#2ecc71'
                    }}>
                        {skills || (isAmharic
                            ? 'ምንም ክህሎት አልተመዘገበም ✨'
                            : 'No skills added yet ✨')}
                    </p>
                )}

                <br />

                <button
                    style={styles.editBtn}
                    onClick={
                        editingSkills
                            ? saveSkills
                            : () => setEditingSkills(true)
                    }
                    disabled={savingSkills}
                >
                    {savingSkills
                        ? (isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...')
                        : editingSkills
                            ? (isAmharic ? 'ክህሎቶችን አስቀምጥ' : 'Save Skills')
                            : (isAmharic ? 'ክህሎቶችን አስተካክል' : 'Edit Skills')}
                </button>

                <div style={{
                    marginTop: '20px',
                    borderTop: '1px solid #2ecc71',
                    paddingTop: '20px'
                }}>
                    <h4 style={{
                        color: '#2ecc71',
                        marginBottom: '10px'
                    }}>
                        {isAmharic ? 'ወይም CV (PDF) ይጫኑ' : 'Or Upload CV (PDF)'}
                    </h4>

                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) =>
                            setCvFile(e.target.files?.[0] || null)
                        }
                        style={{
                            display: 'block',
                            margin: '0 auto 10px',
                            color: '#fff'
                        }}
                    />

                    <button
                        onClick={uploadCV}
                        disabled={uploadingCv || !cvFile}
                        style={{
                            ...styles.editBtn,
                            background: uploadingCv ? '#555' : '#3498db'
                        }}
                    >
                        {uploadingCv
                            ? (isAmharic ? 'በመጫን ላይ...' : 'Uploading...')
                            : (isAmharic
                                ? '📄 CV አስገባና አስመስል'
                                : '📄 Upload CV & Analyze')}
                    </button>
                </div>
            </div>

            <div style={styles.grid}>
                {recommendations.length > 0 ? (
                    recommendations.map(job => (
                        <div key={job.id} style={styles.card}>
                            {job.similarity_score !== undefined && (
                                <span style={styles.matchBadge}>
                                    {(job.similarity_score * 100).toFixed(0)}%{' '}
                                    {isAmharic ? 'ተስማሚነት' : 'Match'}
                                </span>
                            )}

                            <h3 style={{ color: '#fff' }}>
                                {job.title}
                            </h3>

                            <p style={{
                                color: '#2ecc71',
                                fontWeight: 'bold'
                            }}>
                                {job.company}
                            </p>

                            <p style={{
                                fontSize: '0.9rem',
                                color: '#ccc'
                            }}>
                                {job.location}
                            </p>

                            <p style={{
                                fontSize: '0.8rem',
                                color: '#2ecc71'
                            }}>
                                {job.type} | {job.salary}
                            </p>

                            <div style={styles.feedbackContainer}>
                                <button
                                    style={styles.likeBtn}
                                    onClick={() => sendFeedback(job.id, 'like')}
                                >
                                    👍 {isAmharic ? 'ወድጄዋለሁ' : 'Like'}
                                </button>

                                <button
                                    style={styles.dislikeBtn}
                                    onClick={() => sendFeedback(job.id, 'dislike')}
                                >
                                    👎 {isAmharic ? 'አልወደድኩትም' : 'Dislike'}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{
                        gridColumn: '1/-1',
                        textAlign: 'center',
                        padding: '2rem'
                    }}>
                        <p>
                            {isAmharic
                                ? 'ምንም የሥራ ምክረ ሐሳብ አልተገኘም። እባክዎ ክህሎቶችዎን ያስገቡ ወይም የሥራ መገለጫዎን ያሻሽሉ።'
                                : 'No job recommendations found. Please add your skills or improve your profile.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Recommendations;
