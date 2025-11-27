-- schema.sql

CREATE DATABASE IF NOT EXISTS board_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE board_db;

-- 1) 게시판 종류 테이블
CREATE TABLE boards (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 기본 데이터 (자유 / 공지)
INSERT INTO boards (code, name, description) VALUES
('free', '자유 게시판', '자유롭게 글을 작성하는 게시판'),
('notice', '공지 사항', '공지용 게시판');

-- 2) 게시글 테이블
CREATE TABLE board_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_type VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(50) NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_board_posts_board_type
    FOREIGN KEY (board_type) REFERENCES boards(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 조회 로그 테이블
CREATE TABLE post_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewer_ip VARCHAR(45) NULL,
  CONSTRAINT fk_post_views_post
    FOREIGN KEY (post_id) REFERENCES board_posts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
