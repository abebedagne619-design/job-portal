
import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

const SavedJobs = ({ user }) => {
    const [savedJobs, setSavedJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.id) {
            fetchSavedJobs();
        } else {
            setSavedJobs([]);
            setLoading(false);
        }
    }, [user]);

    const fetchSavedJobs = async () => {
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/saved`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const contentType = res.headers.get('content-type');

            if (!res.ok || !contentType || !contentType.includes('application/json')) {
                throw new TypeError("Oops, we didn't get JSON from the server!");
            }

            const data = await res.json();

            setSavedJobs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching saved jobs:', err);
            setSavedJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const removeSaved = async (jobId) => {
        if (!window.confirm('Are you sure you want to remove this job?')) {
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/saved`, {
                method: 'DELETE',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ jobId })
            });

            const contentType = res.headers.get('content-type');

            if (!res.ok) {
                let errorMessage = 'Failed to remove saved job';

                if (contentType && contentType.includes('application/json')) {
                    const error = await res.json();
                    errorMessage = error.message || errorMessage;
                }

                throw new Error(errorMessage);
            }

            setSavedJobs(prevJobs =>
                prevJobs.filter(job => job.job_id !== jobId)
            );
        } catch (err) {
            console.error('Error removing saved job:', err);
            alert(err.message || 'An error occurred. Please try again.');
        }
    };

    const styles = {
        container: {
            padding: '2rem 5%',
            minHeight: '80vh'
        },
        title: {
            fontSize: '2rem',
            marginBottom: '2rem',
            color: '#2ecc71',
            borderBottom: '2px solid #2ecc71',
            display: 'inline-block'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
        },
        card: {
            background: 'rgba(30,60,30,0.9)',
            padding: '1.5rem',
            borderRadius: '15px',
            border: '1px solid rgba(46,204,113,0.3)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'transform 0.3s ease'
        },
        jobTitle: {
            color: '#fff',
            fontSize: '1.3rem',
            marginBottom: '0.5rem'
        },
        company: {
            color: '#2ecc71',
            fontWeight: 'bold',
            marginBottom: '1rem'
        },
        info: {
            color: '#bdc3c7',
            fontSize: '0.9rem',
            margin: '5px 0'
        },
        removeBtn: {
            padding: '0.6rem 1.2rem',
            background: '#ef4444',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            marginTop: '1.2rem',
            width: '100%',
            fontWeight: 'bold'
        },
        loading: {
            textAlign: 'center',
            padding: '5rem',
            color: '#2ecc71',
            fontSize: '1.5rem'
        },
        noData: {
            textAlign: 'center',
            padding: '3rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '15px'
        }
    };

    if (loading) {
        return (
            <div style={styles.loading}>
                ⌛ Loading your saved jobs...
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>
                📚 Saved Jobs ({savedJobs.length})
            </h1>

            {savedJobs.length === 0 ? (
                <div style={styles.noData}>
                    <p style={{ fontSize: '1.2rem', color: '#bdc3c7' }}>
                        No saved jobs yet.
                    </p>
                    <p>
                        Click the "Save" icon on any job post to see it here!
                    </p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {savedJobs.map(job => (
                        <div
                            key={job.saved_id || job.id || job.job_id}
                            style={styles.card}
                        >
                            <h3 style={styles.jobTitle}>
                                {job.title}
                            </h3>

                            <p style={styles.company}>
                                🏢 {job.company}
                            </p>

                            <p style={styles.info}>
                                📍 {job.location || 'Remote'}
                            </p>

                            <p style={styles.info}>
                                💰 {job.salary || 'Negotiable'}
                            </p>

                            <p
                                style={{
                                    ...styles.info,
                                    fontStyle: 'italic',
                                    fontSize: '0.8rem'
                                }}
                            >
                                Saved on: {
                                    job.saved_at
                                        ? new Date(job.saved_at).toLocaleDateString()
                                        : 'Date unavailable'
                                }
                            </p>

                            <button
                                style={styles.removeBtn}
                                onClick={() => removeSaved(job.job_id)}
                            >
                                🗑️ Remove from Saved
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedJobs;
