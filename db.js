// db.js
// MySQL 연결 전용 파일

const mysql = require("mysql2/promise");

// 본인 환경에 맞게 설정 바꾸기
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "rootroot",
  database: "board_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
