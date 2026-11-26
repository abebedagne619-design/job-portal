
import React, { useState } from 'react';
import { API_URL } from '../config/api';

const JobAlerts = ({ user }) => {
    const [keyword, setKeyword] = useState('');
    const [location, setLocation] = useState('');
    const [jobType, setJobType] = useState('');
    const [loading, setLoading] = useState(false);

    const createAlert = async () => {
        if (!user?.id) {
            alert('Please login to create job alerts');
            return;
        }

        if (!keyword && !location && !jobType) {
            alert('Please fill at least one field');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/alerts`, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keyword,
                    location,
                    type: jobType
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('Job alert created successfully!');
                setKeyword('');
                setLocation('');
                setJobType('');
            } else {
                console.error('Server error:', data);
                alert(`Failed: ${data.error || data.message || 'Unknown error'}`);
            }

        } catch (err) {
            console.error('Error creating alert:', err);
            alert('Failed to create alert. Please try again.');

        } finally {
            setLoading(false);
        }
    };

    const styles = {
        container: {
            background: 'rgba(30, 60, 30, 0.8)',
            backdropFilter: 'blur(10px)',
            padding: '2rem',
            borderRadius: '15px',
            border: '1px solid rgba(46, 204, 113, 0.3)',
            maxWidth: '400px',
            margin: '1rem auto',
            color: '#fff'
        },
        input: {
            width: '100%',
            padding: '0.8rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            border: '1px solid #444',
            background: '#0a1a0a',
            color: '#fff',
            outline: 'none'
        },
        button: {
            width: '100%',
            padding: '1rem',
            background: '#2ecc71',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'background 0.3s'
        }
    };

    return (
        <div style={styles.container}>
            <h3 style={{ color: '#2ecc71', marginBottom: '1.5rem' }}>
                🔔 Create Job Alert
            </h3>

            <label>Keyword</label>
            <input
                style={styles.input}
                placeholder="e.g., React, Designer"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
            />

            <label>Location</label>
            <input
                style={styles.input}
                placeholder="e.g., Addis Ababa, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
            />

            <label>Job Type</label>
            <select
                style={styles.input}
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
            >
                <option value="">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Remote">Remote</option>
                <option value="Contract">Contract</option>
            </select>

            <button
                style={styles.button}
                onClick={createAlert}
                disabled={loading}
            >
                {loading ? 'Creating...' : 'Set Alert'}
            </button>
        </div>
    );
};

export default JobAlerts;
