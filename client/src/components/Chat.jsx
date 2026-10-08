import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// ✅ እንዲህ ብታደርገው ይሻላል
const socket = io('http://localhost:5000', {
    transports: ['websocket', 'polling'], // የግንኙነት ስህተትን ለመከላከል
    withCredentials: true
});

const Chat = ({ user, otherUser, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [online, setOnline] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false); // ✅ የተጨመረው ሁኔታ
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    //let typingTimeout;

    useEffect(() => {
        if (user?.id) {
            fetchMessages();
            socket.emit('user-connected', user.id);
        }

        socket.on('new-message', (message) => {
            if (message.senderId === otherUser?.id) {
                setMessages(prev => [...prev, { ...message, is_read: false }]);
                // ቻቱ ከተቀነሰ እና አዲስ መልእክት ሲመጣ ማስታወቂያ ማሳየት
                if (isMinimized) {
                    // አማራጭ: ማስታወቂያ ማሳየት
                    console.log(`New message from ${otherUser?.name}`);
                }
            }
        });

        socket.on('user-typing', ({ userId }) => {
            if (userId === otherUser?.id) {
                setIsTyping(true);
                setTimeout(() => setIsTyping(false), 1000);
            }
        });

        socket.on('online-users', (users) => {
            setOnline(users.includes(otherUser?.id));
        });

        return () => {
            socket.off('new-message');
            socket.off('user-typing');
            socket.off('online-users');
        };
    }, [otherUser?.id, user?.id, isMinimized]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/messages/${user.id}/${otherUser.id}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = () => {
        if (!newMessage.trim()) return;

        socket.emit('send-message', {
            senderId: user.id,
            receiverId: otherUser.id,
            message: newMessage
        });

        setMessages(prev => [...prev, {
            id: Date.now(),
            sender_id: user.id,
            message: newMessage,
            created_at: new Date(),
            is_read: true
        }]);

        setNewMessage('');
    };

    const handleTyping = () => {
    // 1. ለሰርቨሩ መረጃውን ይልካል
    socket.emit('typing', { senderId: user.id, receiverId: otherUser.id });
    
    // 2. ቀድሞ የነበረውን ታይመር ያጠፋል
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // 3. ከ1.5 ሰከንድ በኋላ ታይፒንግ እንዲቆም ያደርጋል
    typingTimeoutRef.current = setTimeout(() => {
        // አስፈላጊ ከሆነ እዚህ ጋር 'stop-typing' emit ማድረግ ትችላለህ
    }, 1500);
};

    const getMessageStyle = (msg) => {
        if (msg.sender_id === user.id) {
            return styles.myMessage;
        } else {
            return msg.is_read ? styles.otherMessageRead : styles.otherMessageUnread;
        }
    };

    // ✅ የማስፋት/ማሳነስ ተግባር
    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    const styles = {
        overlay: {
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: isMinimized ? '380px' : '90%',
            maxWidth: isMinimized ? '380px' : '500px',
            height: isMinimized ? '60px' : '550px',
            maxHeight: isMinimized ? '60px' : '80vh',
            background: '#1a3d1a',
            borderRadius: '15px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 5px 25px rgba(0,0,0,0.3)',
            zIndex: 1000,
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            cursor: isMinimized ? 'pointer' : 'default'
        },
        header: {
            padding: '1rem',
            background: '#2ecc71',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
        },
        headerInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        },
        onlineDot: {
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: online ? '#2ecc71' : '#888'
        },
        headerButtons: {
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center'
        },
        minimizeBtn: {
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '5px',
            color: '#fff',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        closeBtn: {
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '5px',
            color: '#fff',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        messagesArea: {
            flex: 1,
            padding: isMinimized ? 0 : '1rem',
            overflowY: 'auto',
            display: isMinimized ? 'none' : 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
        },
        myMessage: {
            alignSelf: 'flex-end',
            background: '#2ecc71',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            wordWrap: 'break-word',
            color: '#000'
        },
        otherMessageUnread: {
            alignSelf: 'flex-start',
            background: '#0a2a0a',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            wordWrap: 'break-word',
            border: '2px solid #2ecc71',
            color: '#fff'
        },
        otherMessageRead: {
            alignSelf: 'flex-start',
            background: '#1a3d1a',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            wordWrap: 'break-word',
            opacity: 0.7,
            color: '#fff'
        },
        time: {
            fontSize: '0.65rem',
            opacity: 0.7,
            marginTop: '0.2rem',
            textAlign: 'right'
        },
        typing: {
            fontSize: '0.8rem',
            color: '#aaa',
            padding: '0.5rem 1rem',
            display: isMinimized ? 'none' : 'block'
        },
        inputArea: {
            padding: isMinimized ? 0 : '1rem',
            borderTop: '1px solid rgba(46,204,113,0.3)',
            display: isMinimized ? 'none' : 'flex',
            gap: '0.5rem'
        },
        input: {
            flex: 1,
            padding: '0.5rem',
            borderRadius: '20px',
            border: 'none',
            background: '#0a2a0a',
            color: '#fff',
            outline: 'none'
        },
        sendBtn: {
            padding: '0.5rem 1rem',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '20px',
            color: '#000',
            cursor: 'pointer',
            fontWeight: 'bold'
        },
        minimizedPreview: {
            display: isMinimized ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            height: '60px',
            color: '#fff'
        },
        unreadBadge: {
            background: '#e74c3c',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.7rem',
            marginLeft: '8px'
        },
        loading: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#aaa'
        }
    };

    // ለማሳነስ ሁኔታ የተለየ ይዘት
    if (isMinimized) {
        const unreadMessages = messages.filter(m => m.sender_id !== user.id && !m.is_read).length;
        
        return (
            <div style={styles.overlay} onClick={toggleMinimize}>
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <div style={styles.onlineDot}></div>
                        <span>💬 {otherUser?.name}</span>
                        {unreadMessages > 0 && (
                            <span style={styles.unreadBadge}>{unreadMessages}</span>
                        )}
                    </div>
                    <div style={styles.headerButtons}>
                        <button 
                            style={styles.minimizeBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleMinimize();
                            }}
                        >
                            □
                        </button>
                        <button 
                            style={styles.closeBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
                <div style={styles.minimizedPreview}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                        {messages.length > 0 
                            ? `📝 ${messages[messages.length - 1]?.message?.substring(0, 40)}...`
                            : 'No messages yet'}
                    </span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={styles.overlay}>
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <div style={styles.onlineDot}></div>
                        <span>{otherUser?.name || 'User'}</span>
                    </div>
                    <div style={styles.headerButtons}>
                        <button 
                            style={styles.minimizeBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleMinimize();
                            }}
                        >
                            _
                        </button>
                        <button 
                            style={styles.closeBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
                <div style={styles.loading}>Loading messages...</div>
            </div>
        );
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.header}>
                <div style={styles.headerInfo}>
                    <div style={styles.onlineDot}></div>
                    <span>💬 {otherUser?.name} {online ? '(Online)' : '(Offline)'}</span>
                </div>
                <div style={styles.headerButtons}>
                    <button 
                        style={styles.minimizeBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleMinimize();
                        }}
                    >
                        _
                    </button>
                    <button 
                        style={styles.closeBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div style={styles.messagesArea}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px' }}>
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} style={getMessageStyle(msg)}>
                            <div>{msg.message}</div>
                            <div style={styles.time}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {msg.sender_id === user.id && (
                                    <span style={{ marginLeft: '5px' }}>
                                        {msg.is_read ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isTyping && <div style={styles.typing}>✍️ Typing...</div>}
                <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputArea}>
                <input
                    style={styles.input}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    onKeyUp={handleTyping}
                    placeholder="Type a message..."
                />
                <button style={styles.sendBtn} onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};

export default Chat;