// public/board.js

let currentBoard = "free";
let currentPage = 1;
const pageSize = 10;
let currentKeyword = "";
let currentSelectedPostId = null;
let currentDetailPost = null;
let currentMode = "view"; // "view" | "edit"

// DOM
const tabButtons = document.querySelectorAll(".tab-btn");
const searchInput = document.getElementById("searchKeyword");
const btnSearch = document.getElementById("btnSearch");
const btnNewPost = document.getElementById("btnNewPost");
const postTableBody = document.getElementById("postTableBody");
const paginationEl = document.getElementById("pagination");
const detailViewEl = document.getElementById("detailView");
const detailFormWrapper = document.getElementById("detailFormWrapper");

const formTitleEl = document.getElementById("formTitle");
const postForm = document.getElementById("postForm");
const postIdInput = document.getElementById("postId");
const postBoardTypeSelect = document.getElementById("postBoardType");
const postTitleInput = document.getElementById("postTitle");
const postAuthorInput = document.getElementById("postAuthor");
const postContentInput = document.getElementById("postContent");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const btnDeletePost = document.getElementById("btnDeletePost");

// ------------------------------
// 공통 GET JSON
// ------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP error " + res.status);
  return await res.json();
}

// ------------------------------
// 모드 전환 (view / edit)
// ------------------------------
function setMode(mode, postForEdit = null) {
  currentMode = mode;

  if (mode === "view") {
    detailFormWrapper.classList.remove("mode-edit");
    detailFormWrapper.classList.add("mode-view");
    renderDetailView(currentDetailPost);
  } else {
    detailFormWrapper.classList.remove("mode-view");
    detailFormWrapper.classList.add("mode-edit");

    if (postForEdit) {
      fillFormForEdit(postForEdit);
    } else {
      resetFormForNew();
    }
  }
}

// ------------------------------
// 목록 불러오기
// ------------------------------
async function loadPostList() {
  try {
    const params = new URLSearchParams();
    params.set("board", currentBoard);
    params.set("page", String(currentPage));
    params.set("pageSize", String(pageSize));
    if (currentKeyword.trim() !== "") {
      params.set("keyword", currentKeyword.trim());
    }

    const url = `/api/posts?${params.toString()}`;
    const json = await fetchJson(url);

    if (!json.success) {
      alert("목록을 가져오지 못했습니다.");
      return;
    }

    renderPostList(json.data);
    renderPagination(json.pagination);
  } catch (err) {
    console.error("loadPostList error:", err);
    alert("목록을 불러오는 중 오류가 발생했습니다.");
  }
}

// ------------------------------
// 목록 렌더링
// ------------------------------
function renderPostList(list) {
  postTableBody.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-text";
    td.textContent = "게시글이 없습니다.";
    tr.appendChild(td);
    postTableBody.appendChild(tr);
    return;
  }

  list.forEach((post) => {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = post.id;

    const tdTitle = document.createElement("td");
    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "title-link";
    titleBtn.textContent = post.title;
    titleBtn.addEventListener("click", () => onClickPost(post.id));
    tdTitle.appendChild(titleBtn);

    const tdAuthor = document.createElement("td");
    tdAuthor.textContent = post.author;

    const tdView = document.createElement("td");
    tdView.textContent = post.view_count;

    const tdCreatedAt = document.createElement("td");
    const createdStr = String(post.created_at || "")
      .replace("T", " ")
      .slice(0, 16);
    tdCreatedAt.textContent = createdStr;

    tr.appendChild(tdId);
    tr.appendChild(tdTitle);
    tr.appendChild(tdAuthor);
    tr.appendChild(tdView);
    tr.appendChild(tdCreatedAt);

    postTableBody.appendChild(tr);
  });
}

// ------------------------------
// 페이지네이션 렌더링
// ------------------------------
function renderPagination(pagination) {
  const { totalPages, currentPage: cur } = pagination;
  paginationEl.innerHTML = "";

  if (totalPages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "이전";
  prevBtn.disabled = cur <= 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadPostList();
    }
  });
  paginationEl.appendChild(prevBtn);

  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement("button");
    btn.textContent = String(p);
    if (p === cur) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentPage = p;
      loadPostList();
    });
    paginationEl.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "다음";
  nextBtn.disabled = cur >= totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadPostList();
    }
  });
  paginationEl.appendChild(nextBtn);
}

// ------------------------------
// 게시글 상세 보기(연람 모드로 전환)
// ------------------------------
async function onClickPost(id) {
  try {
    const url = `/api/posts/${id}`;
    const json = await fetchJson(url);

    if (!json.success) {
      alert("게시글을 불러오지 못했습니다.");
      return;
    }

    currentSelectedPostId = id;
    currentDetailPost = json.data;

    // 기본은 연람 모드
    setMode("view");
  } catch (err) {
    console.error("onClickPost error:", err);
    alert("게시글을 불러오는 중 오류가 발생했습니다.");
  }
}

