import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Chat from './Chat'; // ቻት ኮምፖነንት እንደገና ጥቅም ላይ ማዋል

const Messages = ({ user, setCurrentPage }) => {
    const [conversations, setConversations] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isMinimized, setIsMinimized] = useState(false); // ለሙሉ ገጹ ማሳነስ/ማስፋት
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // የጎን አሞሌ መደበቅ/መክፈት
    const socket = useRef();
    const scrollRef = useRef();
    const BASE_URL = 'http://localhost:5000';
    const API_URL = `${BASE_URL}/api/messages`;

    // Socket.io ግንኙነት መጀመር
 useEffect(() => {
    socket.current = io('http://localhost:5000');
    
    // ... የተቀረው ሶኬት ኮድ

    socket.current.on('new-message', (data) => {
        // እዚህ ጋር selectedUser ወቅታዊ መሆኑን ያረጋግጣል
        if (selectedUser?.other_user_id === data.senderId) {
            setMessages((prev) => [...prev, {
                id: data.id,
                sender_id: data.senderId,
                message: data.message,
                created_at: data.createdAt
            }]);
        }
        fetchConversations();
    });

    return () => {
        socket.current.off('new-message'); // ይሄ አስፈላጊ ነው! 
        socket.current.disconnect();
    };
}, [user, selectedUser]); // <--- selectedUser እዚህ መግባት አለበት
    // የሰዎችን ዝርዝር ማምጣት
    const fetchConversations = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/conversations/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (err) {
            console.error('❌ Error fetching conversations:', err);
        }
    };

    useEffect(() => {
        if (user?.id) fetchConversations();
    }, [user]);

    // የተመረጠውን ሰው መልእክቶች ማምጣት
    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedUser || !user?.id) return;
            try {
                const res = await fetch(`${API_URL}/${user.id}/${selectedUser.other_user_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data);
                    fetchConversations();
                }
            } catch (err) {
                console.error('❌ Error fetching messages:', err);
            }
        };
        fetchMessages();
    }, [selectedUser, user]);

    // መልእክት መላክ
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        const messageData = {
            senderId: user.id,
            receiverId: selectedUser.other_user_id,
            message: newMessage
        };

        socket.current.emit('send-message', messageData);

        setMessages([...messages, {
            sender_id: user.id,
            message: newMessage,
            created_at: new Date()
        }]);

        setNewMessage('');
    };

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ቻት ኮምፖነንት ለመክፈት
    const openChat = (conv) => {
        setSelectedUser(conv);
    };

    // ቻት ኮምፖነንት ለመዝጋት
    const closeChat = () => {
        setSelectedUser(null);
    };

    // ሙሉ ገጹን ማሳነስ/ማስፋት
    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    // የጎን አሞሌ መደበቅ/መክፈት
    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const styles = {
        container: {
            padding: isMinimized ? '0' : '20px',
            height: isMinimized ? 'auto' : 'calc(100vh - 20px)',
            transition: 'all 0.3s ease'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMinimized ? '0' : '15px',
            padding: isMinimized ? '10px 15px' : '0',
            background: isMinimized ? '#0a2a0a' : 'transparent',
            borderRadius: isMinimized ? '10px' : '0',
            cursor: isMinimized ? 'pointer' : 'default'
        },
        title: {
            color: '#2ecc71',
            margin: 0,
            fontSize: isMinimized ? '1rem' : '1.8rem'
        },
        minimizeBtn: {
            padding: '5px 12px',
            background: '#2ecc71',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: isMinimized ? '0.8rem' : '1rem'
        },
        chatContainer: {
            display: isMinimized ? 'none' : 'flex',
            height: '80vh',
            background: '#0a1a0a',
            color: '#fff',
            borderRadius: '15px',
            overflow: 'hidden',
            border: '1px solid #2ecc71'
        },
        sidebar: {
            width: isSidebarCollapsed ? '60px' : '30%',
            minWidth: isSidebarCollapsed ? '60px' : '250px',
            borderRight: '1px solid #2ecc71',
            overflowY: 'auto',
            background: 'rgba(20,40,20,0.8)',
            transition: 'width 0.3s ease'
        },
        sidebarHeader: {
            padding: isSidebarCollapsed ? '15px 10px' : '15px',
            borderBottom: '1px solid #2ecc71',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
        },
        sidebarTitle: {
            display: isSidebarCollapsed ? 'none' : 'block',
            fontWeight: 'bold',
            color: '#2ecc71'
        },
        toggleBtn: {
            background: 'transparent',
            border: 'none',
            color: '#2ecc71',
            cursor: 'pointer',
            fontSize: '1.2rem'
        },
        userItem: (isSelected) => ({
            padding: isSidebarCollapsed ? '15px 10px' : '15px',
            cursor: 'pointer',
            borderBottom: '1px solid #1a331a',
            background: isSelected ? '#2ecc7133' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: isSidebarCollapsed ? 'center' : 'left',
            flexDirection: isSidebarCollapsed ? 'column' : 'row',
            gap: isSidebarCollapsed ? '5px' : '0'
        }),
        userName: {
            fontWeight: 'bold',
            fontSize: isSidebarCollapsed ? '0.7rem' : '1rem',
            wordBreak: 'break-word'
        },
        lastMessage: {
            fontSize: '0.7rem',
            color: '#aaa',
            display: isSidebarCollapsed ? 'none' : 'block',
            marginTop: '3px'
        },
        unreadBadge: {
            background: '#e74c3c',
            color: '#fff',
            padding: isSidebarCollapsed ? '2px 4px' : '2px 8px',
            borderRadius: '50%',
            fontSize: isSidebarCollapsed ? '0.6rem' : '0.7rem',
            minWidth: '18px',
            textAlign: 'center'
        },
        chatWindow: {
            width: isSidebarCollapsed ? 'calc(100% - 60px)' : '70%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(10,20,10,0.9)',
            transition: 'width 0.3s ease'
        },
        chatHeader: {
            padding: '15px',
            borderBottom: '1px solid #2ecc71',
            fontWeight: 'bold',
            background: 'rgba(0,0,0,0.3)'
        },
        messageBox: {
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        },
        bubble: (isMine) => ({
            alignSelf: isMine ? 'flex-end' : 'flex-start',
            background: isMine ? '#2ecc71' : '#333',
            color: '#fff',
            padding: '10px 15px',
            borderRadius: '18px',
            maxWidth: '70%',
            wordWrap: 'break-word'
        }),
        time: {
            fontSize: '0.6rem',
            marginTop: '5px',
            opacity: 0.7,
            textAlign: 'right'
        },
        inputArea: {
            padding: '20px',
            display: 'flex',
            gap: '10px',
            borderTop: '1px solid #2ecc71'
        },
        input: {
            flex: 1,
            padding: '10px',
            borderRadius: '25px',
            border: '1px solid #2ecc71',
            background: '#000',
            color: '#fff',
            outline: 'none'
        },
        sendBtn: {
            padding: '10px 20px',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '25px',
            color: '#000',
            cursor: 'pointer',
            fontWeight: 'bold'
        },
        closeBtn: {
            padding: '8px 15px',
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
        },
        minimizedPreview: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 15px',
            background: '#0a2a0a',
            borderRadius: '10px',
            color: '#fff'
        },
        minimizedStats: {
            fontSize: '0.8rem',
            color: '#aaa'
        },
        emptyState: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            flexDirection: 'column',
            gap: '10px'
        }
    };

    // ለማሳነስ ሁኔታ - ቀለል ያለ እይታ
    if (isMinimized) {
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        
        return (
            <div style={styles.container}>
                <div style={styles.header} onClick={toggleMinimize}>
                    <h3 style={styles.title}>💬 Messages</h3>
                    <button style={styles.minimizeBtn}>Maximize</button>
                </div>
                <div style={styles.minimizedPreview}>
                    <span>📨 {conversations.length} conversations</span>
                    {totalUnread > 0 && (
                        <span style={styles.minimizedStats}>{totalUnread} unread messages</span>
                    )}
                </div>
            </div>
        );
    }

    if (!user) {
        return <div style={{color: '#2ecc71', textAlign: 'center', padding: '5rem'}}>Please login to see messages.</div>;
    }

    return (
        <div style={styles.container}>
            {/* Header with Close Button */}
            <div style={styles.header}>
                <h2 style={styles.title}>💬 Messages</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={styles.minimizeBtn} onClick={toggleMinimize}>
                        Minimize
                    </button>
                    <button 
                        style={styles.closeBtn} 
                        onClick={() => setCurrentPage('jobs')}
                    >
                        ✕ Close
                    </button>
                </div>
            </div>

            <div style={styles.chatContainer}>
                {/* Sidebar - የጎን አሞሌ */}
                <div style={styles.sidebar}>
                    <div style={styles.sidebarHeader} onClick={toggleSidebar}>
                        <span style={styles.sidebarTitle}>📋 Conversations</span>
                        <button style={styles.toggleBtn}>
                            {isSidebarCollapsed ? '▶' : '◀'}
                        </button>
                    </div>
                    
                    {conversations.length === 0 ? (
                        <div style={{ padding: '15px', textAlign: 'center', color: '#aaa' }}>
                            No conversations yet.<br />
                            Start messaging someone!
                        </div>
                    ) : (
                        conversations.map((conv) => (
                            <div 
                                key={conv.other_user_id} 
                                style={styles.userItem(selectedUser?.other_user_id === conv.other_user_id)}
                                onClick={() => openChat(conv)}
                            >
                                <div style={{ textAlign: isSidebarCollapsed ? 'center' : 'left' }}>
                                    <div style={styles.userName}>
                                        {isSidebarCollapsed ? conv.other_user_name?.charAt(0) : conv.other_user_name}
                                    </div>
                                    {!isSidebarCollapsed && (
                                        <div style={styles.lastMessage}>
                                            {conv.last_message?.substring(0, 25)}...
                                        </div>
                                    )}
                                </div>
                                {conv.unread_count > 0 && (
                                    <span style={styles.unreadBadge}>
                                        {isSidebarCollapsed ? conv.unread_count : conv.unread_count}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Chat Window - የምልክት መስኮት */}
                <div style={styles.chatWindow}>
                    {selectedUser ? (
                        <>
                            <div style={styles.chatHeader}>
                                💬 {selectedUser.other_user_name} ({selectedUser.other_user_role})
                            </div>
                            <div style={styles.messageBox}>
                                {messages.length === 0 ? (
                                    <div style={styles.emptyState}>
                                        <span>💬</span>
                                        <span>No messages yet. Start the conversation!</span>
                                    </div>
                                ) : (
                                    messages.map((m, i) => (
                                        <div key={i} style={styles.bubble(m.sender_id === user.id)}>
                                            {m.message}
                                            <div style={styles.time}>
                                                {new Date(m.created_at).toLocaleTimeString([], { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={scrollRef} />
                            </div>
                            <form style={styles.inputArea} onSubmit={handleSendMessage}>
                                <input 
                                    style={styles.input}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                />
                                <button type="submit" style={styles.sendBtn}>Send</button>
                            </form>
                        </>
                    ) : (
                        <div style={styles.emptyState}>
                            <span>👈</span>
                            <span>Select a person from the left to start messaging...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;