import React, { useState, useEffect } from 'react';

const AnalyticsDashboard = () => {
    const [popularJobs, setPopularJobs] = useState([]);
    const [jobsByType, setJobsByType] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const [popularRes, typeRes, timelineRes] = await Promise.all([
                fetch('http://localhost:5000/api/analytics/popular-jobs'),
                fetch('http://localhost:5000/api/analytics/jobs-by-type'),
                fetch('http://localhost:5000/api/analytics/applications-timeline')
            ]);
            
            setPopularJobs(await popularRes.json());
            setJobsByType(await typeRes.json());
            setTimeline(await timelineRes.json());
            setLoading(false);
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setLoading(false);
        }
    };

    const styles = {
        container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
        title: { color: '#2ecc71', marginBottom: '20px', fontSize: '2rem' },
        section: { marginBottom: '30px', background: 'rgba(30,60,30,0.8)', padding: '20px', borderRadius: '15px' },
        sectionTitle: { fontSize: '1.5rem', marginBottom: '15px', color: '#2ecc71' },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' },
        card: { background: 'rgba(10,42,10,0.8)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(46,204,113,0.3)' },
        cardTitle: { color: '#2ecc71', marginBottom: '10px' },
        statNumber: { fontSize: '2rem', fontWeight: 'bold', color: '#2ecc71' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { padding: '12px', textAlign: 'left', background: '#2ecc71', color: '#fff' },
        td: { padding: '10px', borderBottom: '1px solid rgba(46,204,113,0.3)' },
        loading: { textAlign: 'center', padding: '50px', fontSize: '1.2rem' }
    };

    if (loading) {
        return <div style={styles.loading}>📊 Loading analytics...</div>;
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>📊 Analytics Dashboard</h1>
            
            {/* Popular Jobs Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🔥 Most Popular Jobs</h2>
                <div style={styles.grid}>
                    {popularJobs.length > 0 ? (
                        popularJobs.map(job => (
                            <div key={job.id || job.title || Math.random()} style={styles.card}>
                                <h3 style={styles.cardTitle}>{job.title}</h3>
                                <p>{job.company}</p>
                                <p><strong>Applications:</strong> <span style={styles.statNumber}>{job.applications}</span></p>
                            </div>
                        ))
                    ) : (
                        <p>No job applications yet.</p>
                    )}
                </div>
            </div>
            
            {/* Jobs by Type Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📋 Jobs by Type</h2>
                <div style={styles.grid}>
                    {jobsByType.length > 0 ? (
                        jobsByType.map(type => (
                            <div key={type.type || 'Not specified'} style={styles.card}>
                                <div style={styles.statNumber}>{type.count}</div>
                                <p>{type.type || 'Not specified'}</p>
                            </div>
                        ))
                    ) : (
                        <p>No jobs found.</p>
                    )}
                </div>
            </div>
            
            {/* Applications Timeline Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📅 Applications (Last 30 Days)</h2>
                {timeline.length > 0 ? (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Applications</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timeline.map(item => (
                                <tr key={item.date}>
                                    <td style={styles.td}>{item.date}</td>
                                    <td style={styles.td}>{item.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No applications in the last 30 days.</p>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;