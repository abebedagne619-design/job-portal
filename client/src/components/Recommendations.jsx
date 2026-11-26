
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { API_URL } from '../config/api';

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

    // Use the authenticated backend user ID, not a possibly stale prop ID.
    const [currentUserId, setCurrentUserId] = useState(null);

    // =====================================
    // INITIALIZE COMPONENT
    // =====================================
    useEffect(() => {
        let active = true;

        const initializeRecommendations = async () => {
            try {
                setLoading(true);
                setRecommendations([]);

                // 1. Verify the authenticated user from backend
                const authResponse = await fetch(
                    `${API_URL}/api/auth/me`,
                    {
                        method: 'GET',
                        credentials: 'include',
                        cache: 'no-store'
                    }
                );

                if (!authResponse.ok) {
                    throw new Error(
                        `Authentication check failed: ${authResponse.status}`
                    );
                }

                const authData = await authResponse.json();
                const authenticatedUser = authData?.data;

                if (
                    !authData?.success ||
                    !authenticatedUser?.id
                ) {
                    throw new Error('Authenticated user not found');
                }

                const verifiedUserId = authenticatedUser.id;

                if (!active) return;

                setCurrentUserId(verifiedUserId);

                console.log(
                    'Recommendations authenticated user ID:',
                    verifiedUserId
                );

                // 2. Load skills belonging to authenticated user
                const skillsResponse = await fetch(
                    `${API_URL}/api/users/${verifiedUserId}/skills`,
                    {
                        method: 'GET',
                        credentials: 'include',
                        cache: 'no-store'
                    }
                );

                if (!skillsResponse.ok) {
                    const errorText = await skillsResponse.text();

                    throw new Error(
                        `Failed to fetch skills: ${skillsResponse.status} ${errorText}`
                    );
                }

                const skillsData = await skillsResponse.json();

                const loadedSkills = Array.isArray(skillsData)
                    ? skillsData
                    : [];

                if (!active) return;

                setSkills(loadedSkills.join(', '));

                // 3. Fetch recommendations only after skills are loaded
                await fetchRecommendations(
                    loadedSkills,
                    active
                );

            } catch (error) {
                console.error(
                    'Recommendations initialization error:',
                    error
                );

                if (active) {
                    setRecommendations([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        initializeRecommendations();

        return () => {
            active = false;
        };
    }, [user?.id]);

    // =====================================
    // FETCH AI JOB RECOMMENDATIONS
    // =====================================
    const fetchRecommendations = async (
        suppliedSkills = null,
        active = true
    ) => {
        try {
            const skillsArray = Array.isArray(suppliedSkills)
                ? suppliedSkills
                : skills
                    .split(',')
                    .map(skill => skill.trim())
                    .filter(Boolean);

            const response = await fetch(
                `${API_URL}/api/recommendations/skills`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        skills: skillsArray
                    })
                }
            );

            const responseText = await response.text();

            if (!response.ok) {
                console.error(
                    'Recommendation API error:',
                    response.status,
                    responseText
                );

                throw new Error(
                    `Recommendation API failed: ${response.status}`
                );
            }

            const data = responseText
                ? JSON.parse(responseText)
                : [];

            if (active) {
                setRecommendations(
                    Array.isArray(data) ? data : []
                );
            }

        } catch (error) {
            console.error(
                'Error fetching recommendations:',
                error
            );

            if (active) {
                setRecommendations([]);
            }
        }
    };

    // =====================================
    // SAVE USER SKILLS
    // =====================================
    const saveSkills = async () => {
        if (!currentUserId) {
            alert(
                isAmharic
                    ? 'የተጠቃሚ መለያ አልተረጋገጠም።'
                    : 'User authentication not verified.'
            );
            return;
        }

        setSavingSkills(true);

        const skillsArray = [
            ...new Set(
                skills
                    .split(',')
                    .map(skill => skill.trim())
                    .filter(Boolean)
            )
        ];

        try {
            const response = await fetch(
                `${API_URL}/api/users/me/skills`,
                {
                    method: 'PUT',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        skills: skillsArray
                    })
                }
            );

            const responseText = await response.text();

            let data = {};

            try {
                data = responseText
                    ? JSON.parse(responseText)
                    : {};
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || responseText || 'Failed to save skills'
                );
            }

            setSkills(
                Array.isArray(data.skills)
                    ? data.skills.join(', ')
                    : skillsArray.join(', ')
            );

            setEditingSkills(false);

            await fetchRecommendations(
                Array.isArray(data.skills)
                    ? data.skills
                    : skillsArray
            );

            alert(
                isAmharic
                    ? 'ክህሎቶችዎ በተሳካ ሁኔታ ተቀምጠዋል።'
                    : 'Your skills have been saved successfully.'
            );

        } catch (error) {
            console.error('Save skills error:', error);

            alert(
                isAmharic
                    ? `ክህሎቶችን ማስቀመጥ አልተሳካም፦ ${error.message}`
                    : `Failed to save skills: ${error.message}`
            );
        } finally {
            setSavingSkills(false);
        }
    };

    // =====================================
    // UPLOAD CV
    // =====================================
    const uploadCV = async () => {
        if (!currentUserId) {
            alert(
                isAmharic
                    ? 'የተጠቃሚ መለያ አልተረጋገጠም።'
                    : 'User authentication not verified.'
            );
            return;
        }

        if (!cvFile) {
            alert(
                isAmharic
                    ? 'እባክዎ PDF ፋይል ይምረጡ!'
                    : 'Please select a PDF file!'
            );
            return;
        }

        if (
            cvFile.type !== 'application/pdf' &&
            !cvFile.name.toLowerCase().endsWith('.pdf')
        ) {
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

        // Backend must use authenticated session as the authority.
        // This field is retained for compatibility with the existing API.
        formData.append('userId', String(currentUserId));

        try {
            const response = await fetch(
                `${API_URL}/api/recommendations/cv`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    body: formData
                }
            );

            const responseText = await response.text();

            let data = {};

            try {
                data = responseText
                    ? JSON.parse(responseText)
                    : {};
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || `CV upload failed: ${response.status}`
                );
            }

            setRecommendations(
                Array.isArray(data) ? data : []
            );

            alert(
                isAmharic
                    ? 'CV በተሳካ ሁኔታ ተጭኗል! አዲስ የሥራ ምክረ ሐሳቦች ተዘጋጅተዋል።'
                    : 'CV uploaded successfully! New job recommendations are ready.'
            );

        } catch (error) {
            console.error('CV upload error:', error);

            alert(
                isAmharic
                    ? `CV መጫን አልተቻለም፦ ${error.message}`
                    : `Could not upload CV: ${error.message}`
            );
        } finally {
            setUploadingCv(false);
        }
    };

    // =====================================
    // SEND RECOMMENDATION FEEDBACK
    // =====================================
    const sendFeedback = async (jobId, feedback) => {
        if (!currentUserId) return;

        try {
            const response = await fetch(
                `${API_URL}/api/recommendations/feedback`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        job_id: jobId,
                        feedback
                    })
                }
            );

            const responseText = await response.text();

            if (!response.ok) {
                console.error(
                    'Feedback API error:',
                    responseText
                );

                throw new Error(
                    `Feedback request failed: ${response.status}`
                );
            }

            alert(
                feedback === 'like'
                    ? (
                        isAmharic
                            ? 'ወደዱት! 👍 አስተያየትዎ ተቀምጧል።'
                            : 'Liked! 👍 Your feedback has been saved.'
                    )
                    : (
                        isAmharic
                            ? 'አልወደዱትም! 👎 አስተያየትዎ ተቀምጧል።'
                            : 'Disliked! 👎 Your feedback has been saved.'
                    )
            );

        } catch (error) {
            console.error('Feedback error:', error);

            alert(
                isAmharic
                    ? 'አስተያየቱን መላክ አልተሳካም።'
                    : 'Failed to send feedback.'
            );
        }
    };

    // =====================================
    // STYLES
    // =====================================
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

    // =====================================
    // USER CHECK
    // =====================================
    if (!user) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '5rem',
                color: '#2ecc71'
            }}>
                {isAmharic
                    ? 'ተጠቃሚው አልተገኘም።'
                    : 'User not found.'}
            </div>
        );
    }

    // =====================================
    // LOADING
    // =====================================
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

    // =====================================
    // MAIN UI
    // =====================================
    return (
        <div style={styles.container}>
            <h1 style={styles.title}>
                🤖 {isAmharic
                    ? 'የAI የሥራ ምክረ ሐሳቦች'
                    : 'AI Job Recommendations'}
            </h1>

            <div style={styles.skillsSection}>
                <h3>
                    {isAmharic
                        ? 'የእርስዎ ክህሎቶች'
                        : 'Your Skills'}
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
                        onChange={(event) =>
                            setSkills(event.target.value)
                        }
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
                        {skills || (
                            isAmharic
                                ? 'ምንም ክህሎት አልተመዘገበም ✨'
                                : 'No skills added yet ✨'
                        )}
                    </p>
                )}

                <br />

                <button
                    type="button"
                    style={styles.editBtn}
                    onClick={
                        editingSkills
                            ? saveSkills
                            : () => setEditingSkills(true)
                    }
                    disabled={savingSkills}
                >
                    {savingSkills
                        ? (
                            isAmharic
                                ? 'በማስቀመጥ ላይ...'
                                : 'Saving...'
                        )
                        : editingSkills
                            ? (
                                isAmharic
                                    ? 'ክህሎቶችን አስቀምጥ'
                                    : 'Save Skills'
                            )
                            : (
                                isAmharic
                                    ? 'ክህሎቶችን አስተካክል'
                                    : 'Edit Skills'
                            )}
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
                        {isAmharic
                            ? 'ወይም CV (PDF) ይጫኑ'
                            : 'Or Upload CV (PDF)'}
                    </h4>

                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(event) =>
                            setCvFile(
                                event.target.files?.[0] || null
                            )
                        }
                        style={{
                            display: 'block',
                            margin: '0 auto 10px',
                            color: '#fff'
                        }}
                    />

                    <button
                        type="button"
                        onClick={uploadCV}
                        disabled={uploadingCv || !cvFile}
                        style={{
                            ...styles.editBtn,
                            background: uploadingCv
                                ? '#555'
                                : '#3498db'
                        }}
                    >
                        {uploadingCv
                            ? (
                                isAmharic
                                    ? 'በመጫን ላይ...'
                                    : 'Uploading...'
                            )
                            : (
                                isAmharic
                                    ? '📄 CV አስገባና አስመስል'
                                    : '📄 Upload CV & Analyze'
                            )}
                    </button>
                </div>
            </div>

            <div style={styles.grid}>
                {recommendations.length > 0 ? (
                    recommendations.map(job => (
                        <div
                            key={job.id}
                            style={styles.card}
                        >
                            {job.similarity_score !== undefined && (
                                <span style={styles.matchBadge}>
                                    {(job.similarity_score * 100).toFixed(0)}%
                                    {' '}
                                    {isAmharic
                                        ? 'ተስማሚነት'
                                        : 'Match'}
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
                                    type="button"
                                    style={styles.likeBtn}
                                    onClick={() =>
                                        sendFeedback(job.id, 'like')
                                    }
                                >
                                    👍 {isAmharic
                                        ? 'ወድጄዋለሁ'
                                        : 'Like'}
                                </button>

                                <button
                                    type="button"
                                    style={styles.dislikeBtn}
                                    onClick={() =>
                                        sendFeedback(job.id, 'dislike')
                                    }
                                >
                                    👎 {isAmharic
                                        ? 'አልወደድኩትም'
                                        : 'Dislike'}
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
