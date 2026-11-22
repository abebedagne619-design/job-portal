
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { API_URL } from '../config/api';


const Interviews = ({ user }) => {
    const { language } = useLanguage();
    const isAmharic = language === 'am';

    const isApplicant =
        user?.role === 'user' ||
        user?.role === 'applicant';

    const isEmployer = user?.role === 'employer';
    const isAdmin = user?.role === 'admin';

    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const getToken = () => {
        return sessionStorage.getItem('token');
    };

    // FETCH INTERVIEWS
    const fetchInterviews = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            const token = getToken();

            if (!token) {
                setError(
                    isAmharic
                        ? 'እባክዎ እንደገና Login ያድርጉ።'
                        : 'Please login again.'
                );
                return;
            }

            const endpoint = isAdmin
    ? `${API_URL}/api/interviews/user/${user.id}`
    : isEmployer
        ? `${API_URL}/api/interviews/employer/${user.id}`
        : `${API_URL}/api/interviews/user/${user.id}`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Failed to load interviews'
                );
            }

            setInterviews(Array.isArray(data) ? data : []);

        } catch (err) {
            console.error('Fetch interviews error:', err);

            setError(
                isAmharic
                    ? 'የቃለ መጠይቅ መረጃ መጫን አልተቻለም።'
                    : 'Unable to load interviews.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, [user?.id, user?.role, language]);

    // ACCEPT INTERVIEW
    const handleAccept = async (interviewId) => {
        const confirmed = window.confirm(
            isAmharic
                ? 'ይህን የቃለ መጠይቅ ቀጠሮ መቀበል ይፈልጋሉ?'
                : 'Do you want to accept this interview?'
        );

        if (!confirmed) return;

        try {
            setProcessingId(interviewId);
            setMessage('');
            setError('');

            const token = getToken();

            const response = await fetch(
                `${API_URL}/api/interviews/accept/${interviewId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Failed to accept interview'
                );
            }

            setInterviews(prev =>
                prev.map(interview =>
                    Number(interview.id) === Number(interviewId)
                        ? { ...interview, status: 'accepted' }
                        : interview
                )
            );

            setMessage(
                isAmharic
                    ? 'ቀጠሮውን በተሳካ ሁኔታ ተቀብለዋል።'
                    : 'Interview accepted successfully.'
            );

        } catch (err) {
            console.error('Accept interview error:', err);

            setError(
                isAmharic
                    ? 'ቀጠሮውን መቀበል አልተቻለም።'
                    : 'Unable to accept interview.'
            );
        } finally {
            setProcessingId(null);
        }
    };

    // DECLINE INTERVIEW
    const handleDecline = async (interviewId) => {
        const confirmed = window.confirm(
            isAmharic
                ? 'ይህን የቃለ መጠይቅ ቀጠሮ ውድቅ ማድረግ ይፈልጋሉ?'
                : 'Do you want to decline this interview?'
        );

        if (!confirmed) return;

        try {
            setProcessingId(interviewId);
            setMessage('');
            setError('');

            const token = getToken();

            const response = await fetch(
                `${API_URL}/api/interviews/decline/${interviewId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Failed to decline interview'
                );
            }

            setInterviews(prev =>
                prev.map(interview =>
                    Number(interview.id) === Number(interviewId)
                        ? { ...interview, status: 'declined' }
                        : interview
                )
            );

            setMessage(
                isAmharic
                    ? 'ቀጠሮውን ውድቅ አድርገዋል።'
                    : 'Interview declined successfully.'
            );

        } catch (err) {
            console.error('Decline interview error:', err);

            setError(
                isAmharic
                    ? 'ቀጠሮውን ውድቅ ማድረግ አልተቻለም።'
                    : 'Unable to decline interview.'
            );
        } finally {
            setProcessingId(null);
        }
    };

    // DATE FORMAT
    const formatDate = (dateValue) => {
        if (!dateValue) return '-';

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString(
            isAmharic ? 'am-ET' : 'en-US',
            {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        );
    };

    // TIME FORMAT
    const formatTime = (timeValue) => {
        if (!timeValue) return '-';

        const parts = String(timeValue).split(':');

        if (parts.length < 2) return timeValue;

        let hour = Number(parts[0]);
        const minute = parts[1];

        if (Number.isNaN(hour)) return timeValue;

        const period = hour >= 12 ? 'PM' : 'AM';

        hour = hour % 12 || 12;

        return `${hour}:${minute} ${period}`;
    };

    // STATUS LABEL
    const getStatusLabel = (status) => {
        const labels = {
            pending: isAmharic ? 'በመጠባበቅ ላይ' : 'Pending',
            accepted: isAmharic ? 'ተቀባይነት አግኝቷል' : 'Accepted',
            declined: isAmharic ? 'ውድቅ ተደርጓል' : 'Declined',
            scheduled: isAmharic ? 'ተይዟል' : 'Scheduled',
            completed: isAmharic ? 'ተጠናቋል' : 'Completed',
            cancelled: isAmharic ? 'ተሰርዟል' : 'Cancelled',
            rescheduled: isAmharic ? 'እንደገና ተይዟል' : 'Rescheduled'
        };

        return labels[status] || status;
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: '#f39c12',
            accepted: '#27ae60',
            declined: '#e74c3c',
            scheduled: '#3498db',
            completed: '#16a085',
            cancelled: '#7f8c8d',
            rescheduled: '#8e44ad'
        };

        return colors[status] || '#7f8c8d';
    };

    if (loading) {
        return (
            <div style={styles.center}>
                {isAmharic
                    ? 'መረጃ በመጫን ላይ...'
                    : 'Loading interviews...'}
            </div>
        );
    }

    return (
        <div style={styles.container}>

            <h2 style={styles.heading}>
                {isAmharic
                    ? 'የቃለ መጠይቅ ቀጠሮዎች'
                    : 'My Interviews'}
            </h2>

            {message && (
                <div style={styles.successMessage}>
                    {message}
                </div>
            )}

            {error && (
                <div style={styles.errorMessage}>
                    {error}
                </div>
            )}

            {interviews.length === 0 ? (
                <div style={styles.empty}>
                    {isAmharic
                        ? 'ምንም የቃለ መጠይቅ ቀጠሮ የለም።'
                        : 'No interviews found.'}
                </div>
            ) : (
                <div style={styles.grid}>

                    {interviews.map(interview => (
                        <div
                            key={interview.id}
                            style={styles.card}
                        >

                            <div style={styles.cardHeader}>
                                <h3 style={styles.jobTitle}>
                                    {interview.job_title || 'Interview'}
                                </h3>

                                <span
                                    style={{
                                        ...styles.status,
                                        backgroundColor:
                                            getStatusColor(interview.status)
                                    }}
                                >
                                    {getStatusLabel(interview.status)}
                                </span>
                            </div>

                            <div style={styles.details}>

                                <p>
                                    <strong>
                                        {isAmharic ? 'ኩባንያ:' : 'Company:'}
                                    </strong>{' '}
                                    {interview.company || '-'}
                                </p>

                                {isApplicant && (
                                    <p>
                                        <strong>
                                            {isAmharic
                                                ? 'ቀጣሪ:'
                                                : 'Employer:'}
                                        </strong>{' '}
                                        {interview.employer_name || '-'}
                                    </p>
                                )}

                                {(isEmployer || isAdmin) && (
                                    <>
                                        <p>
                                            <strong>
                                                {isAmharic
                                                    ? 'አመልካች:'
                                                    : 'Applicant:'}
                                            </strong>{' '}
                                            {interview.applicant_name || '-'}
                                        </p>

                                        <p>
                                            <strong>Email:</strong>{' '}
                                            {interview.applicant_email || '-'}
                                        </p>
                                    </>
                                )}

                                <p>
                                    <strong>
                                        {isAmharic ? 'ቀን:' : 'Date:'}
                                    </strong>{' '}
                                    {formatDate(interview.scheduled_date)}
                                </p>

                                <p>
                                    <strong>
                                        {isAmharic ? 'ሰዓት:' : 'Time:'}
                                    </strong>{' '}
                                    {formatTime(interview.interview_time)}
                                </p>

                                {interview.location && (
                                    <p>
                                        <strong>
                                            {isAmharic
                                                ? 'ቦታ:'
                                                : 'Location:'}
                                        </strong>{' '}
                                        {interview.location}
                                    </p>
                                )}

                                {interview.meeting_link && (
                                    <p>
                                        <strong>
                                            {isAmharic
                                                ? 'የስብሰባ ሊንክ:'
                                                : 'Meeting Link:'}
                                        </strong>{' '}
                                        <a
                                            href={interview.meeting_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={styles.link}
                                        >
                                            {isAmharic
                                                ? 'ስብሰባውን ይቀላቀሉ'
                                                : 'Join Meeting'}
                                        </a>
                                    </p>
                                )}

                                {interview.notes && (
                                    <p>
                                        <strong>
                                            {isAmharic
                                                ? 'ማስታወሻ:'
                                                : 'Notes:'}
                                        </strong>{' '}
                                        {interview.notes}
                                    </p>
                                )}

                            </div>

                            {/* ADMIN / EMPLOYER ACCEPT / DECLINE BUTTONS */}
{(isEmployer || isAdmin) &&
    interview.status === 'pending' && (
        <div style={styles.actions}>
            <button
                style={styles.acceptButton}
                onClick={() => handleAccept(interview.id)}
                disabled={processingId === interview.id}
            >
                {processingId === interview.id
                    ? '...'
                    : isAmharic ? 'ተቀበል' : 'Accept'}
            </button>

            <button
                style={styles.declineButton}
                onClick={() => handleDecline(interview.id)}
                disabled={processingId === interview.id}
            >
                {processingId === interview.id
                    ? '...'
                    : isAmharic ? 'ውድቅ አድርግ' : 'Decline'}
            </button>
        </div>
    )}
                            {/* ACCEPTED MESSAGE */}
                            {isApplicant && interview.status === 'accepted' && (
    <div style={styles.acceptedMessage}>
        ✓ {isAmharic
            ? 'የቃለ መጠይቁን ቀጠሮ ተቀብለዋል። መልካም ዕድል!'
            : 'You have accepted this interview. Good luck!'}
    </div>
)}
                            {/* DECLINED MESSAGE */}
                            {isApplicant && interview.status === 'declined' && (
    <div style={styles.declinedMessage}>
        ❌ {isAmharic
            ? 'የቃለ መጠይቁ ቀጠሮ ውድቅ ተደርጓል።'
            : 'You have declined this interview.'}
    </div>
)}

                        </div>
                    ))}

                </div>
            )}

        </div>
    );
};

const styles = {
    container: {
        maxWidth: '1100px',
        margin: '30px auto',
        padding: '20px'
    },

    heading: {
        textAlign: 'center',
        marginBottom: '25px',
        color: '#2c3e50'
    },

    center: {
        textAlign: 'center',
        padding: '50px',
        fontSize: '18px'
    },

    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px'
    },

    card: {
        background: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
        border: '1px solid #eee'
    },

    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '15px'
    },

    jobTitle: {
        margin: 0,
        color: '#2c3e50',
        fontSize: '18px'
    },

    status: {
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold'
    },

    details: {
        lineHeight: '1.8',
        color: '#444',
        overflowWrap: 'anywhere'
    },

    actions: {
        display: 'flex',
        gap: '10px',
        marginTop: '18px'
    },

    acceptButton: {
        flex: 1,
        padding: '10px',
        background: '#27ae60',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },

    declineButton: {
        flex: 1,
        padding: '10px',
        background: '#e74c3c',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },

    acceptedMessage: {
        background: 'rgba(39, 174, 96, 0.1)',
        color: '#27ae60',
        padding: '12px',
        borderRadius: '8px',
        marginTop: '18px',
        borderLeft: '4px solid #27ae60'
    },

    declinedMessage: {
        background: 'rgba(231, 76, 60, 0.1)',
        color: '#e74c3c',
        padding: '12px',
        borderRadius: '8px',
        marginTop: '18px',
        borderLeft: '4px solid #e74c3c'
    },

    successMessage: {
        background: '#e8f8f0',
        color: '#218c54',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '18px',
        textAlign: 'center'
    },

    errorMessage: {
        background: '#fdecea',
        color: '#c0392b',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '18px',
        textAlign: 'center'
    },

    empty: {
        textAlign: 'center',
        padding: '40px',
        background: '#f8f9fa',
        borderRadius: '10px',
        color: '#777'
    },

    link: {
        color: '#3498db',
        textDecoration: 'none',
        fontWeight: 'bold'
    }
};

export default Interviews;
