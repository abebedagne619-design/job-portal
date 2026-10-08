import React, { useState, useEffect, useCallback } from 'react';

const AdminDashboard = ({ user }) => {
    const [jobs, setJobs] = useState([]);
    const [users, setUsers] = useState([]);
    const [applications, setApplications] = useState([]);
    const [stats, setStats] = useState({});
    const [activeTab, setActiveTab] = useState('jobs');
    const [newJob, setNewJob] = useState({ 
        title: '', 
        company: '', 
        location: '', 
        description: '', 
        salary: '', 
        type: 'Full-time',
        employer_id: '' 
    });

    // fetchDataን useCallback ውስጥ ማድረጉ ለ performance ጥሩ ነው
    const fetchData = useCallback(async () => {
        try {
            const [jobsRes, usersRes, appsRes, statsRes] = await Promise.all([
                fetch('http://localhost:5000/api/jobs'),
                fetch('http://localhost:5000/api/users'),
                fetch('http://localhost:5000/api/applications'),
                fetch('http://localhost:5000/api/stats')
            ]);

            if (!jobsRes.ok || !usersRes.ok || !appsRes.ok || !statsRes.ok) {
                console.warn('አንዳንዶቹ APIዎች ዳታ አልመለሱም');
            }

            // እያንዳንዱን በየተራ parse ማድረግ
            const jobsData = await jobsRes.json();
            const usersData = await usersRes.json();
            const appsData = await appsRes.json();
            const statsData = await statsRes.json();

            setJobs(jobsData);
            setUsers(usersData);
            setApplications(appsData);
            setStats(statsData);
        } catch (err) {
            console.error('Error fetching data:', err);
        }
    }, []);

    useEffect(() => { 
        fetchData(); 
    }, [fetchData]);

    const addJob = async () => {
        if (!newJob.title || !newJob.employer_id) {
            alert('እባክሽን የስራውን ርዕስ እና ቀጣሪውን (Employer) ምረጪ!');
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/api/jobs', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJob)
            });

            if (res.ok) {
                alert('Job added successfully!');
                setNewJob({ title: '', company: '', location: '', description: '', salary: '', type: 'Full-time', employer_id: '' });
                fetchData();
            }
        } catch (err) {
            console.error('Error adding job:', err);
        }
    };

    const deleteJob = async (id) => {
        if (window.confirm('Delete this job?')) {
            await fetch(`http://localhost:5000/api/jobs/${id}`, { method: 'DELETE' });
            fetchData();
        }
    };

    const updateApplicationStatus = async (id, status) => {
        try {
            await fetch(`http://localhost:5000/api/applications/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchData();
            alert('Status updated!');
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const deleteApplication = async (id) => {
        if (window.confirm('Delete this application?')) {
            await fetch(`http://localhost:5000/api/applications/${id}`, { method: 'DELETE' });
            fetchData();
        }
    };

    const styles = {
        container: { padding: '20px', color: '#fff' },
        title: { color: '#2ecc71', marginBottom: '20px' },
        stats: { display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' },
        statCard: { background: 'rgba(30,60,30,0.8)', padding: '20px', borderRadius: '15px', flex: 1, textAlign: 'center', minWidth: '150px' },
        statNum: { fontSize: '2rem', color: '#2ecc71' },
        tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
        tab: { padding: '10px 20px', background: '#1a3d1a', borderRadius: '10px', cursor: 'pointer', border: 'none', color: '#fff' },
        activeTab: { background: '#2ecc71', color: '#fff' },
        form: { background: 'rgba(30,60,30,0.8)', padding: '20px', borderRadius: '15px', marginBottom: '20px' },
        input: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', background: '#0a2a0a', color: '#fff', border: 'none' },
        textarea: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', background: '#0a2a0a', color: '#fff', border: 'none', minHeight: '80px' },
        select: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', background: '#0a2a0a', color: '#fff', border: 'none' },
        btn: { padding: '10px 20px', background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' },
        table: { width: '100%', borderCollapse: 'collapse', background: 'rgba(30,60,30,0.8)', borderRadius: '15px', overflow: 'hidden' },
        th: { padding: '12px', textAlign: 'left', background: '#2ecc71', color: '#fff' },
        td: { padding: '12px', borderBottom: '1px solid rgba(46,204,113,0.3)' },
        deleteBtn: { padding: '5px 10px', background: '#ef4444', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer', marginRight: '5px' },
        statusSelect: { padding: '5px', borderRadius: '5px', background: '#0a2a0a', color: '#fff', border: '1px solid #2ecc71', cursor: 'pointer' }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Admin Dashboard</h1>

            {/* Stats Summary */}
            <div style={styles.stats}>
                <div style={styles.statCard}><div style={styles.statNum}>{stats.jobs || 0}</div><div>Total Jobs</div></div>
                <div style={styles.statCard}><div style={styles.statNum}>{stats.users || 0}</div><div>Total Users</div></div>
                <div style={styles.statCard}><div style={styles.statNum}>{stats.applications || 0}</div><div>Applications</div></div>
            </div>

            {/* Navigation Tabs */}
            <div style={styles.tabs}>
                <button style={{...styles.tab, ...(activeTab === 'jobs' ? styles.activeTab : {})}} onClick={() => setActiveTab('jobs')}>📋 Jobs</button>
                <button style={{...styles.tab, ...(activeTab === 'applications' ? styles.activeTab : {})}} onClick={() => setActiveTab('applications')}>📝 Applications</button>
                <button style={{...styles.tab, ...(activeTab === 'users' ? styles.activeTab : {})}} onClick={() => setActiveTab('users')}>👥 Users</button>
            </div>

            {/* Jobs Management Section */}
            {activeTab === 'jobs' && (
                <>
                    <div style={styles.form}>
                        <h3>Add New Job</h3>
                        <select 
                            style={styles.select} 
                            value={newJob.employer_id} 
                            onChange={e => setNewJob({...newJob, employer_id: e.target.value})}
                        >
                            <option value="">-- Select Employer * --</option>
                            {users.filter(u => u.role === 'employer').map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.email})
                                </option>
                            ))}
                        </select>

                        <input style={styles.input} placeholder="Title *" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} />
                        <input style={styles.input} placeholder="Company *" value={newJob.company} onChange={e => setNewJob({...newJob, company: e.target.value})} />
                        <input style={styles.input} placeholder="Location" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} />
                        <input style={styles.input} placeholder="Salary" value={newJob.salary} onChange={e => setNewJob({...newJob, salary: e.target.value})} />
                        <textarea style={styles.textarea} placeholder="Description" value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} />
                        <select style={styles.select} value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})}>
                            <option>Full-time</option><option>Part-time</option><option>Remote</option><option>Contract</option>
                        </select>
                        <button style={styles.btn} onClick={addJob}>➕ Add Job</button>
                    </div>

                    <table style={styles.table}>
                        <thead><tr><th style={styles.th}>ID</th><th style={styles.th}>Title</th><th style={styles.th}>Company</th><th style={styles.th}>Location</th><th style={styles.th}>Actions</th></tr></thead>
                        <tbody>
                            {jobs.map(job => (
    <tr key={job.id}>
        <td style={styles.td}>{job.id}</td>
        <td style={styles.td}>{job.title}</td>
        <td style={styles.td}>{job.company}</td>
        <td style={styles.td}>{job.location}</td>
        <td style={styles.td}>
            <button style={styles.deleteBtn} onClick={() => deleteJob(job.id)}>Delete</button>
        </td>
    </tr>
))}
                        </tbody>
                    </table>
                </>
            )}

            {/* Applications Management Section */}
            {activeTab === 'applications' && (
                <table style={styles.table}>
                    <thead>
                        <tr><th style={styles.th}>ID</th><th style={styles.th}>Job</th><th style={styles.th}>Applicant</th><th style={styles.th}>Status</th><th style={styles.th}>Actions</th></tr>
                    </thead>
                    <tbody>
                        {applications.map(app => (
    <tr key={app.id}>
        <td style={styles.td}>{app.id}</td>
        {/* በ Backend 'j.title AS job_title' ካልሽ app.job_title ትክክል ነው */}
        <td style={styles.td}>{app.job_title || 'No Title'}</td>
        {/* በ ምስሉ image_144716.png ላይ ኮለሙ 'name' ስለሚል app.name ይጠቀማል */}
        <td style={styles.td}>{app.name || app.applicant_name}</td> 
        <td style={styles.td}>
            <select 
                style={styles.statusSelect} 
                value={app.status} 
                onChange={(e) => updateApplicationStatus(app.id, e.target.value)}
            >
                <option value="pending">⏳ Pending</option>
                <option value="reviewed">👀 Reviewed</option>
                <option value="accepted">✅ Accepted</option>
                <option value="rejected">❌ Rejected</option>
            </select>
        </td>
        <td style={styles.td}>
            <button style={styles.deleteBtn} onClick={() => deleteApplication(app.id)}>Delete</button>
        </td>
    </tr>
))}
                    </tbody>
                </table>
            )}

            {/* Users Management Section */}
            {activeTab === 'users' && (
                <table style={styles.table}>
                    <thead>
                        <tr><th style={styles.th}>ID</th><th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Role</th></tr>
                    </thead>
                    <tbody>
                        {users.map(userItem => (
                            <tr key={userItem.id}>
                                <td style={styles.td}>{userItem.id}</td>
                                <td style={styles.td}>{userItem.name}</td>
                                <td style={styles.td}>{userItem.email}</td>
                                <td style={styles.td}>{userItem.role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default AdminDashboard;