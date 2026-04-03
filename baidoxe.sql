CREATE DATABASE IF NOT EXISTS quan_ly_bai_xe;
USE quan_ly_bai_xe;

CREATE TABLE lich_su_xu_ly (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_giao_dich VARCHAR(100) NOT NULL,
    hanh_dong VARCHAR(10) NOT NULL,
    vi_tri VARCHAR(10) NOT NULL,
    thoi_gian TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);