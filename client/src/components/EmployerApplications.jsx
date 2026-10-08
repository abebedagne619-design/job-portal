import React, { useState, useEffect } from 'react';
import ScheduleInterview from './ScheduleInterview';

const EmployerApplications = ({ user }) => {
    const [applications, setApplications] = useState([]);
    const [selectedApp, setSelectedApp] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // አመልካቾችን ከቤክንድ መሳቢያ
    useEffect(() => {
        const fetchApplications = async () => {
            try {
                // ማሳሰቢያ፡ በቤክንድሽ /api/applications/employer/:id የሚል Route መኖሩን አረጋግጪ
                const res = await fetch(`http://localhost:5000/api/applications/employer/${user.id}`);
                if (!res.ok) throw new Error('Failed to fetch applications');
                const data = await res.json();
                setApplications(data);
            } catch (err) {
                setError(err.message);
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        if (user && user.id) {
            fetchApplications();
        }
    }, [user.id]);

    const handleScheduleClick = (app) => {
        setSelectedApp(app);
        setShowScheduleModal(true);
    };

    const styles = {
        container: { padding: '2rem', maxWidth: '1100px', margin: '0 auto', color: '#fff' },
        header: { borderBottom: '2px solid #2ecc71', paddingBottom: '1rem', marginBottom: '2rem' },
        grid: { display: 'grid', gap: '1.5rem' },
        card: {
            background: 'linear-gradient(145deg, #0a2a0a, #061a06)',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        },
        info: { flex: 1 },
        name: { fontSize: '1.3rem', color: '#2ecc71', margin: '0 0 5px 0' },
        jobTitle: { fontSize: '1rem', color: '#ecf0f1', marginBottom: '10px' },
        meta: { fontSize: '0.85rem', color: '#bdc3c7', display: 'flex', gap: '15px' },
        btn: {
            background: '#2ecc71',
            color: '#062606',
            border: 'none',
            padding: '0.8rem 1.5rem',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: '0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        status: (s) => ({
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            background: s === 'pending' ? '#f39c12' : '#2ecc71',
            color: '#fff',
            marginLeft: '10px'
        })
    };

    if (loading) return <div style={{textAlign: 'center', color: '#2ecc71', marginTop: '3rem'}}>Loading applicants...</div>;
    if (error) return <div style={{textAlign: 'center', color: '#e74c3c', marginTop: '3rem'}}>Error: {error}</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2>📥 Applicant Management</h2>
                <p>Manage people who applied for your job listings</p>
            </div>

            {applications.length === 0 ? (
                <div style={{textAlign: 'center', padding: '3rem', background: '#0a2a0a', borderRadius: '15px'}}>
                    <p>No applications received yet.</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {applications.map(app => (
                        <div key={app.id} style={styles.card}>
                            <div style={styles.info}>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                    <h3 style={styles.name}>{app.applicant_name}</h3>
                                    <span style={styles.status(app.status)}>{app.status}</span>
                                </div>
                                <div style={styles.jobTitle}>Applied for: <strong>{app.job_title}</strong></div>
                                <div style={styles.meta}>
                                    <span>📧 {app.applicant_email}</span>
                                    <span>📅 Applied on: {new Date(app.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <button 
                                style={styles.btn}
                                onClick={() => handleScheduleClick(app)}
                            >
                                📅 Schedule Interview
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ቀጠሮ መያዣ ሞዳል - እዚህ ጋር በጥንቃቄ ተኪው */}
{showScheduleModal && selectedApp && (
    <ScheduleInterview 
        job={{ id: selectedApp.job_id, title: selectedApp.job_title }}
        applicant={{ 
            // ሁሉንም ሊሆኑ የሚችሉ የ ID ስሞችን እዚህ ጋር እንፈትሻለን
            id: selectedApp.applicant_id || selectedApp.user_id || selectedApp.userId || selectedApp.id, 
            name: selectedApp.applicant_name,
            application_id: selectedApp.id 
        }}
        employer={user}
        onClose={() => setShowScheduleModal(false)}
        onScheduled={() => {
            setShowScheduleModal(false);
            alert("Interview process initiated!");
        }}
    />
)}
        </div>
    );
};

export default EmployerApplications;