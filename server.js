// server.js
// - 정적 파일 서빙 (public/index.html, board.js, style.css)
// - 게시판 API (board_posts + boards + post_views 사용)

const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// -----------------------------
// DB 연결 풀
// -----------------------------
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "rootroot",
  database: "board_db", // schema.sql에서 만든 DB 이름
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// -----------------------------
// 기본 설정
// -----------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일: public 폴더
app.use(express.static(path.join(__dirname, "public")));

// 메인 페이지
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------
// API: 게시글 목록 조회
// GET /api/posts?board=free&page=1&pageSize=10&keyword=검색어
// -----------------------------
app.get("/api/posts", async (req, res) => {
  const board = req.query.board === "notice" ? "notice" : "free";

  // page / pageSize 숫자 변환 + 기본값
  let page = parseInt(req.query.page, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;

  let pageSize = parseInt(req.query.pageSize, 10);
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = 10;

  const keyword = (req.query.keyword || "").trim();
  const offset = (page - 1) * pageSize;

  let conn;
  try {
    conn = await pool.getConnection();

    // 1) 전체 건수
    let countSql = `
      SELECT COUNT(*) AS cnt
      FROM board_posts
      WHERE board_type = ?
    `;
    const countParams = [board];

    if (keyword !== "") {
      countSql += " AND title LIKE ?";
      countParams.push(`%${keyword}%`);
    }

    const [countRows] = await conn.execute(countSql, countParams);
    const totalCount = countRows[0].cnt;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // 2) 목록 조회
    let listSql = `
      SELECT p.*
      FROM board_posts p
      WHERE p.board_type = ?
    `;
    const listParams = [board];

    if (keyword !== "") {
      listSql += " AND p.title LIKE ?";
      listParams.push(`%${keyword}%`);
    }

    // 🔥 LIMIT / OFFSET은 문자열에 숫자로 직접 넣기 (더 이상 ? 안 씀)
    listSql += ` ORDER BY p.id DESC LIMIT ${offset}, ${pageSize}`;

    const [rows] = await conn.execute(listSql, listParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
      },
    });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  } finally {
    if (conn) conn.release();
  }
});


// -----------------------------
// API: 게시글 상세 조회
// GET /api/posts/:id
// - board_posts에서 글 정보 조회
// - view_count 1 증가
// - post_views에 조회 로그 추가
// -----------------------------
app.get("/api/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ success: false, message: "잘못된 id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) 조회수 증가
    await conn.execute(
      "UPDATE board_posts SET view_count = view_count + 1 WHERE id = ?",
      [id]
    );

    // 2) 조회 로그 기록 (post_views)
    await conn.execute(
      "INSERT INTO post_views (post_id, viewer_ip) VALUES (?, ?)",
      [id, req.ip || null]
    );

    // 3) 글 정보 가져오기 (boards와 조인해서 board name도 가져올 수 있음)
    const detailSql = `
      SELECT p.*, b.name AS board_name
      FROM board_posts p
      LEFT JOIN boards b ON p.board_type = b.code
      WHERE p.id = ?
    `;
    const [rows] = await conn.execute(detailSql, [id]);

    await conn.commit();

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "게시글 없음" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("GET /api/posts/:id error:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  } finally {
    if (conn) conn.release();
  }
});

// -----------------------------
// API: 게시글 작성
// POST /api/posts
// body: { board_type, title, author, content }
// -----------------------------
app.post("/api/posts", async (req, res) => {
  const { board_type, title, author, content } = req.body;

  const bt = board_type === "notice" ? "notice" : "free";
  if (!title || !author || !content) {
    return res
      .status(400)
      .json({ success: false, message: "필수 항목이 누락되었습니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // board_type은 FK라서 boards 테이블에 free/notice가 들어있어야 함
    const sql = `
      INSERT INTO board_posts (board_type, title, content, author)
      VALUES (?, ?, ?, ?)
    `;
    const params = [bt, title, content, author];

    const [result] = await conn.execute(sql, params);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("POST /api/posts error:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  } finally {
    if (conn) conn.release();
  }
});

// -----------------------------
// API: 게시글 수정
// PUT /api/posts/:id
// body: { title, author, content }
// board_type은 여기서는 안 바꾸는 걸로 가정
// -----------------------------
app.put("/api/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ success: false, message: "잘못된 id" });
  }

  const { title, author, content } = req.body;
  if (!title || !author || !content) {
    return res
      .status(400)
      .json({ success: false, message: "필수 항목이 누락되었습니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const sql = `
      UPDATE board_posts
      SET title = ?, author = ?, content = ?
      WHERE id = ?
    `;
    const params = [title, author, content, id];

    const [result] = await conn.execute(sql, params);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "수정할 게시글이 없습니다." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/posts/:id error:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  } finally {
    if (conn) conn.release();
  }
});

// -----------------------------
// API: 게시글 삭제
// DELETE /api/posts/:id
// - post_views 로그도 같이 삭제 (FK ON DELETE CASCADE로 설정했으면 생략 가능)
// -----------------------------
app.delete("/api/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ success: false, message: "잘못된 id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 조회 로그 먼저 삭제 (FK에서 ON DELETE CASCADE 안 걸어놨다는 가정)
    await conn.execute("DELETE FROM post_views WHERE post_id = ?", [id]);

    // 글 삭제
    const [result] = await conn.execute(
      "DELETE FROM board_posts WHERE id = ?",
      [id]
    );

    await conn.commit();

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "삭제할 게시글이 없습니다." });
    }

    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("DELETE /api/posts/:id error:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  } finally {
    if (conn) conn.release();
  }
});

// -----------------------------
// 서버 시작
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

