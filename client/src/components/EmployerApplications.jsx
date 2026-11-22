
import React, { useState, useEffect } from 'react';
import ScheduleInterview from './ScheduleInterview';
import { useLanguage } from '../context/LanguageContext';
import { API_URL } from '../config/api';
const EmployerApplications = ({ user }) => {
    const { language } = useLanguage();
    const isAm = language === 'am';

    const [applications, setApplications] = useState([]);
    const [selectedApp, setSelectedApp] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch applications
    useEffect(() => {
        const fetchApplications = async () => {
            try {
                setLoading(true);
                setError(null);

                const token = sessionStorage.getItem('token');

                if (!token) {
                    throw new Error(
                        isAm
                            ? 'የLogin Token አልተገኘም።'
                            : 'Authentication token not found.'
                    );
                }

                const res = await fetch(
                    user.role === 'admin'
    ? `${API_URL}/api/applications`
    : `${API_URL}/api/applications/employer/${user.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(
                        data.message ||
                        data.error ||
                        'Failed to fetch applications'
                    );
                }

                if (!Array.isArray(data)) {
                    throw new Error('Invalid applications response');
                }

                setApplications(data);

            } catch (err) {
                setError(err.message);
                console.error('Fetch error:', err);

            } finally {
                setLoading(false);
            }
        };

        if (user?.id) {
            fetchApplications();
        }
    }, [user?.id, user?.role, isAm]);

    // Schedule interview
    const handleScheduleClick = (app) => {
        if (user?.role !== 'employer') {
            alert(
                isAm
                    ? 'ቃለ መጠይቅ ማዘጋጀት የሚችለው Employer ብቻ ነው።'
                    : 'Only employers can schedule interviews.'
            );
            return;
        }

        if (!app.user_id) {
            alert(
                isAm
                    ? 'ይህ Applicant ከUser Account ጋር አልተገናኘም። ቃለ መጠይቅ ማዘጋጀት አይቻልም።'
                    : 'This applicant is not linked to a user account. An interview cannot be scheduled.'
            );
            return;
        }

        if (!app.job_id) {
            alert(
                isAm
                    ? 'የሥራው Job ID አልተገኘም።'
                    : 'Job ID is missing.'
            );
            return;
        }

        setSelectedApp(app);
        setShowScheduleModal(true);
    };

    // Translate application status
    const getStatusLabel = (status) => {
        if (!isAm) return status;

        const statusTranslations = {
            pending: 'በመጠባበቅ ላይ',
            accepted: 'ተቀባይነት አግኝቷል',
            rejected: 'ውድቅ ተደርጓል',
            approved: 'ጸድቋል',
            shortlisted: 'ወደ ቀጣይ ዙር አልፏል',
            hired: 'ተቀጥሯል'
        };

        return statusTranslations[String(status).toLowerCase()] || status;
    };

    const styles = {
        container: {
            padding: '2rem',
            maxWidth: '1100px',
            margin: '0 auto',
            color: '#fff'
        },

        header: {
            borderBottom: '2px solid #2ecc71',
            paddingBottom: '1rem',
            marginBottom: '2rem'
        },

        grid: {
            display: 'grid',
            gap: '1.5rem'
        },

        card: {
            background: 'linear-gradient(145deg, #0a2a0a, #061a06)',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        },

        info: {
            flex: 1,
            minWidth: '220px'
        },

        name: {
            fontSize: '1.3rem',
            color: '#2ecc71',
            margin: '0 0 5px 0'
        },

        jobTitle: {
            fontSize: '1rem',
            color: '#ecf0f1',
            marginBottom: '10px'
        },

        meta: {
            fontSize: '0.85rem',
            color: '#bdc3c7',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '15px'
        },

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

        disabledBtn: {
            background: '#555',
            color: '#ccc',
            border: 'none',
            padding: '0.8rem 1.5rem',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'not-allowed',
            opacity: 0.7
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

    // Loading
    if (loading) {
        return (
            <div style={{
                textAlign: 'center',
                color: '#2ecc71',
                marginTop: '3rem'
            }}>
                {isAm
                    ? 'አመልካቾች በመጫን ላይ...'
                    : 'Loading applicants...'}
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div style={{
                textAlign: 'center',
                color: '#e74c3c',
                marginTop: '3rem'
            }}>
                {isAm ? 'ስህተት፦ ' : 'Error: '}
                {error}
            </div>
        );
    }

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h2>
                    📥 {isAm
                        ? 'የሥራ አመልካቾች አስተዳደር'
                        : 'Applicant Management'}
                </h2>

                <p>
                    {isAm
                        ? 'ለሥራ መደቦችዎ ያመለከቱ ሰዎችን ያስተዳድሩ'
                        : 'Manage people who applied for your job listings'}
                </p>
            </div>

            {/* No Applications */}
            {applications.length === 0 ? (

                <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    background: '#0a2a0a',
                    borderRadius: '15px'
                }}>
                    <p>
                        {isAm
                            ? 'እስካሁን ምንም የሥራ ማመልከቻ አልተገኘም።'
                            : 'No applications received yet.'}
                    </p>
                </div>

            ) : (

                /* Applications List */
                <div style={styles.grid}>

                    {applications.map(app => {
                        const canSchedule =
                            user?.role === 'employer' &&
                            Boolean(app.user_id) &&
                            Boolean(app.job_id);

                        return (
                            <div key={app.id} style={styles.card}>

                                <div style={styles.info}>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexWrap: 'wrap'
                                    }}>

                                        <h3 style={styles.name}>
                                            {app.applicant_name}
                                        </h3>

                                        <span style={styles.status(app.status)}>
                                            {getStatusLabel(app.status)}
                                        </span>

                                    </div>

                                    <div style={styles.jobTitle}>
                                        {isAm
                                            ? 'ያመለከቱት የሥራ መደብ፦ '
                                            : 'Applied for: '}

                                        <strong>
                                            {app.job_title}
                                        </strong>
                                    </div>

                                    <div style={styles.meta}>

                                        <span>
                                            📧 {app.applicant_email}
                                        </span>

                                        <span>
                                            📅 {isAm
                                                ? 'ያመለከቱበት ቀን፦ '
                                                : 'Applied on: '}

                                            {app.applied_at
                                                ? new Date(app.applied_at).toLocaleDateString(
                                                    isAm ? 'am-ET' : 'en-US'
                                                )
                                                : '-'}
                                        </span>

                                    </div>

                                    {!app.user_id && (
                                        <p style={{
                                            color: '#f1c40f',
                                            fontSize: '0.85rem',
                                            marginTop: '10px'
                                        }}>
                                            ⚠️ {isAm
                                                ? 'ይህ Application ከUser Account ጋር አልተገናኘም።'
                                                : 'This application is not linked to a user account.'}
                                        </p>
                                    )}

                                </div>

                                {/* Schedule Interview Button */}
                                {user?.role === 'employer' ? (
                                    <button
                                        style={canSchedule
                                            ? styles.btn
                                            : styles.disabledBtn}
                                        onClick={() => handleScheduleClick(app)}
                                        disabled={!canSchedule}
                                    >
                                        📅 {isAm
                                            ? 'ቃለ መጠይቅ ያዘጋጁ'
                                            : 'Schedule Interview'}
                                    </button>
                                ) : null}

                            </div>
                        );
                    })}

                </div>
            )}

            {/* Schedule Interview Modal */}
            {showScheduleModal && selectedApp && (

                <ScheduleInterview
                    job={{
                        id: selectedApp.job_id,
                        title: selectedApp.job_title
                    }}

                    applicant={{
                        id: selectedApp.user_id,
                        name: selectedApp.applicant_name,
                        application_id: selectedApp.id
                    }}

                    employer={user}

                    onClose={() => {
                        setShowScheduleModal(false);
                        setSelectedApp(null);
                    }}

                    onScheduled={() => {
                        setShowScheduleModal(false);
                        setSelectedApp(null);

                        alert(
                            isAm
                                ? 'የቃለ መጠይቅ ሂደት ተጀምሯል!'
                                : 'Interview process initiated!'
                        );
                    }}
                />

            )}

        </div>
    );
};

export default EmployerApplications;
