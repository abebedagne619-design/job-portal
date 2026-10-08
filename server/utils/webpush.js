const webpush = require('web-push');
require('dotenv').config(); // ይህ መስመር .env ፋይሉን እንዲያነብ ያደርገዋል

// ❌ ይሄኛው ክፍል ይጥፋ (ምክንያቱም ሚስጥሩ እዚህ መኖር የለበትም)
// const vapidKeys = { ... }; 

// ✅ በዚህ ይተካ
webpush.setVapidDetails(
    'mailto:abebedagne619@gmail.com',
    process.env.VAPID_PUBLIC_KEY,  // ከ .env ፋይል ያነባል
    process.env.VAPID_PRIVATE_KEY  // ከ .env ፋይል ያነባል
);

const sendNotification = (subscription, payload) => {
    webpush.sendNotification(subscription, JSON.stringify(payload))
        .then(() => console.log('✅ Notification sent successfully'))
        .catch(err => console.error('❌ Notification error:', err));
};

module.exports = { sendNotification };