import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import ChangePassword from './ChangePassword';
import Chat from './Chat';
import io from 'socket.io-client';


const Navbar = ({ user, setUser, setCurrentPage, onLogout, currentPage }) => {
    const { language, setLanguage, t } = useLanguage();
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [selectedChatUser, setSelectedChatUser] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const socketRef = useRef();

   const fetchUnreadCount = async () => {
    if (!user) return;
    try {
        const res = await fetch(`http://localhost:5000/api/messages/unread/${user.id}`);
        
        // ሰርቨሩ ዳታውን በትክክል ከላከ ብቻ parse እናድርገው
        if (res.ok) {
            const data = await res.json();
            setUnreadCount(data.count || 0);
        } else {
            console.warn(`API Error: ${res.status}`);
        }
    } catch (err) {
        console.error('Network Error:', err);
    }
};

    const fetchAvailableUsers = async () => {
        if (!user) return;
        try {
            const res = await fetch(`http://localhost:5000/api/users`);
            if (!res.ok) return;
            const data = await res.json();
            setAvailableUsers(data.filter(u => u.id !== user.id));
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

useEffect(() => {
    let socket;

    if (user && user.id) {
        fetchUnreadCount();
        fetchAvailableUsers();

        // ግንኙነቱን መፍጠር
        socket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to socket');
            socket.emit('user-connected', user.id);
        });

        socket.on('unread-update', (data) => {
            if (String(data.userId) === String(user.id)) {
                setUnreadCount(data.count);
            }
        });

        socket.on('new-message', () => {
            fetchUnreadCount();
        });
    }

    // Cleanup function
    return () => {
        if (socket) {
            // ግንኙነቱ ክፍት ከሆነ ብቻ እንዲዘጋ በማድረግ ስህተቱን መከላከል
            if (socket.connected) {
                socket.disconnect();
            } else {
                // ገና በመገናኘት ላይ ከሆነ ለጥቂት ጊዜ ቆይቶ እንዲዘጋ ማድረግ
                socket.once('connect', () => socket.disconnect());
            }
            socketRef.current = null;
        }
    };
}, [user?.id]); // ተጠቃሚው ሲቀየር ብቻ እንዲሰራ

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('user');
        setCurrentPage('login');
        if (onLogout) onLogout();
    };

    const openChatWith = (otherUser) => {
        setSelectedChatUser(otherUser);
        setShowChat(true);
        setShowUserMenu(false);
        setIsMobileMenuOpen(false);
    };

    const filteredUsers = availableUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const styles = {
        nav: {
            background: '#062606',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            width: '100%',
            boxSizing: 'border-box'
        },
        topRow: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.7rem 2%',
            borderBottom: '1px solid rgba(46, 204, 113, 0.2)',
            width: '100%',
            boxSizing: 'border-box'
        },
        bottomRow: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '0.8rem 2%',
            background: '#083008',
            flexWrap: 'wrap',
            width: '100%',
            boxSizing: 'border-box'
        },
        logo: { 
            fontSize: '1.6rem', 
            fontWeight: 'bold', 
            color: '#2ecc71', 
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center'
        },
        link: (active) => ({ 
            color: active ? '#2ecc71' : '#ecf0f1', 
            cursor: 'pointer', 
            textDecoration: 'none', 
            fontSize: '0.9rem',
            fontWeight: active ? 'bold' : '500',
            position: 'relative',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap'
        }),
        aiBtn: (active) => ({
            padding: '0.5rem 1rem',
            background: active ? '#2ecc71' : 'rgba(46, 204, 113, 0.1)',
            border: '1px solid #2ecc71',
            borderRadius: '25px',
            color: active ? '#fff' : '#2ecc71',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            transition: 'all 0.3s',
            whiteSpace: 'nowrap'
        }),
        userSection: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        },
        btn: { 
            padding: '0.5rem 1.2rem', 
            background: '#2ecc71', 
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap'
        },
        btnOutline: { 
            padding: '0.5rem 1rem', 
            background: 'transparent', 
            border: '1px solid #2ecc71', 
            borderRadius: '8px', 
            color: '#2ecc71', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap'
        },
        badge: {
            position: 'absolute',
            top: '-10px',
            right: '-15px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.7rem',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #083008'
        },
        hamburger: { 
            display: 'none', 
            fontSize: '1.8rem', 
            cursor: 'pointer', 
            color: '#fff' 
        },
        mobileMenu: {
            display: isMobileMenuOpen ? 'flex' : 'none',
            flexDirection: 'column',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#062606',
            padding: '2rem',
            gap: '1.5rem',
            zIndex: 999,
            borderTop: '1px solid #2ecc71'
        }
    };

    const MenuItems = ({ isMobile = false }) => (
        <>
            <span style={styles.link(currentPage === 'jobs')} onClick={() => { setCurrentPage('jobs'); if(isMobile) setIsMobileMenuOpen(false); }}>
                {t.jobs}
            </span>
            
            {user && (
                <span style={styles.link(currentPage === 'notifications')} onClick={() => { setCurrentPage('notifications'); if(isMobile) setIsMobileMenuOpen(false); }}>
                    🔔 {t.notifications || 'Notifications'}
                </span>
            )}

            {user && (user.role === 'user' || user.role === 'admin') && (
                <span style={styles.link(currentPage === 'alerts')} onClick={() => { setCurrentPage('alerts'); if(isMobile) setIsMobileMenuOpen(false); }}>
                    📢 {t.jobAlerts || 'Job Alerts'}
                </span>
            )}

            {user && (user.role === 'employer' || user.role === 'admin') && (
                <span style={styles.link(currentPage === 'interviews')} onClick={() => { setCurrentPage('interviews'); if(isMobile) setIsMobileMenuOpen(false); }}>
                    📅 {t.interviews || 'Interviews'}
                </span>
            )}

            {user && (user.role === 'employer' || user.role === 'admin') && (
                <span style={styles.link(currentPage === 'employer-apps')} onClick={() => { setCurrentPage('employer-apps'); if(isMobile) setIsMobileMenuOpen(false); }}>
                    📥 {t.applications || 'Applications'}
                </span>
            )}

            {user && (
                <span style={styles.link(currentPage === 'saved')} onClick={() => { setCurrentPage('saved'); if(isMobile) setIsMobileMenuOpen(false); }}>
                    📚 {t.savedJobs || 'Saved'}
                </span>
            )}
            
            {user && user.role === 'admin' && (
                <>
                    <span style={styles.link(currentPage === 'admin')} onClick={() => { setCurrentPage('admin'); if(isMobile) setIsMobileMenuOpen(false); }}>
                        ⚙️ {t.admin}
                    </span>
                    <span style={styles.link(currentPage === 'analytics')} onClick={() => { setCurrentPage('analytics'); if(isMobile) setIsMobileMenuOpen(false); }}>
                        📈 {t.analytics}
                    </span>
                </>
            )}

            {user && (
                <span style={styles.link(currentPage === 'messages')} 
                    onClick={() => {
                        if (isMobile) { setCurrentPage('messages'); setIsMobileMenuOpen(false); }
                        else { setShowUserMenu(!showUserMenu); }
                    }}
                >
                    💬 {t.messages || 'Messages'}
                    {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
                </span>
            )}

            {user && (
                <button 
                    style={styles.aiBtn(currentPage === 'recommendations')} 
                    onClick={() => { setCurrentPage('recommendations'); if(isMobile) setIsMobileMenuOpen(false); }}
                >
                    ✨ {t.aiRecommendations || 'AI Recommendations'}
                </button>
            )}
        </>
    );

    return (
        <>
            <nav style={styles.nav}>
                <div style={styles.topRow}>
                    <div style={styles.logo} onClick={() => setCurrentPage('jobs')}>
                        JobPortal
                    </div>
                    
                    <div style={styles.userSection}>
                        <button style={styles.btnOutline} onClick={() => setLanguage(l => l === 'en' ? 'am' : 'en')}>
                            {language === 'en' ? 'አማርኛ' : 'English'}
                        </button>
                        
                        {user ? (
                            <>
                                <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500' }}>👋 {user.name}</span>
                                <button style={styles.btnOutline} onClick={() => setShowChangePassword(true)}>
                                    🔐 {t.changePassword || 'Change Password'}
                                </button>
                                <button style={styles.btn} onClick={handleLogout}>{t.logout}</button>
                            </>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button style={styles.btn} onClick={() => setCurrentPage('login')}>{t.login}</button>
                                <button style={styles.btnOutline} onClick={() => setCurrentPage('register')}>{t.register}</button>
                            </div>
                        )}

                        <div className="mobile-toggle" style={styles.hamburger} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <style>{`
                                @media (max-width: 1100px) { 
                                    .desktop-only { display: none !important; } 
                                    .mobile-toggle { display: block !important; } 
                                }
                                .mobile-toggle { display: none; }
                            `}</style>
                            ☰
                        </div>
                    </div>
                </div>

                <div className="desktop-only" style={styles.bottomRow}>
                    <MenuItems />
                </div>

                <div style={styles.mobileMenu}>
                    <MenuItems isMobile={true} />
                </div>
            </nav>

            {showUserMenu && (
                <div style={{
                    position: 'absolute', top: '120px', right: '5%', background: '#1a3d1a', 
                    borderRadius: '12px', padding: '1.5rem', minWidth: '300px', zIndex: 2000, 
                    boxShadow: '0 15px 35px rgba(0,0,0,0.7)', border: '1px solid #2ecc71'
                }}>
                    <button 
                        onClick={() => { setCurrentPage('messages'); setShowUserMenu(false); }}
                        style={{ width: '100%', background: '#2ecc71', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '15px', fontWeight: 'bold' }}
                    >
                        📂 View All {t.messages || 'Messages'}
                    </button>
                    <div style={{ color: '#2ecc71', fontSize: '0.8rem', marginBottom: '10px', textTransform: 'uppercase' }}>Quick Chat</div>
                    <input 
                        type="text" placeholder="Search users..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: 'none', background: '#0a2a0a', color: '#fff' }}
                    />
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {filteredUsers.map(usr => (
                            <div key={usr.id} onClick={() => openChatWith(usr)} style={{ padding: '12px', cursor: 'pointer', color: '#fff', borderBottom: '1px solid #2a4a2a', transition: 'background 0.2s' }}>
                                <strong>{usr.name}</strong><br/>
                                <small style={{ color: '#888' }}>{usr.email}</small>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', marginTop: '15px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
                </div>
            )}

            {showChangePassword && <ChangePassword user={user} onClose={() => setShowChangePassword(false)} />}
            {showChat && selectedChatUser && (
                <Chat user={user} otherUser={selectedChatUser} onClose={() => { setShowChat(false); fetchUnreadCount(); }} />
            )}
        </>
    );
};

export default Navbar;