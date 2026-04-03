const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const admin = require('firebase-admin');

// 1. KHỞI TẠO FIREBASE ADMIN
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://baidoxe-d4e47-default-rtdb.asia-southeast1.firebasedatabase.app" 
});
const dbFirebase = admin.database();

// 2. KHỞI TẠO KẾT NỐI MYSQL (XAMPP)
const dbMySQL = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '123456',  // Đã cập nhật mật khẩu của bạn vào đây
    database: 'quan_ly_bai_xe'
});

const app = express();
app.use(cors());
app.use(express.json());

// ========================================================
// API: LẤY LỊCH SỬ CÓ BỘ LỌC (TÌM KIẾM) TỪ MYSQL
// ========================================================
app.get('/api/lichsu', async (req, res) => {
    try {
        const { hanh_dong, vi_tri, tu_ngay, den_ngay } = req.query;
        
        let sql = 'SELECT * FROM lich_su_xu_ly WHERE 1=1';
        let queryParams = [];

        if (hanh_dong && hanh_dong !== 'ALL') {
            sql += ' AND hanh_dong = ?';
            queryParams.push(hanh_dong);
        }
        if (vi_tri && vi_tri !== 'ALL') {
            sql += ' AND vi_tri = ?';
            queryParams.push(vi_tri);
        }
        if (tu_ngay) {
            sql += ' AND thoi_gian >= ?';
            queryParams.push(tu_ngay);
        }
        if (den_ngay) {
            sql += ' AND thoi_gian <= ?';
            queryParams.push(den_ngay);
        }

        sql += ' ORDER BY id DESC'; // Mới nhất lên đầu

        const [rows] = await dbMySQL.execute(sql, queryParams);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi lấy lịch sử:", error);
        res.status(500).json({ message: error.message });
    }
});

// ========================================================
// HỆ THỐNG WORKER CHẠY NGẦM: TỰ ĐỘNG LẮNG NGHE HÀNG ĐỢI
// ========================================================
const hangDoiRef = dbFirebase.ref('hang_doi');

hangDoiRef.on('child_added', async (snapshot) => {
    const firstKey = snapshot.key;
    const msg = snapshot.val();

    console.log(`\n⚡ [AUTO] Phát hiện yêu cầu xe ${msg.hanh_dong} đang vào hàng đợi...`);

    try {
        const baiRef = dbFirebase.ref('thong_tin_bai/danh_sach_cho');
        const snapBai = await baiRef.once('value');
        let trangThaiBai = snapBai.val() || { "1": true, "2": true, "3": true, "4": true, "5": true };

        let luuVetViTri = "";
        let xuLyThanhCong = false;

        // Logic xử lý VÀO / RA
        if (msg.hanh_dong === 'VAO') {
            const vitriList = ["1", "2", "3", "4", "5"];
            let choTrong = vitriList.find(v => trangThaiBai[v] === true);
            if (choTrong) {
                await baiRef.child(choTrong).set(false); 
                luuVetViTri = choTrong;
                xuLyThanhCong = true;
            } else {
                console.log(`❌ [AUTO] Bãi đã đầy, từ chối xe VÀO!`);
                await dbFirebase.ref('thong_bao_log').set(`[${new Date().toLocaleTimeString('vi-VN')}] ❌ Bãi đã đầy kín, từ chối xe VÀO!`);
            }
        } else if (msg.hanh_dong === 'RA') {
            if (trangThaiBai[msg.vi_tri] === false) {
                await baiRef.child(msg.vi_tri).set(true); 
                luuVetViTri = msg.vi_tri;
                xuLyThanhCong = true;
            } else {
                console.log(`❌ [AUTO] Lỗi: Ô số ${msg.vi_tri} vốn đang trống!`);
                await dbFirebase.ref('thong_bao_log').set(`[${new Date().toLocaleTimeString('vi-VN')}] ❌ Lỗi: Ô số [${msg.vi_tri}] vốn đang TRỐNG, không thể RA!`);
            }
        }

        // Lưu vào MySQL và Phát loa thông báo thành công lên Giao diện HTML
        if (xuLyThanhCong) {
            const sql = 'INSERT INTO lich_su_xu_ly (ma_giao_dich, hanh_dong, vi_tri) VALUES (?, ?, ?)';
            await dbMySQL.execute(sql, [firstKey, msg.hanh_dong, luuVetViTri]);
            console.log(`✅ [AUTO] Đã xử lý & Lưu MySQL: Xe ${msg.hanh_dong} tại ô [${luuVetViTri}]`);
            
            await dbFirebase.ref('thong_bao_log').set(`[${new Date().toLocaleTimeString('vi-VN')}] ✅ Xử lý thành công: Xe ${msg.hanh_dong} tại ô số [${luuVetViTri}]`);
        }

        // Dọn dẹp hàng đợi
        await hangDoiRef.child(firstKey).remove();

    } catch (error) {
        console.error("Lỗi Worker:", error);
    }
});

app.listen(3000, () => {
    console.log('==================================================');
    console.log('🚀 BACKEND NODE.JS ĐÃ CHẠY TẠI: http://localhost:3000');
    console.log('✅ Hệ thống đang lắng nghe Firebase & Kết nối MySQL');
    console.log('==================================================');
});