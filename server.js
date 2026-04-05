const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const admin = require('firebase-admin');
const fs = require('fs'); 

// 1. KHỞI TẠO FIREBASE ADMIN (CƠ CHẾ HYBRID)
let serviceAccount;

if (fs.existsSync('./firebase-key.json')) {
    serviceAccount = require('./firebase-key.json');
} else {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (e) {
        console.error("❌ LỖI: Không tìm thấy file firebase-key.json hoặc biến FIREBASE_CONFIG!");
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://baidoxe-d4e47-default-rtdb.asia-southeast1.firebasedatabase.app" 
});
const dbFirebase = admin.database();

// 2. KẾT NỐI MYSQL CLOUD (AIVEN)
const dbMySQL = mysql.createPool({
    host: 'db-bai-do-xe-soobinpham27-f131.a.aivencloud.com',
    port: 17709,
    user: 'avnadmin',
    password: 'AVNS_eJf3ZWWwm0YUqPNz7ma',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const app = express();
app.use(cors());
app.use(express.json());

const TONG_SO_CHO = 50; 
const vitriList = Array.from({length: TONG_SO_CHO}, (_, i) => (i + 1).toString());

// --- API LẤY LỊCH SỬ ---
app.get('/api/lichsu', async (req, res) => {
    try {
        const { hanh_dong, vi_tri, tu_ngay, den_ngay } = req.query;
        let sql = 'SELECT * FROM lich_su_xu_ly WHERE 1=1';
        let queryParams = [];

        if (hanh_dong && hanh_dong !== 'ALL') { sql += ' AND hanh_dong = ?'; queryParams.push(hanh_dong); }
        if (vi_tri && vi_tri !== 'ALL') { sql += ' AND vi_tri = ?'; queryParams.push(vi_tri); }
        if (tu_ngay) { sql += ' AND thoi_gian >= ?'; queryParams.push(tu_ngay); }
        if (den_ngay) { sql += ' AND thoi_gian <= ?'; queryParams.push(den_ngay); }
        
        sql += ' ORDER BY id DESC'; 
        const [rows] = await dbMySQL.execute(sql, queryParams);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- WORKER XỬ LÝ HÀNG ĐỢI ---
const hangDoiRef = dbFirebase.ref('hang_doi');
let hangDoiLock = Promise.resolve();

hangDoiRef.on('child_added', (snapshot) => {
    hangDoiLock = hangDoiLock.then(async () => {
        const firstKey = snapshot.key;
        const msg = snapshot.val();
        const thoiGianGoc = new Date(msg.thoi_gian || Date.now()); 

        // TRƯỜNG HỢP ĐỒNG BỘ SQL (Nếu Firebase đã xử lý)
        if (msg.da_xu_ly_firebase) {
            try {
                const sql = 'INSERT INTO lich_su_xu_ly (ma_giao_dich, hanh_dong, vi_tri, thoi_gian) VALUES (?, ?, ?, ?)';
                await dbMySQL.execute(sql, [firstKey, msg.hanh_dong, msg.vi_tri_da_cap, thoiGianGoc]);
                
                // Gửi thông báo đồng bộ thành công lên Web
                const bayGio = new Date().toLocaleTimeString('vi-VN');
                await dbFirebase.ref('thong_bao_log').set(`[${bayGio}] 🔄 Đồng bộ Cloud: Xe ${msg.hanh_dong} tại ô số [${msg.vi_tri_da_cap}]`);
                
                await hangDoiRef.child(firstKey).remove(); 
            } catch (e) { console.error("Lỗi Sync:", e.message); }
            return;
        }

        // TRƯỜNG HỢP XỬ LÝ MỚI
        try {
            const baiRef = dbFirebase.ref('thong_tin_bai/danh_sach_cho');
            const snapBai = await baiRef.once('value');
            let trangThaiBai = snapBai.val() || {}; 
            let luuVetViTri = "";
            let xuLyThanhCong = false;

            if (msg.hanh_dong === 'VAO') {
                let choTrong = vitriList.find(v => trangThaiBai[v] !== false); 
                if (choTrong) {
                    await baiRef.child(choTrong).set(false);
                    luuVetViTri = choTrong;
                    xuLyThanhCong = true;
                }
            } else if (msg.hanh_dong === 'RA') {
                if (trangThaiBai[msg.vi_tri] === false) {
                    await baiRef.child(msg.vi_tri).set(true); 
                    luuVetViTri = msg.vi_tri;
                    xuLyThanhCong = true;
                }
            }

            if (xuLyThanhCong) {
                // Phase 1: Cập nhật Firebase
                await hangDoiRef.child(firstKey).update({ da_xu_ly_firebase: true, vi_tri_da_cap: luuVetViTri });
                
                // Phase 2: Ghi MySQL Cloud
                const sql = 'INSERT INTO lich_su_xu_ly (ma_giao_dich, hanh_dong, vi_tri, thoi_gian) VALUES (?, ?, ?, ?)';
                await dbMySQL.execute(sql, [firstKey, msg.hanh_dong, luuVetViTri, thoiGianGoc]);
                
                // 🌟 QUAN TRỌNG: Gửi thông báo để Web cập nhật UI
                const bayGio = new Date().toLocaleTimeString('vi-VN');
                await dbFirebase.ref('thong_bao_log').set(`[${bayGio}] ✅ Xử lý thành công: Xe ${msg.hanh_dong} tại ô số [${luuVetViTri}]`);
                
                await hangDoiRef.child(firstKey).remove();
                console.log(`✅ [OK] Xe ${msg.hanh_dong} tại ô ${luuVetViTri}`);
            }
        } catch (e) { console.error("Worker Error:", e.message); }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVER ĐANG CHẠY TẠI PORT: ${PORT}`);
});