// ------------------------------
// 상세 화면 렌더링 (내용만 보이게)
// ------------------------------
function renderDetailView(post) {
  if (!post) {
    detailViewEl.innerHTML = `<p class="empty-text">목록에서 게시글을 선택해주세요.</p>`;
    return;
  }

  const createdStr = String(post.created_at || "")
    .replace("T", " ")
    .slice(0, 16);
  const updatedStr = String(post.updated_at || "")
    .replace("T", " ")
    .slice(0, 16);

  detailViewEl.innerHTML = `
    <div class="detail-header">
      <h3 class="detail-title">${escapeHtml(post.title)}</h3>
      <div class="detail-meta">
        <span>게시판: ${post.board_type === "free" ? "자유게시판" : "공지사항"}</span>
        <span>작성자: ${escapeHtml(post.author)}</span>
        <span>조회수: ${post.view_count}</span>
      </div>
      <div class="detail-meta">
        <span>작성일: ${createdStr}</span>
        <span>수정일: ${updatedStr}</span>
      </div>
      <div class="detail-actions">
        <button type="button" id="btnEditFromDetail">이 글 수정</button>
      </div>
    </div>
    <div class="detail-body">
      ${escapeHtml(post.content).replace(/\n/g, "<br/>")}
    </div>
  `;

  const editBtn = document.getElementById("btnEditFromDetail");
  editBtn.addEventListener("click", () => {
    if (!currentDetailPost) return;
    setMode("edit", currentDetailPost);
  });
}

// ------------------------------
// HTML 이스케이프
// ------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------
// textarea 자동 높이
// ------------------------------
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ------------------------------
// 새 글 작성 폼 초기화
// ------------------------------
function resetFormForNew() {
  formTitleEl.textContent = "새 글 작성";
  postIdInput.value = "";
  postBoardTypeSelect.value = currentBoard;
  postTitleInput.value = "";
  postAuthorInput.value = "";
  postContentInput.value = "";
  btnDeletePost.disabled = true;

  autoResizeTextarea(postContentInput);
}

// ------------------------------
// 수정 폼 채우기
// ------------------------------
function fillFormForEdit(post) {
  formTitleEl.textContent = "게시글 수정";
  postIdInput.value = post.id;
  postBoardTypeSelect.value = post.board_type;
  postTitleInput.value = post.title;
  postAuthorInput.value = post.author;
  postContentInput.value = post.content || "";
  btnDeletePost.disabled = false;

  autoResizeTextarea(postContentInput);
}

// ------------------------------
// 폼 제출 (새 글 or 수정)
// ------------------------------
postForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = postIdInput.value;
  const board_type = postBoardTypeSelect.value;
  const title = postTitleInput.value.trim();
  const author = postAuthorInput.value.trim();
  const content = postContentInput.value.trim();

  if (!title || !author || !content) {
    alert("제목, 작성자, 내용을 모두 입력해주세요.");
    return;
  }

  try {
    if (id) {
      // 수정
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, content }),
      });
      const json = await res.json();
      if (!json.success) {
        alert("수정에 실패했습니다.");
        return;
      }
      alert("수정되었습니다.");
      await loadPostList();
      await onClickPost(id); // 다시 연람 모드
    } else {
      // 새 글 작성
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_type, title, author, content }),
      });
      const json = await res.json();
      if (!json.success) {
        alert("저장에 실패했습니다.");
        return;
      }
      alert("등록되었습니다.");
      currentPage = 1;
      await loadPostList();
      resetFormForNew();
      currentDetailPost = null;
      setMode("view");
    }
  } catch (err) {
    console.error("save error:", err);
    alert("저장 중 오류가 발생했습니다.");
  }
});

// ------------------------------
// 폼 textarea 자동 리사이즈
// ------------------------------
postContentInput.addEventListener("input", () => {
  autoResizeTextarea(postContentInput);
});

// ------------------------------
// 취소: 새 글 폼 리셋 + 연람 모드
// ------------------------------
btnCancelEdit.addEventListener("click", () => {
  resetFormForNew();
  setMode("view");
});

// ------------------------------
// 삭제: 현재 편집/선택 글 삭제
// ------------------------------
btnDeletePost.addEventListener("click", async () => {
  const id = postIdInput.value || currentSelectedPostId;
  if (!id) {
    alert("삭제할 게시글이 없습니다.");
    return;
  }

  if (!confirm("정말 삭제하시겠습니까?")) return;

  try {
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      alert("삭제에 실패했습니다.");
      return;
    }
    alert("삭제되었습니다.");
    currentSelectedPostId = null;
    currentDetailPost = null;
    await loadPostList();
    resetFormForNew();
    setMode("view");
  } catch (err) {
    console.error("delete error:", err);
    alert("삭제 중 오류가 발생했습니다.");
  }
});

// ------------------------------
// 탭(자유/공지) 전환
// ------------------------------
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const board = btn.getAttribute("data-board");
    if (board === currentBoard) return;

    currentBoard = board;
    currentPage = 1;
    currentKeyword = "";
    searchInput.value = "";

    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentDetailPost = null;
    currentSelectedPostId = null;
    setMode("view");
    loadPostList();
  });
});

// ------------------------------
// 검색
// ------------------------------
btnSearch.addEventListener("click", () => {
  currentKeyword = searchInput.value;
  currentPage = 1;
  loadPostList();
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnSearch.click();
  }
});

// ------------------------------
// 새 글 작성 버튼 → 중앙에 입력 폼만 보이게
// ------------------------------
btnNewPost.addEventListener("click", () => {
  currentDetailPost = null;
  currentSelectedPostId = null;
  resetFormForNew();
  setMode("edit");
});

// ------------------------------
// 초기 실행
// ------------------------------
window.addEventListener("DOMContentLoaded", () => {
  resetFormForNew();      // 폼 기본 세팅
  setMode("view");        // 처음에는 연람 모드 (상세 비어있음)
  loadPostList();
});
