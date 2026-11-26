
import React, { useState } from 'react';
import { API_URL } from '../config/api';

const ScheduleInterview = ({
    job,
    applicant,
    employer,
    onClose,
    onScheduled
}) => {
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [interviewType, setInterviewType] = useState('online');
    const [meetingLink, setMeetingLink] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const now = new Date();

    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');

    const isValidMeetingLink = (value) => {
        try {
            const url = new URL(value.trim());

            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                return false;
            }

            const host = url.hostname.toLowerCase();

            return (
                host === 'meet.google.com' ||
                host.endsWith('.zoom.us') ||
                host === 'zoom.us' ||
                host === 'teams.microsoft.com' ||
                host.endsWith('.teams.microsoft.com') ||
                host === 'whereby.com' ||
                host.endsWith('.whereby.com')
            );
        } catch {
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!scheduledDate || !scheduledTime) {
            return alert('እባክዎ የInterview ቀንና ሰዓት ይምረጡ!');
        }

        if (scheduledDate < today) {
            return alert('ያለፈ ቀን መምረጥ አይችሉም!');
        }

        if (!applicant?.id) {
            return alert('❌ የApplicant ID አልተገኘም!');
        }

        if (!job?.id) {
            return alert('❌ Job ID አልተገኘም!');
        }

        if (interviewType === 'online') {
            if (!meetingLink.trim()) {
                return alert('እባክዎ Meeting Link ያስገቡ!');
            }

            if (!isValidMeetingLink(meetingLink)) {
                return alert(
                    '❌ ትክክለኛ Google Meet, Zoom, Teams ወይም Whereby Link ያስገቡ!'
                );
            }
        }

        if (interviewType === 'onsite' && !location.trim()) {
            return alert('እባክዎ የInterview ቦታ ያስገቡ!');
        }

        setLoading(true);

        const dateTime = `${scheduledDate} ${scheduledTime}:00`;

        const interviewData = {
            jobId: job.id,
            applicantId: applicant.id,
            scheduledDate: dateTime,
            meetingLink: interviewType === 'online'
                ? meetingLink.trim()
                : '',
            location: interviewType === 'onsite'
                ? location.trim()
                : '',
            notes: notes.trim()
        };

        try {
            const res = await fetch(
                `${API_URL}/api/interviews/schedule`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(interviewData)
                }
            );

            let result = {};

            try {
                result = await res.json();
            } catch {
                result = {};
            }

            if (!res.ok) {
                console.error('Schedule Error:', result);

                alert(
                    `❌ ${result.message || result.error || 'Failed to schedule interview'}`
                );

                return;
            }

            alert('🎉 Interview scheduled successfully!');

            if (onScheduled) {
                onScheduled();
            }

            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('Network Error:', err);
            alert('❌ Server is not responding. Check backend.');
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed',
            inset: 0,
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
            padding: '2rem',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            border: '1px solid rgba(46, 204, 113, 0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            color: '#fff',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box'
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
            border: '1px solid rgba(46, 204, 113, 0.3)',
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
            border: '1px solid rgba(46, 204, 113, 0.3)',
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
            fontSize: '1rem'
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
            fontSize: '1rem'
        },
        radioBox: {
            display: 'flex',
            gap: '12px',
            marginBottom: '1.3rem',
            flexWrap: 'wrap'
        },
        radioLabel: {
            flex: 1,
            minWidth: '120px',
            padding: '12px',
            border: '1px solid rgba(46,204,113,0.4)',
            borderRadius: '10px',
            cursor: 'pointer',
            textAlign: 'center',
            background: 'rgba(10,42,10,0.5)'
        },
        hint: {
            color: '#bbb',
            fontSize: '0.78rem',
            marginTop: '-0.8rem',
            marginBottom: '1.2rem'
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div
                style={styles.modal}
                onClick={e => e.stopPropagation()}
            >
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

                    <label style={styles.label}>Interview Type</label>

                    <div style={styles.radioBox}>
                        <label style={styles.radioLabel}>
                            <input
                                type="radio"
                                name="interviewType"
                                value="online"
                                checked={interviewType === 'online'}
                                onChange={() => {
                                    setInterviewType('online');
                                    setLocation('');
                                }}
                            />
                            {' '}Online
                        </label>

                        <label style={styles.radioLabel}>
                            <input
                                type="radio"
                                name="interviewType"
                                value="onsite"
                                checked={interviewType === 'onsite'}
                                onChange={() => {
                                    setInterviewType('onsite');
                                    setMeetingLink('');
                                }}
                            />
                            {' '}Office / On-site
                        </label>
                    </div>

                    {interviewType === 'online' && (
                        <>
                            <label style={styles.label}>
                                Meeting Link
                            </label>

                            <input
                                style={styles.input}
                                type="url"
                                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                                value={meetingLink}
                                onChange={e => setMeetingLink(e.target.value)}
                                required
                            />

                            <div style={styles.hint}>
                                Supported: Google Meet, Zoom, Microsoft Teams, Whereby
                            </div>
                        </>
                    )}

                    {interviewType === 'onsite' && (
                        <>
                            <label style={styles.label}>
                                Office Address / Location
                            </label>

                            <input
                                style={styles.input}
                                type="text"
                                placeholder="Example: Addis Ababa, Bole Office"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                required
                            />
                        </>
                    )}

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
