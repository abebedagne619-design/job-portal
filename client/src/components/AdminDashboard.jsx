
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { API_URL } from '../config/api';

const AdminDashboard = ({ user }) => {
    const { language, t } = useLanguage();
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

    // Fetch all dashboard data
const fetchData = useCallback(async () => {
    try {

        const [jobsRes, usersRes, appsRes, statsRes] =
            await Promise.all([

                fetch(`${API_URL}/api/jobs`, {
                    credentials: 'include',
                    cache: 'no-store'
                }),

                fetch(`${API_URL}/api/users`, {
                    credentials: 'include',
                    cache: 'no-store'
                }),

                fetch(`${API_URL}/api/applications`, {
                    credentials: 'include',
                    cache: 'no-store'
                }),

                fetch(`${API_URL}/api/stats`, {
                    credentials: 'include',
                    cache: 'no-store'
                })

            ]);

        console.log('ADMIN API STATUS:', {
            jobs: jobsRes.status,
            users: usersRes.status,
            applications: appsRes.status,
            stats: statsRes.status
        });

        const responses = [
            { name: 'Jobs', response: jobsRes },
            { name: 'Users', response: usersRes },
            { name: 'Applications', response: appsRes },
            { name: 'Stats', response: statsRes }
        ];

        for (const item of responses) {

            if (!item.response.ok) {

                const errorText = await item.response.text();

                throw new Error(
                    `${item.name} API failed (${item.response.status}): ${errorText}`
                );

            }

        }

        const [jobsData, usersData, appsData, statsData] =
            await Promise.all([
                jobsRes.json(),
                usersRes.json(),
                appsRes.json(),
                statsRes.json()
            ]);

        const normalizedJobs = Array.isArray(jobsData)
            ? jobsData
            : Array.isArray(jobsData?.data)
                ? jobsData.data
                : [];

        const normalizedUsers = Array.isArray(usersData)
            ? usersData
            : Array.isArray(usersData?.data)
                ? usersData.data
                : [];

        const normalizedApplications = Array.isArray(appsData)
            ? appsData
            : Array.isArray(appsData?.data)
                ? appsData.data
                : [];

        setJobs(normalizedJobs);
        setUsers(normalizedUsers);
        setApplications(normalizedApplications);
        setStats(statsData?.data || statsData || {});

        console.log(
            'ADMIN APPLICATIONS LOADED:',
            normalizedApplications.length,
            normalizedApplications
        );

    } catch (err) {

        console.error('Admin Dashboard fetch error:', err);

    }

}, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Add job
    const addJob = async () => {
        if (!newJob.title || !newJob.employer_id) {
            alert(language === "am" ? "እባክዎ የሥራ ርዕስ ያስገቡ እና ቀጣሪ ይምረጡ።" : "Please enter the job title and select an employer.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(newJob)
});
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to add job');
            }

            alert(language === "am" ? "ሥራው በተሳካ ሁኔታ ታክሏል!" : "Job added successfully!");

            setNewJob({
                title: '',
                company: '',
                location: '',
                description: '',
                salary: '',
                type: 'Full-time',
                employer_id: ''
            });

            await fetchData();

        } catch (err) {
            console.error('Error adding job:', err);
            alert(err.message);
        }
    };

    // Delete job
    const deleteJob = async (id) => {
        if (!window.confirm(language === "am" ? "ይህን ሥራ ማጥፋት ይፈልጋሉ?" : "Delete this job?")) return;

        try {
         const res = await fetch(
    `${API_URL}/api/jobs/${id}`,
    {
        method: 'DELETE',
        credentials: 'include'
    }
);
            if (!res.ok) {
                throw new Error(language === "am" ? "ሥራውን ማጥፋት አልተቻለም።" : "Failed to delete job");
            }

            await fetchData();

        } catch (err) {
            console.error('Error deleting job:', err);
            alert(err.message);
        }
    };

    // Update application status
    const updateApplicationStatus = async (id, status) => {
        try {
          const res = await fetch(
    `${API_URL}/api/applications/${id}/status`,
    {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    }
);

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || (language === "am" ? "ሁኔታውን ማዘመን አልተቻለም።" : "Failed to update status"));
            }

            await fetchData();
            alert(language === "am" ? "የማመልከቻው ሁኔታ ተዘምኗል!" : "Application status updated!");

        } catch (err) {
            console.error('Error updating application:', err);
            alert(err.message);
        }
    };

    // Delete application
    const deleteApplication = async (id) => {
        if (!window.confirm(language === "am" ? "ይህን የሥራ ማመልከቻ ማጥፋት ይፈልጋሉ?" : "Delete this application?")) return;

        try {
         const res = await fetch(
    `${API_URL}/api/applications/${id}`,
    {
        method: 'DELETE',
        credentials: 'include'
    }
);

            if (!res.ok) {
                throw new Error(language === "am" ? "የሥራ ማመልከቻውን ማጥፋት አልተቻለም።" : "Failed to delete application");
            }

            await fetchData();

        } catch (err) {
            console.error('Error deleting application:', err);
            alert(err.message);
        }
    };

    const styles = {
        container: {
            padding: '20px',
            color: '#fff'
        },
        title: {
            color: '#2ecc71',
            marginBottom: '20px'
        },
        stats: {
            display: 'flex',
            gap: '20px',
            marginBottom: '30px',
            flexWrap: 'wrap'
        },
        statCard: {
            background: 'rgba(30,60,30,0.8)',
            padding: '20px',
            borderRadius: '15px',
            flex: 1,
            textAlign: 'center',
            minWidth: '150px'
        },
        statNum: {
            fontSize: '2rem',
            color: '#2ecc71'
        },
        tabs: {
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
        },
        tab: {
            padding: '10px 20px',
            background: '#1a3d1a',
            borderRadius: '10px',
            cursor: 'pointer',
            border: 'none',
            color: '#fff'
        },
        activeTab: {
            background: '#2ecc71',
            color: '#fff'
        },
        form: {
            background: 'rgba(30,60,30,0.8)',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '20px'
        },
        input: {
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '8px',
            background: '#0a2a0a',
            color: '#fff',
            border: 'none'
        },
        textarea: {
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '8px',
            background: '#0a2a0a',
            color: '#fff',
            border: 'none',
            minHeight: '80px'
        },
        select: {
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '8px',
            background: '#0a2a0a',
            color: '#fff',
            border: 'none'
        },
        btn: {
            padding: '10px 20px',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            background: 'rgba(30,60,30,0.8)',
            borderRadius: '15px',
            overflow: 'hidden'
        },
        th: {
            padding: '12px',
            textAlign: 'left',
            background: '#2ecc71',
            color: '#fff'
        },
        td: {
            padding: '12px',
            borderBottom: '1px solid rgba(46,204,113,0.3)'
        },
        deleteBtn: {
            padding: '5px 10px',
            background: '#ef4444',
            border: 'none',
            borderRadius: '5px',
            color: '#fff',
            cursor: 'pointer',
            marginRight: '5px'
        },
        statusSelect: {
            padding: '5px',
            borderRadius: '5px',
            background: '#0a2a0a',
            color: '#fff',
            border: '1px solid #2ecc71',
            cursor: 'pointer'
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>{language === "am" ? "የአስተዳዳሪ ዳሽቦርድ" : "Admin Dashboard"}</h1>

            {/* Stats Summary */}
            <div style={styles.stats}>
                <div style={styles.statCard}>
                    <div style={styles.statNum}>{stats.jobs || 0}</div>
                    <div>{language === "am" ? "ጠቅላላ ሥራዎች" : "Total Jobs"}</div>
                </div>

                <div style={styles.statCard}>
                    <div style={styles.statNum}>{stats.users || 0}</div>
                    <div>{language === "am" ? "ጠቅላላ ተጠቃሚዎች" : "Total Users"}</div>
                </div>

                <div style={styles.statCard}>
                    <div style={styles.statNum}>{stats.applications || 0}</div>
                    <div>{language === "am" ? "የሥራ ማመልከቻዎች" : "Applications"}</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={styles.tabs}>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'jobs' ? styles.activeTab : {})
                    }}
                    onClick={() => setActiveTab('jobs')}
                >
                    {language === "am" ? "📋 ሥራዎች" : "📋 Jobs"}
                </button>

                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'applications' ? styles.activeTab : {})
                    }}
                    onClick={() => setActiveTab('applications')}
                >
                    {language === "am" ? `📝 ማመልከቻዎች (${applications.length})` : `📝 Applications (${applications.length})`}
                </button>

                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'users' ? styles.activeTab : {})
                    }}
                    onClick={() => setActiveTab('users')}
                >
                    {language === "am" ? "👥 ተጠቃሚዎች" : "👥 Users"}
                </button>
            </div>

            {/* Jobs Management */}
            {activeTab === 'jobs' && (
                <>
                    <div style={styles.form}>
                        <h3>{language === "am" ? "አዲስ ሥራ ጨምር" : "Add New Job"}</h3>

                        <select
                            style={styles.select}
                            value={newJob.employer_id}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    employer_id: e.target.value
                                })
                            }
                        >
                            <option value="">{language === "am" ? "-- ቀጣሪ ይምረጡ * --" : "-- Select Employer * --"}</option>

                            {users
                                .filter(u => u.role === 'employer')
                                .map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.email})
                                    </option>
                                ))}
                        </select>

                        <input
                            style={styles.input}
                            placeholder={language === "am" ? "የሥራ ርዕስ *" : "Title *"}
                            value={newJob.title}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    title: e.target.value
                                })
                            }
                        />

                        <input
                            style={styles.input}
                            placeholder={language === "am" ? "የድርጅት ስም *" : "Company *"}
                            value={newJob.company}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    company: e.target.value
                                })
                            }
                        />

                        <input
                            style={styles.input}
                            placeholder={language === "am" ? "አካባቢ" : "Location"}
                            value={newJob.location}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    location: e.target.value
                                })
                            }
                        />

                        <input
                            style={styles.input}
                            placeholder={language === "am" ? "ደመወዝ" : "Salary"}
                            value={newJob.salary}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    salary: e.target.value
                                })
                            }
                        />

                        <textarea
                            style={styles.textarea}
                            placeholder={language === "am" ? "የሥራው መግለጫ" : "Description"}
                            value={newJob.description}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    description: e.target.value
                                })
                            }
                        />

                        <select
                            style={styles.select}
                            value={newJob.type}
                            onChange={e =>
                                setNewJob({
                                    ...newJob,
                                    type: e.target.value
                                })
                            }
                        >
                            <option value="Full-time">{language === "am" ? "ሙሉ ጊዜ" : "Full-time"}</option>
                            <option value="Part-time">{language === "am" ? "ከፊል ጊዜ" : "Part-time"}</option>
                            <option value="Remote">{language === "am" ? "ከርቀት" : "Remote"}</option>
                            <option value="Contract">{language === "am" ? "በውል" : "Contract"}</option>
                        </select>

                        <button style={styles.btn} onClick={addJob}>
                            {language === "am" ? "➕ ሥራ ጨምር" : "➕ Add Job"}
                        </button>
                    </div>

                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>ID</th>
                                <th style={styles.th}>{language === "am" ? "የሥራ ርዕስ" : "Title"}</th>
                                <th style={styles.th}>{language === "am" ? "ድርጅት" : "Company"}</th>
                                <th style={styles.th}>{language === "am" ? "አካባቢ" : "Location"}</th>
                                <th style={styles.th}>{language === "am" ? "ድርጊቶች" : "Actions"}</th>
                            </tr>
                        </thead>

                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.id}>
                                    <td style={styles.td}>{job.id}</td>
                                    <td style={styles.td}>{job.title}</td>
                                    <td style={styles.td}>{job.company}</td>
                                    <td style={styles.td}>{job.location}</td>
                                    <td style={styles.td}>
                                        <button
                                            style={styles.deleteBtn}
                                            onClick={() => deleteJob(job.id)}
                                        >
                                            {language === "am" ? "ሰርዝ" : "Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* Applications Management */}
            {activeTab === 'applications' && (
                <div style={{ overflowX: 'auto' }}>
                    {applications.length === 0 ? (
                        <p>{language === "am" ? "ምንም የሥራ ማመልከቻ አልተገኘም።" : "No applications found."}</p>
                    ) : (
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>ID</th>
                                    <th style={styles.th}>{language === "am" ? "ሥራ" : "Job"}</th>
                                    <th style={styles.th}>{language === "am" ? "አመልካች" : "Applicant"}</th>
                                    <th style={styles.th}>{language === "am" ? "ኢሜይል" : "Email"}</th>
                                    <th style={styles.th}>{language === "am" ? "ሁኔታ" : "Status"}</th>
                                    <th style={styles.th}>{language === "am" ? "ድርጊቶች" : "Actions"}</th>
                                </tr>
                            </thead>

                            <tbody>
                                {applications.map(app => (
                                    <tr key={app.id}>
                                        <td style={styles.td}>{app.id}</td>
                                        <td style={styles.td}>
                                            {app.job_title || 'No Title'}
                                        </td>
                                        <td style={styles.td}>
                                            {app.name || app.applicant_name || 'Unknown'}
                                        </td>
                                        <td style={styles.td}>
                                            {app.email || app.applicant_email || 'N/A'}
                                        </td>
                                        <td style={styles.td}>
                                            <select
                                                style={styles.statusSelect}
                                                value={app.status || 'pending'}
                                                onChange={e =>
                                                    updateApplicationStatus(
                                                        app.id,
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                <option value="pending">{language === "am" ? "⏳ በመጠባበቅ ላይ" : "⏳ Pending"}</option>
                                                <option value="reviewed">{language === "am" ? "👀 ተገምግሟል" : "👀 Reviewed"}</option>
                                                <option value="accepted">{language === "am" ? "✅ ተቀባይነት አግኝቷል" : "✅ Accepted"}</option>
                                                <option value="rejected">{language === "am" ? "❌ ውድቅ ተደርጓል" : "❌ Rejected"}</option>
                                            </select>
                                        </td>
                                        <td style={styles.td}>
                                            <button
                                                style={styles.deleteBtn}
                                                onClick={() =>
                                                    deleteApplication(app.id)
                                                }
                                            >
                                                {language === "am" ? "ሰርዝ" : "Delete"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Users Management */}
            {activeTab === 'users' && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>ID</th>
                                <th style={styles.th}>{language === "am" ? "ስም" : "Name"}</th>
                                <th style={styles.th}>{language === "am" ? "ኢሜይል" : "Email"}</th>
                                <th style={styles.th}>{language === "am" ? "ሚና" : "Role"}</th>
                            </tr>
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
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;







