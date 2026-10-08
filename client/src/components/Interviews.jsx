import React, { useState, useEffect } from 'react';

const Interviews = ({ user }) => {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInterviews = async () => {
    try {
        setLoading(true);
        const endpoint = user.role === 'employer' 
            ? `http://localhost:5000/api/interviews/employer/${user.id}`
            : `http://localhost:5000/api/interviews/user/${user.id}`;
        
        const response = await fetch(endpoint);
        const data = await response.json();

        // 🌟 ዋናው ማስተካከያ፡ ዳታው Array መሆኑን ማረጋገጥ
        if (Array.isArray(data)) {
            setInterviews(data);
        } else {
            console.error("Expected array but got:", data);
            setInterviews([]); // ስህተት ከመጣ ባዶ Array አድርገው
        }
    } catch (err) {
        console.error("Error fetching interviews:", err);
        setInterviews([]);
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        if (user?.id) fetchInterviews();
    }, [user]);

    // 🌟 የኢንተርቪው ስታተስ ለመቀየር (Accept/Decline)
    const handleStatusUpdate = async (id, action) => {
        if (!window.confirm(`እርግጠኛ ነዎት ቀጠሮውን ${action === 'accept' ? 'መቀበል' : 'መሰረዝ'} ይፈልጋሉ?`)) return;

        try {
            const res = await fetch(`http://localhost:5000/api/interviews/${action}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();

            if (res.ok) {
                alert(`ቀጠሮው በስኬት ${action === 'accept' ? 'ተቀብለዋል' : 'ተሰርዟል'}`);
                fetchInterviews(); // ዝርዝሩን በድጋሚ ለማደስ
            } else {
                alert(`ስህተት፡ ${result.message}`);
            }
        } catch (err) {
            console.error("Update error:", err);
            alert("የኔትወርክ ስህተት ተከስቷል።");
        }
    };

    return (
        <div style={{ padding: '2rem', color: '#fff', maxWidth: '900px', margin: '0 auto', fontFamily: 'inherit' }}>
            <h2 style={{ color: '#2ecc71', textAlign: 'center', marginBottom: '2rem' }}>📅 የእርስዎ የቃለ-መጠይቅ ቀጠሮዎች</h2>
            
            {loading ? (
                <p style={{ textAlign: 'center' }}>በመጫን ላይ...</p>
            ) : interviews.length === 0 ? (
                <div style={{ background: '#1a3d1a', padding: '3rem', borderRadius: '15px', textAlign: 'center', border: '1px dashed #2ecc71' }}>
                    <p style={{ fontSize: '1.2rem', color: '#bbb' }}>ገና ምንም የተቀጠረ ቀጠሮ የለም።</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {interviews.map((interview) => (
                        <div key={interview.id} style={{ 
                            background: 'linear-gradient(145deg, #1a3d1a, #0d210d)', 
                            padding: '1.5rem', borderRadius: '15px', border: '1px solid rgba(46, 204, 113, 0.2)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#2ecc71', fontSize: '1.4rem' }}>{interview.job_title}</h3>
                                    <p style={{ color: '#bbb', margin: '5px 0' }}>🏢 {interview.company || interview.employer_name || 'የኩባንያ ስም'}</p>
                                </div>
                                <span style={{ 
                                    background: interview.status === 'accepted' ? '#2ecc71' : interview.status === 'pending' ? '#f1c40f' : '#e74c3c', 
                                    color: '#000', padding: '6px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase'
                                }}>
                                    {interview.status || 'PENDING'}
                                </span>
                            </div>
                            
                            <hr style={{ border: '0.5px solid rgba(255,255,255,0.1)', margin: '1.2rem 0' }} />
                            
                            <div style={{ lineHeight: '1.8' }}>
{/* interview.scheduled_date መኖሩን ብቻ ቼክ አድርጊ */}
<p>🕒 <strong>ቀንና ሰዓት፡</strong> {new Date(interview.scheduled_date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>                                
                                <p>
                                    📍 <strong>ቦታ/ሊንክ፡</strong>{' '}
                                    {(interview.meeting_link || interview.location)?.startsWith('http') ? (
                                        <a 
                                            href={interview.meeting_link || interview.location} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            style={{ color: '#3498db', textDecoration: 'underline', fontWeight: '500' }}
                                        >
                                            የቪዲዮ ጥሪውን ይቀላቀሉ (Join Meeting)
                                        </a>
                                    ) : (
                                        <span style={{ color: '#eee' }}>{interview.meeting_link || interview.location || 'አልተገለጸም'}</span>
                                    )}
                                </p>

                                {interview.notes && (
                                    <p style={{ fontSize: '0.95rem', color: '#aaa', marginTop: '10px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                        📝 <strong>ማስታወሻ፡</strong> {interview.notes}
                                    </p>
                                )}
                            </div>

                            {/* 🌟 የአክሽን በተኖች (ለአመልካቹ ብቻ የሚታይ) */}
                            {user.role === 'applicant' && interview.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button 
                                        onClick={() => handleStatusUpdate(interview.id, 'accept')}
                                        style={{ background: '#2ecc71', color: '#000', border: 'none', padding: '10px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}
                                        onMouseOver={(e) => e.target.style.opacity = '0.8'}
                                        onMouseOut={(e) => e.target.style.opacity = '1'}
                                    >
                                        Accept ✅
                                    </button>
                                    <button 
                                        onClick={() => handleStatusUpdate(interview.id, 'decline')}
                                        style={{ background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', padding: '10px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: '0.3s' }}
                                        onMouseOver={(e) => e.target.style.background = 'rgba(231, 76, 60, 0.1)'}
                                        onMouseOut={(e) => e.target.style.background = 'transparent'}
                                    >
                                        Decline ❌
                                    </button>
                                </div>
                            )}

                            {user.role === 'applicant' && interview.status === 'accepted' && (
                                <div style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '10px', borderRadius: '8px', marginTop: '1rem', borderLeft: '4px solid #2ecc71' }}>
                                    <p style={{ color: '#2ecc71', margin: 0, fontSize: '0.9rem' }}>✓ ይህንን ቀጠሮ ተቀብለዋል። መልካም እድል!</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Interviews;