
import React, { useState } from 'react';

const ScheduleInterview = ({ job, applicant, employer, onClose, onScheduled }) => {
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Local date (avoids UTC date differences)
    const now = new Date();
    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!scheduledDate || !scheduledTime) {
            return alert('እባክዎ ቀን እና ሰዓት ይምረጡ!');
        }

        if (!applicant?.id) {
            console.error('Missing Applicant ID:', applicant);
            return alert('❌ ስህተት፡ የአመልካቹ መታወቂያ አልተገኘም!');
        }

        if (!job?.id) {
            return alert('❌ የሥራው Job ID አልተገኘም!');
        }

        if (!meetingLink.trim()) {
            return alert('እባክዎ Meeting Link ወይም Office Address ያስገቡ!');
        }

        const token = sessionStorage.getItem('token');

        if (!token) {
            return alert('❌ Login session አልተገኘም። እባክዎ Logout እና Login ያድርጉ።');
        }

        setLoading(true);

        const dateTime = `${scheduledDate} ${scheduledTime}:00`;

        const interviewData = {
            jobId: job.id,
            applicantId: applicant.id,
            scheduledDate: dateTime,
            meetingLink: meetingLink.trim(),
            notes: notes.trim()
        };

        console.log('Interview Data:', interviewData);

        try {
            const res = await fetch('http://localhost:5000/api/interviews/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(interviewData)
            });

            let result = {};

            try {
                result = await res.json();
            } catch {
                result = {};
            }

            if (!res.ok) {
                console.error('Schedule Interview Error:', result);

                if (res.status === 401 || res.status === 403) {
                    alert(`❌ ${result.message || result.error || 'Unauthorized. Please login again.'}`);
                } else {
                    alert(`❌ Failed: ${result.message || result.error || `Server Error (${res.status})`}`);
                }

                return;
            }

            alert('🎉 Interview scheduled successfully!');

            if (onScheduled) {
                onScheduled();
            }

            onClose();

        } catch (err) {
            console.error('Network Error:', err);
            alert('❌ Server is not responding. Check if backend is running.');
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem'
        },
        modal: {
            background: 'linear-gradient(145deg, #1a3d1a, #0a2a0a)',
            padding: '2.5rem',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            border: '1px solid rgba(46, 204, 113, 0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            color: '#fff',
            maxHeight: '90vh',
            overflowY: 'auto'
        },
        title: {
            color: '#2ecc71',
            marginBottom: '0.5rem',
            fontSize: '1.8rem',
            textAlign: 'center'
        },
        subTitle: {
            textAlign: 'center',
            color: '#bbb',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
        },
        label: {
            display: 'block',
            marginBottom: '0.4rem',
            fontSize: '0.85rem',
            color: '#2ecc71'
        },
        input: {
            width: '100%',
            padding: '0.9rem',
            marginBottom: '1.2rem',
            borderRadius: '12px',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            background: 'rgba(10, 42, 10, 0.6)',
            color: '#fff',
            outline: 'none',
            fontSize: '1rem',
            boxSizing: 'border-box'
        },
        textarea: {
            width: '100%',
            padding: '0.9rem',
            marginBottom: '1.2rem',
            borderRadius: '12px',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            background: 'rgba(10, 42, 10, 0.6)',
            color: '#fff',
            minHeight: '100px',
            outline: 'none',
            fontSize: '1rem',
            resize: 'vertical',
            boxSizing: 'border-box'
        },
        btn: {
            width: '100%',
            padding: '1rem',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '12px',
            color: '#0a2a0a',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem',
            transition: '0.3s'
        },
        cancelBtn: {
            width: '100%',
            padding: '1rem',
            background: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            color: '#ef4444',
            cursor: 'pointer',
            marginTop: '0.8rem',
            fontSize: '1rem',
            transition: '0.3s'
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 style={styles.title}>Schedule Interview</h2>

                <div style={styles.subTitle}>
                    Scheduling for: <strong>{applicant?.name}</strong>
                    <br />
                    Job: <i>{job?.title}</i>
                </div>

                <form onSubmit={handleSubmit}>
                    <label style={styles.label}>Interview Date</label>
                    <input
                        style={styles.input}
                        type="date"
                        min={today}
                        value={scheduledDate}
                        onChange={e => setScheduledDate(e.target.value)}
                        required
                    />

                    <label style={styles.label}>Interview Time</label>
                    <input
                        style={styles.input}
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        required
                    />

                    <label style={styles.label}>
                        Meeting Link or Office Address
                    </label>
                    <input
                        style={styles.input}
                        type="text"
                        placeholder="Zoom link or Office Location"
                        value={meetingLink}
                        onChange={e => setMeetingLink(e.target.value)}
                        required
                    />

                    <label style={styles.label}>Additional Notes</label>
                    <textarea
                        style={styles.textarea}
                        placeholder="Add any instructions for the candidate..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />

                    <button
                        style={{
                            ...styles.btn,
                            opacity: loading ? 0.7 : 1
                        }}
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Scheduling...' : '✅ Confirm & Schedule'}
                    </button>

                    <button
                        style={styles.cancelBtn}
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ScheduleInterview;
