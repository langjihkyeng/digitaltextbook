(function () {
  const config = window.DIGITXT_SUPABASE || {};
  const tables = config.tables || {};
  const placeholders = new Set([
    "",
    "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE",
    "PASTE_YOUR_SUPABASE_ANON_KEY_HERE"
  ]);

  function isConfigured() {
    return Boolean(
      window.supabase &&
      config.url &&
      config.anonKey &&
      !placeholders.has(config.url) &&
      !placeholders.has(config.anonKey)
    );
  }

  const client = isConfigured()
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  function nowIso() {
    return new Date().toISOString();
  }

  function formatSupabaseError(error) {
    if (!error) return "Unknown Supabase error.";
    return [error.message, error.details, error.hint, error.code]
      .filter(Boolean)
      .join(" ");
  }

  function localJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Unable to read local storage:", error);
      return [];
    }
  }

  function normalizeHtmlFile(row, index) {
    return {
      id: row.id || `saved-html-${index + 1}`,
      name: row.name || row.file_name || `Saved HTML ${index + 1}`,
      content: String(row.content || row.html || row.code || ""),
      savedAt: row.saved_at || row.savedAt || nowIso(),
      metadata: row.metadata || {}
    };
  }

  function normalizeJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeChapterBook(row, index) {
    return {
      id: row.id || `chapter-book-${index + 1}`,
      title: row.title || row.metadata?.title || "Untitled Chapter Book",
      author: row.author || row.metadata?.author || "Unknown author",
      year: row.year || row.metadata?.year || "",
      coverImage: row.cover_image || row.coverImage || row.metadata?.coverImage || "",
      fileName: row.file_name || row.fileName || "chapter-book.html",
      content: row.content || "",
      contents: normalizeJsonArray(row.contents),
      metadata: row.metadata || {},
      savedAt: row.saved_at || row.savedAt || nowIso()
    };
  }

  function normalizeStudentActivity(row, index) {
    return {
      id: row.id || `student-activity-${index + 1}`,
      userId: row.user_id || row.userId || "",
      chapterBookId: row.chapter_book_id || row.chapterBookId || "",
      chapterId: row.chapter_id || row.chapterId || "",
      bookTitle: row.book_title || row.bookTitle || "",
      chapterTitle: row.chapter_title || row.chapterTitle || "",
      content: String(row.content || ""),
      activityState: row.activity_state || row.activityState || {},
      metadata: row.metadata || {},
      savedAt: row.saved_at || row.savedAt || nowIso(),
      updatedAt: row.updated_at || row.updatedAt || row.saved_at || row.savedAt || nowIso()
    };
  }

  function getEnrollmentStorageKey(userId) {
    return `studentEnrollments:${userId || "guest"}`;
  }

  function getActivityStorageKey(userId) {
    return `studentActivitySaves:${userId || "guest"}`;
  }

  async function listHtmlFiles() {
    if (!client) {
      return localJson("savedHtmlFiles").map(normalizeHtmlFile);
    }

    const { data, error } = await client
      .from(tables.htmlFiles || "html_files")
      .select("*")
      .order("saved_at", { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    return (data || []).map(normalizeHtmlFile);
  }

  async function saveHtmlFile(entry) {
    if (!client) {
      const stored = localJson("savedHtmlFiles");
      const existingIndex = stored.findIndex((item, index) => normalizeHtmlFile(item, index).id === entry.id);
      const nextEntry = {
        ...(existingIndex >= 0 ? stored[existingIndex] : {}),
        ...entry,
        savedAt: entry.savedAt || nowIso()
      };
      if (existingIndex >= 0) {
        stored.splice(existingIndex, 1);
      }
      stored.unshift(nextEntry);
      localStorage.setItem("savedHtmlFiles", JSON.stringify(stored.slice(0, 50)));
      return normalizeHtmlFile(nextEntry, 0);
    }

    const payload = {
      id: entry.id,
      name: entry.name,
      content: entry.content,
      saved_at: entry.savedAt || nowIso(),
      metadata: entry.metadata || {}
    };

    const { data, error } = await client
      .from(tables.htmlFiles || "html_files")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    return normalizeHtmlFile(data || payload, 0);
  }

  async function deleteHtmlFile(id) {
    if (!client) {
      const stored = localJson("savedHtmlFiles");
      const nextStored = stored.filter((entry, index) => {
        const normalized = normalizeHtmlFile(entry, index);
        return normalized.id !== id;
      });
      localStorage.setItem("savedHtmlFiles", JSON.stringify(nextStored));
      return true;
    }

    const { error } = await client
      .from(tables.htmlFiles || "html_files")
      .delete()
      .eq("id", id);

    if (error) throw new Error(formatSupabaseError(error));
    return true;
  }

  async function listChapterBooks() {
    if (!client) {
      return localJson("savedChapterBooks").map(normalizeChapterBook);
    }

    const { data, error } = await client
      .from(tables.chapterBooks || "chapter_books")
      .select("*")
      .order("saved_at", { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    return (data || []).map(normalizeChapterBook);
  }

  async function saveChapterBook(entry) {
    if (!client) {
      const stored = localJson("savedChapterBooks");
      stored.unshift(entry);
      localStorage.setItem("savedChapterBooks", JSON.stringify(stored.slice(0, 30)));
      return entry;
    }

    const payload = {
      id: entry.id,
      title: entry.title,
      author: entry.author,
      year: entry.year,
      cover_image: entry.coverImage,
      file_name: entry.fileName,
      content: entry.content,
      contents: entry.contents || [],
      metadata: entry.metadata || {},
      saved_at: entry.savedAt || nowIso()
    };

    const { error } = await client
      .from(tables.chapterBooks || "chapter_books")
      .insert(payload);

    if (error) throw new Error(formatSupabaseError(error));
    return normalizeChapterBook(payload, 0);
  }

  async function updateChapterBook(entry) {
    if (!entry?.id) {
      throw new Error("Choose a chapter book to update.");
    }

    if (!client) {
      const stored = localJson("savedChapterBooks");
      const existingIndex = stored.findIndex((item, index) => normalizeChapterBook(item, index).id === entry.id);
      const nextEntry = {
        ...(existingIndex >= 0 ? stored[existingIndex] : {}),
        ...entry,
        savedAt: entry.savedAt || nowIso()
      };

      if (existingIndex >= 0) {
        stored.splice(existingIndex, 1);
      }
      stored.unshift(nextEntry);
      localStorage.setItem("savedChapterBooks", JSON.stringify(stored.slice(0, 30)));
      return normalizeChapterBook(nextEntry, 0);
    }

    const payload = {
      id: entry.id,
      title: entry.title,
      author: entry.author,
      year: entry.year,
      cover_image: entry.coverImage,
      file_name: entry.fileName,
      content: entry.content,
      contents: entry.contents || [],
      metadata: entry.metadata || {},
      saved_at: entry.savedAt || nowIso()
    };

    const { data, error } = await client
      .from(tables.chapterBooks || "chapter_books")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    return normalizeChapterBook(data || payload, 0);
  }

  async function deleteChapterBook(id) {
    if (!client) {
      const stored = localJson("savedChapterBooks");
      const nextStored = stored.filter((entry, index) => {
        const normalized = normalizeChapterBook(entry, index);
        return normalized.id !== id;
      });
      localStorage.setItem("savedChapterBooks", JSON.stringify(nextStored));
      return true;
    }

    const { error } = await client
      .from(tables.chapterBooks || "chapter_books")
      .delete()
      .eq("id", id);

    if (error) throw new Error(formatSupabaseError(error));
    return true;
  }

  async function listStudentEnrollments(userId) {
    if (!userId) return [];

    if (!client) {
      return localJson(getEnrollmentStorageKey(userId));
    }

    const { data, error } = await client
      .from(tables.studentEnrollments || "student_enrollments")
      .select("*")
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    return data || [];
  }

  async function enrollInChapterBook(userId, chapterBookId) {
    if (!userId || !chapterBookId) {
      throw new Error("Choose a chapter book before enrolling.");
    }

    if (!client) {
      const storageKey = getEnrollmentStorageKey(userId);
      const stored = localJson(storageKey);
      const existing = stored.find((entry) => entry.chapterBookId === chapterBookId || entry.chapter_book_id === chapterBookId);
      if (existing) return existing;

      const enrollment = {
        id: `${userId}-${chapterBookId}`,
        userId,
        chapterBookId,
        enrolledAt: nowIso()
      };
      stored.unshift(enrollment);
      localStorage.setItem(storageKey, JSON.stringify(stored));
      return enrollment;
    }

    const payload = {
      user_id: userId,
      chapter_book_id: chapterBookId,
      enrolled_at: nowIso()
    };

    const { data, error } = await client
      .from(tables.studentEnrollments || "student_enrollments")
      .upsert(payload, { onConflict: "user_id,chapter_book_id" })
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    return data;
  }

  async function unenrollFromChapterBook(userId, chapterBookId) {
    if (!userId || !chapterBookId) {
      throw new Error("Choose an enrolled chapter book to remove.");
    }

    if (!client) {
      const storageKey = getEnrollmentStorageKey(userId);
      const stored = localJson(storageKey);
      const nextStored = stored.filter((entry) => (
        (entry.chapterBookId || entry.chapter_book_id) !== chapterBookId
      ));
      localStorage.setItem(storageKey, JSON.stringify(nextStored));
      return true;
    }

    const { error } = await client
      .from(tables.studentEnrollments || "student_enrollments")
      .delete()
      .eq("user_id", userId)
      .eq("chapter_book_id", chapterBookId);

    if (error) throw new Error(formatSupabaseError(error));
    return true;
  }

  async function saveStudentActivity(entry) {
    if (!entry || !entry.userId) {
      entry = { ...(entry || {}), userId: `preview-${Date.now()}` };
    }

    const savedAt = entry.savedAt || nowIso();
    const normalizedEntry = {
      id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: entry.userId,
      chapterBookId: entry.chapterBookId || "",
      chapterId: entry.chapterId || "",
      bookTitle: entry.bookTitle || "",
      chapterTitle: entry.chapterTitle || "",
      content: String(entry.content || ""),
      activityState: entry.activityState || {},
      metadata: entry.metadata || {},
      savedAt
    };

    if (!client) {
      const storageKey = getActivityStorageKey(entry.userId);
      const stored = localJson(storageKey);
      const existingIndex = stored.findIndex((item) => (
        (item.chapterBookId || item.chapter_book_id || "") === normalizedEntry.chapterBookId &&
        (item.chapterId || item.chapter_id || "") === normalizedEntry.chapterId
      ));
      const nextEntry = {
        ...(existingIndex >= 0 ? stored[existingIndex] : {}),
        ...normalizedEntry,
        id: existingIndex >= 0 ? stored[existingIndex].id : normalizedEntry.id,
        updatedAt: savedAt
      };

      if (existingIndex >= 0) {
        stored.splice(existingIndex, 1);
      }
      stored.unshift(nextEntry);
      localStorage.setItem(storageKey, JSON.stringify(stored.slice(0, 100)));
      return nextEntry;
    }

    const session = getSession();
    const sessionToken = entry.sessionToken || session?.sessionToken;
    if (!sessionToken) {
      const storageKey = getActivityStorageKey(entry.userId);
      const stored = localJson(storageKey);
      const existingIndex = stored.findIndex((item) => (
        (item.chapterBookId || item.chapter_book_id || "") === normalizedEntry.chapterBookId &&
        (item.chapterId || item.chapter_id || "") === normalizedEntry.chapterId
      ));
      const nextEntry = {
        ...(existingIndex >= 0 ? stored[existingIndex] : {}),
        ...normalizedEntry,
        id: existingIndex >= 0 ? stored[existingIndex].id : normalizedEntry.id,
        updatedAt: savedAt
      };

      if (existingIndex >= 0) {
        stored.splice(existingIndex, 1);
      }
      stored.unshift(nextEntry);
      localStorage.setItem(storageKey, JSON.stringify(stored.slice(0, 100)));
      return nextEntry;
    }

    const { data, error } = await client.rpc("digitxt_save_student_activity", {
      p_activity_state: normalizedEntry.activityState,
      p_book_title: normalizedEntry.bookTitle,
      p_chapter_book_id: normalizedEntry.chapterBookId || null,
      p_chapter_id: normalizedEntry.chapterId,
      p_chapter_title: normalizedEntry.chapterTitle,
      p_content: normalizedEntry.content,
      p_metadata: normalizedEntry.metadata,
      p_session_token: sessionToken
    });

    if (error) throw new Error(formatSupabaseError(error));
    return normalizeStudentActivity(data || normalizedEntry, 0);
  }

  async function ensureStudentBookCopy(userId, book) {
    if (!userId || !book?.id) {
      throw new Error("Choose a chapter book before opening it.");
    }

    if (!client) {
      const storageKey = getActivityStorageKey(userId);
      const stored = localJson(storageKey);
      const existingCopies = new Set(stored.map((entry) => (
        `${entry.chapterBookId || entry.chapter_book_id || ""}:${entry.chapterId || entry.chapter_id || ""}`
      )));
      const chapters = Array.isArray(book.contents) ? book.contents : [];
      const seededCopies = chapters
        .map((item, index) => ({
          item,
          index,
          chapterId: item.id || `chapter-${index + 1}`
        }))
        .filter(({ chapterId }) => !existingCopies.has(`${book.id}:${chapterId}`))
        .map(({ item, index, chapterId }) => ({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${index}`,
          userId,
          chapterBookId: book.id,
          chapterId,
          bookTitle: book.title || book.metadata?.title || "Chapter Book",
          chapterTitle: item.title || `Chapter ${index + 1}`,
          content: "",
          activityState: { studentBookCopy: true, seededFromBookOpen: true, notes: "" },
          metadata: {
            originalSavedAt: item.savedAt || "",
            copiedAt: nowIso(),
            noteOnly: true
          },
          savedAt: nowIso(),
          updatedAt: nowIso()
        }));

      if (seededCopies.length) {
        localStorage.setItem(storageKey, JSON.stringify([...seededCopies, ...stored].slice(0, 100)));
      }

      return localJson(storageKey).map(normalizeStudentActivity).filter((activity) => activity.chapterBookId === book.id);
    }

    const session = getSession();
    if (!session?.sessionToken) {
      throw new Error("Please sign in again before opening this chapter book.");
    }

    const { data, error } = await client.rpc("digitxt_ensure_student_book_copy", {
      p_chapter_book_id: book.id,
      p_session_token: session.sessionToken
    });

    if (error) throw new Error(formatSupabaseError(error));
    return (data || []).map(normalizeStudentActivity);
  }

  async function listStudentActivitySaves(userId) {
    if (!userId) return [];

    if (!client) {
      return localJson(getActivityStorageKey(userId)).map(normalizeStudentActivity);
    }

    const session = getSession();
    if (!session?.sessionToken) {
      throw new Error("Please sign in again to view saved activities.");
    }

    const { data, error } = await client.rpc("digitxt_list_student_activity_saves", {
      p_session_token: session.sessionToken
    });

    if (error) throw new Error(formatSupabaseError(error));
    const remoteActivities = (data || []).map(normalizeStudentActivity);
    try {
      localStorage.removeItem(getActivityStorageKey(userId));
    } catch (storageError) {
      console.error("Unable to clear local student activity cache:", storageError);
    }

    return remoteActivities.sort((a, b) => {
      return new Date(b.updatedAt || b.savedAt || 0).getTime() - new Date(a.updatedAt || a.savedAt || 0).getTime();
    });
  }

  async function deleteStudentActivitySave(userId, activityId) {
    if (!userId || !activityId) return true;

    if (!client) {
      const storageKey = getActivityStorageKey(userId);
      const stored = localJson(storageKey);
      localStorage.setItem(storageKey, JSON.stringify(stored.filter((entry) => entry.id !== activityId)));
      return true;
    }

    const session = getSession();
    if (!session?.sessionToken) {
      throw new Error("Please sign in again to delete saved activity.");
    }

    const { error } = await client.rpc("digitxt_delete_student_activity_save", {
      p_activity_id: activityId,
      p_session_token: session.sessionToken
    });

    if (error) throw new Error(formatSupabaseError(error));
    return true;
  }

  function saveSession(user) {
    localStorage.setItem("digitxtUser", JSON.stringify(user));
    return user;
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("digitxtUser") || "null");
    } catch (error) {
      return null;
    }
  }

  function signOut() {
    localStorage.removeItem("digitxtUser");
  }

  async function signUp(username, password, role) {
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await client.rpc("digitxt_sign_up", {
      p_password: password,
      p_role: role,
      p_username: username
    });

    if (error) throw new Error(formatSupabaseError(error));
    return saveSession(data);
  }

  async function signIn(username, password) {
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await client.rpc("digitxt_sign_in", {
      p_password: password,
      p_username: username
    });

    if (error) throw new Error(formatSupabaseError(error));
    return saveSession(data);
  }

  window.DigitxtStore = {
    isSupabaseConfigured: isConfigured,
    listHtmlFiles,
    saveHtmlFile,
    deleteHtmlFile,
    listChapterBooks,
    saveChapterBook,
    updateChapterBook,
    deleteChapterBook,
    listStudentEnrollments,
    enrollInChapterBook,
    unenrollFromChapterBook,
    ensureStudentBookCopy,
    saveStudentActivity,
    listStudentActivitySaves,
    deleteStudentActivitySave,
    signUp,
    signIn,
    signOut,
    getSession
  };
})();
