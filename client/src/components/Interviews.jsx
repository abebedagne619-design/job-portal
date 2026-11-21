
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

const Interviews = ({ user }) => {
    const { language } = useLanguage();
    const isAmharic = language === 'am';

    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    // Safely read JSON responses
    const readResponse = async (response) => {
        try {
            return await response.json();
        } catch {
            return {};
        }
    };

    // Fetch interviews
    const fetchInterviews = useCallback(async () => {
        if (!user?.id) return;

        const token = sessionStorage.getItem('token');

        if (!token) {
            setError(
                isAmharic
                    ? 'የLogin Token አልተገኘም። እባክዎ Login ያድርጉ።'
                    : 'Authentication token not found. Please login again.'
            );
            setInterviews([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            const endpoint = user.role === 'employer'
                ? `http://localhost:5000/api/interviews/employer/${user.id}`
                : `http://localhost:5000/api/interviews/user/${user.id}`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    `Server Error (${response.status})`
                );
            }

            if (!Array.isArray(data)) {
                throw new Error(
                    isAmharic
                        ? 'ከServer የተላከው ዳታ ትክክል አይደለም።'
                        : 'Invalid response received from server.'
                );
            }

            setInterviews(data);

        } catch (err) {
            console.error('Error fetching interviews:', err);
            setInterviews([]);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.role, isAmharic]);

    useEffect(() => {
        if (user?.id) {
            fetchInterviews();
        }
    }, [user?.id, user?.role, fetchInterviews]);

    // Accept or Decline interview
    const handleStatusUpdate = async (id, action) => {
        const token = sessionStorage.getItem('token');

        if (!token) {
            alert(
                isAmharic
                    ? 'Login Token አልተገኘም። እባክዎ Login ያድርጉ።'
                    : 'Authentication token not found. Please login again.'
            );
            return;
        }

        const actionText = action === 'accept'
            ? (isAmharic ? 'መቀበል' : 'accept')
            : (isAmharic ? 'አለመቀበል' : 'decline');

        const confirmed = window.confirm(
            isAmharic
                ? `የቃለ መጠይቁን ቀጠሮ ${actionText} ይፈልጋሉ?`
                : `Are you sure you want to ${actionText} this interview?`
        );

        if (!confirmed) return;

        try {
            setUpdatingId(id);

            const res = await fetch(
                `http://localhost:5000/api/interviews/${action}/${id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const result = await readResponse(res);

            if (!res.ok) {
                throw new Error(
                    result.message ||
                    result.error ||
                    `Update failed (${res.status})`
                );
            }

            alert(
                isAmharic
                    ? `ቀጠሮው ${action === 'accept' ? 'ተቀብለዋል' : 'ውድቅ ተደርጓል'}።`
                    : `Interview ${action === 'accept' ? 'accepted' : 'declined'} successfully.`
            );

            await fetchInterviews();

        } catch (err) {
            console.error('Update error:', err);

            alert(
                isAmharic
                    ? `ስህተት፦ ${err.message}`
                    : `Error: ${err.message}`
            );
        } finally {
            setUpdatingId(null);
        }
    };

    // Format MySQL DATE without timezone shifting
    const formatInterviewDate = (dateValue) => {
        if (!dateValue) {
            return isAmharic ? 'አልተገለጸም' : 'Not specified';
        }

        const datePart = String(dateValue).split('T')[0].split(' ')[0];
        const parts = datePart.split('-');

        if (parts.length !== 3) return dateValue;

        const [year, month, day] = parts.map(Number);

        if (!year || !month || !day) return dateValue;

        const date = new Date(year, month - 1, day);

        return date.toLocaleDateString(
            isAmharic ? 'am-ET' : 'en-GB',
            { dateStyle: 'full' }
        );
    };

    // Format MySQL TIME
    const formatInterviewTime = (timeValue) => {
        if (!timeValue) {
            return '';
        }

        const timePart = String(timeValue).split('.')[0];
        const parts = timePart.split(':');

        if (parts.length < 2) return timeValue;

        const hour = Number(parts[0]);
        const minute = Number(parts[1]);

        if (Number.isNaN(hour) || Number.isNaN(minute)) {
            return timeValue;
        }

        const date = new Date();
        date.setHours(hour, minute, 0, 0);

        return date.toLocaleTimeString(
            isAmharic ? 'am-ET' : 'en-GB',
            {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }
        );
    };

    // Translate interview status
    const getStatusLabel = (status) => {
        if (!isAmharic) {
            return status || 'pending';
        }

        const statuses = {
            pending: 'በመጠባበቅ ላይ',
            accepted: 'ተቀባይነት አግኝቷል',
            declined: 'ውድቅ ተደርጓል',
            scheduled: 'ተቀጥሯል',
            completed: 'ተጠናቋል',
            cancelled: 'ተሰርዟል',
            rescheduled: 'ቀጠሮው ተቀይሯል'
        };

        return statuses[status] || status || 'በመጠባበቅ ላይ';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'accepted':
                return '#2ecc71';
            case 'pending':
                return '#f1c40f';
            case 'declined':
            case 'cancelled':
                return '#e74c3c';
            case 'completed':
                return '#3498db';
            default:
                return '#95a5a6';
        }
    };

    if (!user) {
        return (
            <p>
                {isAmharic ? 'ተጠቃሚ አልተገኘም' : 'User not found'}
            </p>
        );
    }

    return (
        <div style={{
            padding: '2rem',
            color: '#fff',
            maxWidth: '900px',
            margin: '0 auto',
            fontFamily: 'inherit'
        }}>

            <h2 style={{
                color: '#2ecc71',
                textAlign: 'center',
                marginBottom: '2rem'
            }}>
                {isAmharic
                    ? '📅 የቃለ መጠይቅ ቀጠሮዎች'
                    : '📅 Interview Appointments'}
            </h2>

            {loading ? (
                <p style={{ textAlign: 'center' }}>
                    {isAmharic ? 'በመጫን ላይ...' : 'Loading...'}
                </p>
            ) : error ? (
                <div style={{
                    background: '#3d1a1a',
                    padding: '2rem',
                    borderRadius: '15px',
                    textAlign: 'center',
                    border: '1px solid #e74c3c'
                }}>
                    <p style={{ color: '#ff7675' }}>
                        ❌ {isAmharic ? 'ስህተት፦ ' : 'Error: '}
                        {error}
                    </p>

                    <button
                        onClick={fetchInterviews}
                        style={{
                            background: '#2ecc71',
                            color: '#000',
                            padding: '10px 25px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {isAmharic ? 'እንደገና ሞክር' : 'Try Again'}
                    </button>
                </div>
            ) : interviews.length === 0 ? (
                <div style={{
                    background: '#1a3d1a',
                    padding: '3rem',
                    borderRadius: '15px',
                    textAlign: 'center',
                    border: '1px dashed #2ecc71'
                }}>
                    <p style={{
                        fontSize: '1.2rem',
                        color: '#bbb'
                    }}>
                        {isAmharic
                            ? 'ምንም የቃለ መጠይቅ ቀጠሮ የለም።'
                            : 'No interviews scheduled.'}
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gap: '1.5rem'
                }}>
                    {interviews.map((interview) => (
                        <div
                            key={interview.id}
                            style={{
                                background: 'linear-gradient(145deg, #1a3d1a, #0d210d)',
                                padding: '1.5rem',
                                borderRadius: '15px',
                                border: '1px solid rgba(46, 204, 113, 0.2)',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '1rem',
                                flexWrap: 'wrap'
                            }}>
                                <div>
                                    <h3 style={{
                                        margin: 0,
                                        color: '#2ecc71',
                                        fontSize: '1.4rem'
                                    }}>
                                        {interview.job_title}
                                    </h3>

                                    <p style={{
                                        color: '#bbb',
                                        margin: '5px 0'
                                    }}>
                                        🏢 {interview.company ||
                                            interview.employer_name ||
                                            (isAmharic
                                                ? 'የኩባንያ ስም የለም'
                                                : 'Company not provided')}
                                    </p>

                                    {user.role === 'applicant' &&
                                        interview.employer_name && (
                                            <p style={{
                                                color: '#bbb',
                                                margin: '5px 0'
                                            }}>
                                                👤 {isAmharic
                                                    ? 'አሰሪ፦ '
                                                    : 'Employer: '}
                                                {interview.employer_name}
                                            </p>
                                        )}

                                    {user.role === 'employer' &&
                                        interview.applicant_name && (
                                            <p style={{
                                                color: '#bbb',
                                                margin: '5px 0'
                                            }}>
                                                👤 {isAmharic
                                                    ? 'አመልካች፦ '
                                                    : 'Applicant: '}
                                                {interview.applicant_name}
                                            </p>
                                        )}
                                </div>

                                <span style={{
                                    background: getStatusColor(interview.status),
                                    color: '#000',
                                    padding: '6px 15px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold'
                                }}>
                                    {getStatusLabel(interview.status)}
                                </span>
                            </div>

                            <hr style={{
                                border: '0.5px solid rgba(255,255,255,0.1)',
                                margin: '1.2rem 0'
                            }} />

                            <div style={{ lineHeight: '1.8' }}>
                                <p>
                                    🕒 <strong>
                                        {isAmharic
                                            ? 'ቀን፦'
                                            : 'Date:'}
                                    </strong>{' '}
                                    {formatInterviewDate(interview.scheduled_date)}
                                </p>

                                <p>
                                    ⏰ <strong>
                                        {isAmharic
                                            ? 'ሰዓት፦'
                                            : 'Time:'}
                                    </strong>{' '}
                                    {formatInterviewTime(interview.interview_time) ||
                                        (isAmharic ? 'አልተገለጸም' : 'Not specified')}
                                </p>

                                <p>
                                    📍 <strong>
                                        {isAmharic
                                            ? 'ቦታ/ሊንክ፦'
                                            : 'Location/Link:'}
                                    </strong>{' '}

                                    {(interview.meeting_link || interview.location)
                                        ?.startsWith('http') ? (
                                        <a
                                            href={interview.meeting_link || interview.location}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                color: '#3498db',
                                                textDecoration: 'underline',
                                                fontWeight: '500'
                                            }}
                                        >
                                            {isAmharic
                                                ? 'ወደ ስብሰባው ይቀላቀሉ'
                                                : 'Join Meeting'}
                                        </a>
                                    ) : (
                                        <span style={{ color: '#eee' }}>
                                            {interview.meeting_link ||
                                                interview.location ||
                                                (isAmharic
                                                    ? 'አልተገለጸም'
                                                    : 'Not specified')}
                                        </span>
                                    )}
                                </p>

                                {interview.notes && (
                                    <p style={{
                                        fontSize: '0.95rem',
                                        color: '#aaa',
                                        marginTop: '10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '10px',
                                        borderRadius: '8px'
                                    }}>
                                        📝 <strong>
                                            {isAmharic ? 'ማስታወሻ፦' : 'Notes:'}
                                        </strong>{' '}
                                        {interview.notes}
                                    </p>
                                )}
                            </div>

                            {user.role === 'applicant' &&
                                interview.status === 'pending' && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        marginTop: '1.5rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        <button
                                            onClick={() =>
                                                handleStatusUpdate(interview.id, 'accept')
                                            }
                                            disabled={updatingId !== null}
                                            style={{
                                                background: '#2ecc71',
                                                color: '#000',
                                                border: 'none',
                                                padding: '10px 25px',
                                                borderRadius: '8px',
                                                cursor: updatingId !== null
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                                fontWeight: 'bold',
                                                opacity: updatingId !== null ? 0.6 : 1
                                            }}
                                        >
                                            {updatingId === interview.id
                                                ? (isAmharic ? 'በመጫን ላይ...' : 'Updating...')
                                                : (isAmharic ? 'ተቀበል' : 'Accept')} ✅
                                        </button>

                                        <button
                                            onClick={() =>
                                                handleStatusUpdate(interview.id, 'decline')
                                            }
                                            disabled={updatingId !== null}
                                            style={{
                                                background: 'transparent',
                                                color: '#e74c3c',
                                                border: '1px solid #e74c3c',
                                                padding: '10px 25px',
                                                borderRadius: '8px',
                                                cursor: updatingId !== null
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                                fontWeight: '500',
                                                opacity: updatingId !== null ? 0.6 : 1
                                            }}
                                        >
                                            {isAmharic ? 'እምቢ በል' : 'Decline'} ❌
                                        </button>
                                    </div>
                                )}

                            {user.role === 'applicant' &&
                                interview.status === 'accepted' && (
                                    <div style={{
                                        background: 'rgba(46, 204, 113, 0.1)',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        marginTop: '1rem',
                                        borderLeft: '4px solid #2ecc71'
                                    }}>
                                        <p style={{
                                            color: '#2ecc71',
                                            margin: 0,
                                            fontSize: '0.9rem'
                                        }}>
                                            ✓ {isAmharic
                                                ? 'የቃለ መጠይቁን ቀጠሮ ተቀብለዋል። መልካም ዕድል!'
                                                : 'You have accepted this interview. Good luck!'}
                                        </p>
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
